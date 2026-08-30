// 本地音乐扫描服务
// 递归扫描目录下的音频文件，解析元数据，存入 SQLite
const fs = require('fs')
const path = require('path')
const mm = require('music-metadata')
const { getDb } = require('../db/init')
const { getCoverCacheDir } = require('../utils/paths')

// 支持的音频格式
const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.wma']

/**
 * 递归收集目录下所有音频文件
 */
function collectAudioFiles(dirPath) {
  const results = []
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) {
          results.push(...collectAudioFiles(fullPath))
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (AUDIO_EXTENSIONS.includes(ext)) {
          results.push(fullPath)
        }
      }
    }
  } catch (e) {
    console.warn('[scanner] 读取目录失败:', dirPath, e.message)
  }
  return results
}

/**
 * 兼容 v7 (picture 是单个对象) 和 v8 (picture 是数组)
 */
function getPictureData(picture) {
  if (!picture) return null
  if (Array.isArray(picture)) {
    return picture.length > 0 ? picture[0] : null
  }
  // v7 单个对象
  if (picture.data && picture.data.length > 0) {
    return picture
  }
  return null
}

/**
 * 解析单个音频文件的元数据
 */
async function parseAudioFile(filePath) {
  try {
    const stat = fs.statSync(filePath)
    const ext = path.extname(filePath).toLowerCase().replace('.', '')

    // music-metadata v7.x API
    const metadata = await mm.parseFile(filePath)

    const common = metadata.common || {}
    const format = metadata.format || {}

    // 处理封面
    let coverPath = null
    const picData = getPictureData(common.picture)
    if (picData) {
      const { data, format: picFormat } = picData
      const extName = (picFormat === 'image/jpeg' || picFormat === 'image/jpg') ? 'jpg' : 'png'
      const coverFile = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extName}`
      const coverDir = getCoverCacheDir()
      const coverFullPath = path.join(coverDir, coverFile)
      fs.writeFileSync(coverFullPath, Buffer.from(data))
      coverPath = coverFullPath
    }

    // genre 可能是数组或字符串
    let genre = ''
    if (common.genre) {
      genre = Array.isArray(common.genre) ? common.genre[0] : common.genre
    }

    return {
      title: common.title || path.basename(filePath, path.extname(filePath)),
      artist: common.artist || '未知艺人',
      album: common.album || '未知专辑',
      genre: genre || '',
      duration: format.duration || 0,
      filepath: filePath,
      filesize: stat.size,
      format: ext,
      bitrate: format.bitrate || 0,
      sample_rate: format.sampleRate || 0,
      cover_path: coverPath,
      source: 'local'
    }
  } catch (e) {
    console.warn('[scanner] 解析失败:', filePath, e.message)
    // 解析失败时返回最基本的信息，仍然入库
    const stat = fs.statSync(filePath)
    return {
      title: path.basename(filePath, path.extname(filePath)),
      artist: '未知艺人',
      album: '',
      genre: '',
      duration: 0,
      filepath: filePath,
      filesize: stat.size,
      format: path.extname(filePath).toLowerCase().replace('.', ''),
      bitrate: 0,
      sample_rate: 0,
      cover_path: null,
      source: 'local'
    }
  }
}

/**
 * 扫描指定目录并入库
 */
async function scanDirectory(dirPath, onProgress = null) {
  const db = getDb()

  if (!fs.existsSync(dirPath)) {
    return { ok: false, added: 0, skipped: 0, failed: 0, error: '目录不存在' }
  }

  const files = collectAudioFiles(dirPath)
  const total = files.length
  let added = 0
  let skipped = 0
  let failed = 0

  console.log(`[scanner] 发现 ${total} 个音频文件，开始解析...`)

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO songs
      (title, artist, album, genre, duration, filepath, filesize, format, bitrate, sample_rate, cover_path, source)
    VALUES
      (@title, @artist, @album, @genre, @duration, @filepath, @filesize, @format, @bitrate, @sample_rate, @cover_path, @source)
  `)

  const tx = db.transaction((entries) => {
    for (const entry of entries) {
      const info = insertStmt.run(entry)
      if (info.changes > 0) {
        added++
      } else {
        skipped++
      }
    }
  })

  const batch = []
  for (let i = 0; i < files.length; i++) {
    try {
      const meta = await parseAudioFile(files[i])
      batch.push(meta)
    } catch (e) {
      failed++
      console.warn('[scanner] 处理文件失败:', files[i], e.message)
    }

    // 每 50 条批处理一次
    if (batch.length >= 50 || i === files.length - 1) {
      tx(batch)
      batch.length = 0
      if (onProgress) {
        onProgress({ current: i + 1, total, added, skipped, failed })
      }
    }
  }

  console.log(`[scanner] 扫描完成: 新增 ${added}, 跳过 ${skipped}, 失败 ${failed}`)
  return { ok: true, added, skipped, failed, total }
}

/**
 * 查询本地歌曲列表
 */
function queryLocalSongs({ keyword = '', page = 1, pageSize = 50, scope = 'local' } = {}) {
  const db = getDb()
  const offset = (page - 1) * pageSize
  // scope='all' 时包含在线缓存过的歌曲（添加到歌单弹窗用：播放过的都能加）
  let whereClause = scope === 'all' ? 'WHERE 1=1' : "WHERE source = 'local'"
  const params = {}

  if (keyword && keyword.trim()) {
    whereClause += ' AND (title LIKE @kw OR artist LIKE @kw OR album LIKE @kw)'
    params.kw = `%${keyword}%`
  }

  const total = db.prepare(`SELECT COUNT(*) AS cnt FROM songs ${whereClause}`).get(params).cnt
  const rows = db.prepare(`
    SELECT * FROM songs ${whereClause}
    ORDER BY title COLLATE NOCASE
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: pageSize, offset })

  return { total, list: rows }
}

function getSongById(id) {
  const db = getDb()
  return db.prepare('SELECT * FROM songs WHERE id = ?').get(id)
}

function getSongsByIds(ids) {
  const db = getDb()
  if (!ids || ids.length === 0) return []
  const placeholders = ids.map(() => '?').join(',')
  return db.prepare(`SELECT * FROM songs WHERE id IN (${placeholders})`).all(...ids)
}

function deleteSong(id) {
  const db = getDb()
  const result = db.prepare('DELETE FROM songs WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 清理文件已不存在的本地歌曲（连同歌词缓存），返回删除数量
 */
function cleanupMissingSongs() {
  const db = getDb()
  const rows = db.prepare("SELECT id, filepath FROM songs WHERE source = 'local'").all()
  let removed = 0
  for (const row of rows) {
    if (!row.filepath || !fs.existsSync(row.filepath)) {
      db.prepare('DELETE FROM lyrics WHERE song_id = ?').run(row.id)
      db.prepare('DELETE FROM songs WHERE id = ?').run(row.id)
      removed++
    }
  }
  return removed
}

function getScanDirs() {
  const { loadConfig } = require('../utils/config')
  const config = loadConfig()
  return config.localMusicDirs && config.localMusicDirs.length > 0
    ? config.localMusicDirs
    : []
}

/**
 * 保存歌词到数据库
 */
function saveLyrics(songId, lrcText, plainText, synced, wordLrcText) {
  const db = getDb()
  db.prepare(`
    INSERT INTO lyrics (song_id, lrc_text, plain_text, synced, word_lrc, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(song_id) DO UPDATE SET
      -- 传 null 的字段保留原值（如仅合并 word_lrc 时不能把已有歌词清掉）
      lrc_text = COALESCE(excluded.lrc_text, lyrics.lrc_text),
      plain_text = COALESCE(excluded.plain_text, lyrics.plain_text),
      synced = MAX(lyrics.synced, excluded.synced),
      word_lrc = COALESCE(excluded.word_lrc, lyrics.word_lrc),
      updated_at = CURRENT_TIMESTAMP
  `).run(
    songId,
    lrcText || null,
    plainText || null,
    synced == null ? 0 : (synced ? 1 : 0),
    wordLrcText || null
  )
}

/**
 * 获取歌词
 */
function getLyrics(songId) {
  const db = getDb()
  return db.prepare('SELECT * FROM lyrics WHERE song_id = ?').get(songId)
}

/**
 * 首页推荐流：
 * 1) 已有用户数据时——基于收藏/最近播放/本地+在线缓存生成个性化推荐
 * 2) 冷启动（无任何歌曲数据）时——返回一组固定的主题分类和热门关键词，
 *    前端点卡片可直接跳在线音乐对应搜索，保证首页永远不空
 */
function getDiscoverFeed() {
  const db = getDb()

  const songCount = db.prepare('SELECT COUNT(*) AS cnt FROM songs').get().cnt

  // ===== 冷启动：没有任何歌曲时，返回“引导式”推荐 =====
  if (songCount === 0) {
    return {
      greeting: pickGreeting(),
      hero: {
        title: '第一次见面',
        subtitle: '从一首周杰伦开始吧',
        tip: '探索开启 · 海量正版无损',
        coverSeed: '周杰伦 叶惠美',
        coverUrl: null,
        search: '周杰伦'
      },
      // 主题歌单卡片（前端点击跳对应搜索）
      playlists: [
        { id: -1, name: '华语经典 · 华语流行三十年', coverSeed: '华语经典 张学友', cnt: 50, search: '张学友' },
        { id: -2, name: '粤语老歌 · 黄金时代回忆', coverSeed: '粤语老歌 陈奕迅', cnt: 50, search: '陈奕迅' },
        { id: -3, name: '日系治愈 · 安静地听一下午', coverSeed: '日系治愈 RADWIMPS', cnt: 50, search: 'RADWIMPS' },
        { id: -4, name: '欧美流行 · 红遍全球热单', coverSeed: '欧美流行 泰勒', cnt: 50, search: 'Taylor Swift' },
        { id: -5, name: '中国风 · 古韵悠扬', coverSeed: '中国风 周杰伦', cnt: 50, search: '周杰伦 青花瓷' },
        { id: -6, name: '情歌对唱 · 必点 K 歌', coverSeed: '情歌对唱 屋顶', cnt: 50, search: '情歌对唱' }
      ],
      // 今日推荐：引导去在线音乐
      today: [],
      // 猜你喜欢：10 首“热门关键词”卡片，点击跳搜索
      guess: [
        { title: '晴天', artist: '周杰伦', album: '叶惠美', duration: 269, search: '晴天 周杰伦' },
        { title: '十年', artist: '陈奕迅', album: '黑白灰', duration: 206, search: '十年 陈奕迅' },
        { title: '富士山下', artist: '陈奕迅', album: 'What\'s Going On...?', duration: 268, search: '富士山下 陈奕迅' },
        { title: '稻香', artist: '周杰伦', album: '魔杰座', duration: 223, search: '稻香 周杰伦' },
        { title: '青花瓷', artist: '周杰伦', album: '我很忙', duration: 239, search: '青花瓷 周杰伦' },
        { title: '孤勇者', artist: '陈奕迅', album: '孤勇者', duration: 261, search: '孤勇者 陈奕迅' },
        { title: '海阔天空', artist: 'Beyond', album: '海阔天空', duration: 326, search: '海阔天空 Beyond' },
        { title: '江南', artist: '林俊杰', album: '第二天堂', duration: 247, search: '江南 林俊杰' },
        { title: '吻别', artist: '张学友', album: '吻别', duration: 242, search: '吻别 张学友' },
        { title: '童话', artist: '光良', album: '童话', duration: 264, search: '童话 光良' }
      ],
      // 热听榜：空时显示“热门推荐榜”
      topList: [
        { title: '七里香', artist: '周杰伦', album: '七里香', duration: 299, search: '七里香 周杰伦' },
        { title: '简单爱', artist: '周杰伦', album: '范特西', duration: 271, search: '简单爱 周杰伦' },
        { title: '浮夸', artist: '陈奕迅', album: 'U87', duration: 289, search: '浮夸 陈奕迅' },
        { title: '告白气球', artist: '周杰伦', album: '周杰伦的床边故事', duration: 215, search: '告白气球 周杰伦' },
        { title: '修炼爱情', artist: '林俊杰', album: '因你而在', duration: 295, search: '修炼爱情 林俊杰' },
        { title: '黄昏', artist: '周传雄', album: 'Transfer', duration: 303, search: '黄昏 周传雄' }
      ]
    }
  }

  // ===== 有数据时：个性化推荐 =====

  // 1) 收藏歌曲（用户明确的爱好，权重最高）
  const favorites = db
    .prepare(
      `SELECT s.*, f.added_at AS favorited_at FROM favorites f
       JOIN songs s ON s.id = f.song_id
       ORDER BY f.added_at DESC LIMIT 20`
    )
    .all()

  // 2) 最近常听的歌（按播放次数倒序）
  const frequently = db
    .prepare(
      `SELECT s.*, COUNT(h.id) AS play_count
       FROM play_history h JOIN songs s ON s.id = h.song_id
       GROUP BY s.id ORDER BY play_count DESC, MAX(h.played_at) DESC LIMIT 20`
    )
    .all()

  // 3) 所有入库歌曲（本地 + 已缓存在线）随机混一批
  const allSongs = db
    .prepare(`SELECT * FROM songs ORDER BY COALESCE(source, 'local'), id DESC LIMIT 300`)
    .all()
  const shuffled = [...allSongs].sort(() => Math.random() - 0.5).slice(0, 20)

  // 去重按 id 合入「今日推荐」
  const seenToday = new Set()
  const todayPicks = []
  const pushUnique = (list, limit) => {
    for (const s of list) {
      if (seenToday.has(s.id)) continue
      seenToday.add(s.id)
      todayPicks.push(s)
      if (todayPicks.length >= limit) break
    }
  }
  pushUnique(favorites, 8)
  pushUnique(frequently, 16)
  pushUnique(shuffled, 20)

  // 「猜你喜欢」：收藏歌曲同歌手的其他歌
  const favArtists = new Set(favorites.map((s) => (s.artist || '').trim()).filter(Boolean))
  let guess = []
  if (favArtists.size > 0) {
    const placeholders = Array.from(favArtists).map(() => '?').join(',')
    guess = db
      .prepare(
        `SELECT s.* FROM songs s
         WHERE TRIM(COALESCE(s.artist, '')) IN (${placeholders})
         ORDER BY RANDOM() LIMIT 10`
      )
      .all(...favArtists)
      .filter((s) => !seenToday.has(s.id))
  }
  if (guess.length < 8) {
    const pad = shuffled.filter((s) => !seenToday.has(s.id) && !guess.find((g) => g.id === s.id))
    guess = guess.concat(pad.slice(0, 12 - guess.length))
  }

  // 「我的歌单宝藏库」：自建歌单取前 6
  const playlists = db
    .prepare(
      `SELECT p.id, p.name,
              (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) AS cnt,
              (SELECT MAX(s.id) FROM playlist_songs ps JOIN songs s ON s.id = ps.song_id
                 WHERE ps.playlist_id = p.id LIMIT 1) AS cover_song_id
       FROM playlists p
       ORDER BY p.created_at ASC, p.id ASC
       LIMIT 6`
    )
    .all()

  // 「排行榜」：最近播放次数 Top 12
  let topList = db
    .prepare(
      `SELECT s.*, COUNT(h.id) AS play_count, MAX(h.played_at) AS last_played
       FROM play_history h JOIN songs s ON s.id = h.song_id
       GROUP BY s.id ORDER BY play_count DESC, last_played DESC LIMIT 12`
    )
    .all()
  if (topList.length < 6) {
    const fallback = db
      .prepare(`SELECT * FROM songs ORDER BY id DESC LIMIT ${12 - topList.length}`)
      .all()
      .map((s) => ({ ...s, play_count: 0, last_played: null }))
    topList = topList.concat(fallback)
  }

  // 「专属推荐卡片」：用最新收藏或最近播放当主视觉
  const hero = favorites[0] || frequently[0] || allSongs[0] || null

  return {
    greeting: pickGreeting(),
    hero: hero
      ? {
          title: hero.title,
          subtitle: hero.artist || '未知艺人',
          tip: '猜你喜欢 · 沉浸刷歌',
          coverUrl: hero.cover_url || null,
          coverSongId: hero.id,
          song: hero
        }
      : null,
    today: todayPicks,
    guess,
    topList,
    playlists
  }
}

function pickGreeting() {
  const hour = new Date().getHours()
  if (hour < 6) return '深夜了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

module.exports = {
  scanDirectory,
  cleanupMissingSongs,
  queryLocalSongs,
  getSongById,
  getSongsByIds,
  deleteSong,
  getScanDirs,
  collectAudioFiles,
  parseAudioFile,
  saveLyrics,
  getLyrics,
  getDiscoverFeed
}
