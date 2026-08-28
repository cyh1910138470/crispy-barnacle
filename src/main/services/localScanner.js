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
function queryLocalSongs({ keyword = '', page = 1, pageSize = 50 } = {}) {
  const db = getDb()
  const offset = (page - 1) * pageSize
  let whereClause = "WHERE source = 'local'"
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
function saveLyrics(songId, lrcText, plainText, synced) {
  const db = getDb()
  db.prepare(`
    INSERT INTO lyrics (song_id, lrc_text, plain_text, synced, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(song_id) DO UPDATE SET
      lrc_text = excluded.lrc_text,
      plain_text = excluded.plain_text,
      synced = excluded.synced,
      updated_at = CURRENT_TIMESTAMP
  `).run(songId, lrcText || null, plainText || null, synced ? 1 : 0)
}

/**
 * 获取歌词
 */
function getLyrics(songId) {
  const db = getDb()
  return db.prepare('SELECT * FROM lyrics WHERE song_id = ?').get(songId)
}

module.exports = {
  scanDirectory,
  queryLocalSongs,
  getSongById,
  getSongsByIds,
  deleteSong,
  getScanDirs,
  collectAudioFiles,
  parseAudioFile,
  saveLyrics,
  getLyrics
}
