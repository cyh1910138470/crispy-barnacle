// 主进程入口
// 全局错误捕获，防止异常被吞导致应用静默退出
process.on('uncaughtException', (err) => {
  console.error('[main] UNCAUGHT EXCEPTION:', err)
})
process.on('unhandledRejection', (err) => {
  console.error('[main] UNHANDLED REJECTION:', err)
})

// 📒 主进程日志持久化模块：必须 require 在最前面，hook 掉 console 才能收集后面的所有输出
const logger = require('./utils/logger')

const { app, BrowserWindow, ipcMain, powerSaveBlocker, dialog, protocol, globalShortcut, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const { createLoginWindow, closeLoginWindow } = require('./windows/login')
const { createMainWindow, getMainWindow, setMiniModeFlag } = require('./windows/main')
const { createTray, setTrayTooltip } = require('./windows/tray')
const {
  createLyricsWindow,
  getLyricsWindow,
  closeLyricsWindow,
  getLyricsSettings,
  setLyricsSettings,
  getPosition,
  moveTo
} = require('./windows/lyrics')
const { getMachineCode, verifyActivationCode } = require('./utils/license')
const { loadConfig, saveConfig } = require('./utils/config')
const { getDb } = require('./db/init')
const { startAudioServer, stopAudioServer } = require('./services/audioServer')
const {
  scanDirectory,
  cleanupMissingSongs,
  queryLocalSongs,
  getDiscoverFeed,
  getSongById,
  getSongsByIds,
  deleteSong,
  getScanDirs,
  saveLyrics,
  getLyrics
} = require('./services/localScanner')
const { parseLRC, extractLyricText } = require('./utils/lrc')
const { parseWordLyrics } = require('./utils/qrc')
const {
  getSourceStatus,
  setSearchBase,
  testSource,
  searchSongs,
  getSingerSongs,
  getHigequCover,
  getGequbaoCover,
  getGmmp3Cover,
  prepareOnlineSong,
  backfillOnlineCovers,
  getQQLoginQr,
  checkQQLogin,
  logoutQQ,
  getLoginInfo,
  logoutNetease,
  setActiveSource,
  getQqLikedSongs,
  getNeteaseLikedSongs,
  resolveCloudFavoritesPlay
} = require('./services/onlineSource')
const { createNeteaseLoginWindow } = require('./windows/neteaseLogin')
const { fetchWordLyricForSong, backfillWordLyrics } = require('./services/wordLyrics')

// 智能读取文本文件编码：优先 UTF-8，失败则回退 GBK（网上下载的 .lrc 常见 GBK 编码）
function readTextSmart(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    try {
      return new TextDecoder('gbk').decode(buffer)
    } catch {
      return buffer.toString('utf-8')
    }
  }
}

// 防止系统休眠（prevent-display-sleep 比较激进，听歌时不会黑屏）
let powerSaveId = null

function enablePowerSave() {
  if (powerSaveId === null) {
    powerSaveId = powerSaveBlocker.start('prevent-display-sleep')
  }
}

function disablePowerSave() {
  if (powerSaveId !== null) {
    powerSaveBlocker.stop(powerSaveId)
    powerSaveId = null
  }
}

// ============ IPC 处理 ============

// ============ 授权（机器码 + 激活码） ============

// 激活页/启动画面需要的信息：本机机器码 + 是否已激活
ipcMain.handle('license:status', () => ({
  activated: !!loadConfig().activated,
  machineCode: getMachineCode()
}))

// 提交激活码：校验通过后写入配置，之后启动不再询问
ipcMain.handle('license:activate', (event, code) => {
  if (!verifyActivationCode(code)) {
    return { ok: false, msg: '激活码无效，请核对后重试' }
  }
  saveConfig({ activated: true })
  return { ok: true }
})

// 进入主窗口（已激活时启动画面 2 秒后自动调用；首次激活成功后调用）
ipcMain.handle('auth:enter', () => {
  // 关键：先创建主窗口，再关闭登录窗口
  // 避免 window-all-closed 竞态导致 app.quit()
  try {
    createMainWindow()
  } catch (e) {
    console.error('[auth] 创建主窗口失败:', e)
    return false
  }
  closeLoginWindow()
  // 按配置决定是否启用休眠拦截
  const config = loadConfig()
  if (config.preventSleep) {
    enablePowerSave()
  }
  return true
})

// 系统休眠控制
ipcMain.handle('system:setPowerSave', (event, enabled) => {
  if (enabled) enablePowerSave()
  else disablePowerSave()
  saveConfig({ preventSleep: enabled })
  return true
})

// 配置读写
ipcMain.handle('config:get', () => loadConfig())

ipcMain.handle('config:save', (event, data) => {
  saveConfig(data)
  return loadConfig()
})

// ============ 设置页 IPC ============

// 递归统计目录大小（字节）；目录不存在返回 0
function dirSize(dir) {
  let total = 0
  try {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name)
      const st = fs.statSync(p)
      if (st.isDirectory()) total += dirSize(p)
      else total += st.size
    }
  } catch {}
  return total
}

// 设置页聚合信息：版本 / 激活 / 自启动 / 缓存占用 / 路径
ipcMain.handle('settings:get', () => {
  const config = loadConfig()
  const { getMusicCacheDir, getCoverCacheDir, getUserDataPath } = require('./utils/paths')
  let openAtLogin = false
  try { openAtLogin = app.getLoginItemSettings().openAtLogin } catch {}
  return {
    version: app.getVersion(),
    activated: !!config.activated,
    machineCode: getMachineCode(),
    openAtLogin,
    closeAction: config.closeAction === 'exit' ? 'exit' : 'tray',
    preventSleep: config.preventSleep !== false,
    userDataPath: getUserDataPath(),
    musicCacheSize: dirSize(getMusicCacheDir()),
    coverCacheSize: dirSize(getCoverCacheDir())
  }
})

// 开机自启动（Windows 注册登录项 + 写配置）
ipcMain.handle('settings:setOpenAtLogin', (event, enabled) => {
  try {
    app.setLoginItemSettings({ openAtLogin: !!enabled, path: process.execPath })
  } catch (e) {
    return { ok: false, error: e.message }
  }
  saveConfig({ openAtLogin: !!enabled })
  return { ok: true }
})

// 关闭按钮行为：'tray' | 'exit'
ipcMain.handle('settings:setCloseAction', (event, action) => {
  saveConfig({ closeAction: action === 'exit' ? 'exit' : 'tray' })
  return { ok: true }
})

// 打开文件夹（userData / cache / music / cover）
ipcMain.handle('settings:openDir', async (event, which) => {
  const { getUserDataPath, getCacheRoot, getMusicCacheDir, getCoverCacheDir } = require('./utils/paths')
  const map = {
    userData: getUserDataPath,
    cache: getCacheRoot,
    music: getMusicCacheDir,
    cover: getCoverCacheDir
  }
  const dir = (map[which] || getUserDataPath)()
  await shell.openPath(dir)
  return { ok: true }
})

// 清空在线歌曲缓存（只删 online_* 文件，播放时会自动回源重新下载）
ipcMain.handle('settings:clearOnlineCache', async () => {
  const { getMusicCacheDir } = require('./utils/paths')
  const dir = getMusicCacheDir()
  let freed = 0
  let count = 0
  try {
    for (const name of fs.readdirSync(dir)) {
      // 只清在线缓存文件（online_<sourceId>.<ext>），不动其他内容
      if (!/^online_.+\.(mp3|flac|m4a|aac|ogg|wav)$/i.test(name)) continue
      const p = path.join(dir, name)
      try {
        const st = fs.statSync(p)
        freed += st.size
        fs.unlinkSync(p)
        count++
      } catch {}
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
  console.log(`[settings] 清空在线缓存：${count} 个文件，释放 ${(freed / 1024 / 1024).toFixed(1)} MB`)
  return { ok: true, count, freed }
})

// ============ 本地音乐 IPC ============

// 扫描指定目录
ipcMain.handle('music:scan', async (event, dirPath) => {
  try {
    const result = await scanDirectory(dirPath)
    return { ok: true, ...result }
  } catch (e) {
    console.error('[music] 扫描失败:', e)
    return { ok: false, error: e.message }
  }
})

// 清理文件已被删除的本地歌曲
ipcMain.handle('music:cleanupMissing', () => {
  try {
    return { ok: true, removed: cleanupMissingSongs() }
  } catch (e) {
    console.error('[music] 清理失效歌曲失败:', e)
    return { ok: false, removed: 0, error: e.message }
  }
})

// 获取已配置的扫描目录
ipcMain.handle('music:getScanDirs', () => {
  return getScanDirs()
})

// 查询本地歌曲列表
ipcMain.handle('music:list', (event, { keyword, page, pageSize, scope } = {}) => {
  try {
    return queryLocalSongs({ keyword, page, pageSize, scope })
  } catch (e) {
    console.error('[music] 查询失败:', e)
    return { total: 0, list: [] }
  }
})

// 获取单个歌曲
ipcMain.handle('music:getById', (event, id) => {
  return getSongById(id)
})

// 批量获取歌曲
ipcMain.handle('music:getByIds', (event, ids) => {
  return getSongsByIds(ids)
})

// 删除歌曲
ipcMain.handle('music:delete', (event, id) => {
  return deleteSong(id)
})

// 音频格式 → MIME 映射
const AUDIO_MIME = {
  mp3: 'audio/mpeg',
  flac: 'audio/flac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wma: 'audio/x-ms-wma',
  webm: 'audio/webm',
  opus: 'audio/ogg'
}

// 嗅探文件头 Magic Bytes → 返回正确扩展名（与 onlineSource.js 里保持一致，复制一份避免循环 require）
function sniffExtByMagic(buf) {
  if (!buf || buf.length < 16) return null
  const h = buf
  if (h[0] === 0x66 && h[1] === 0x4c && h[2] === 0x61 && h[3] === 0x43) return 'flac'
  if (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46 &&
      h[8] === 0x57 && h[9] === 0x41 && h[10] === 0x56 && h[11] === 0x45) return 'wav'
  if ((h[0] === 0x49 && h[1] === 0x44 && h[2] === 0x33) ||
      (h[0] === 0xFF && (h[1] & 0xFE) === 0xFA)) return 'mp3'
  if (h[4] === 0x66 && h[5] === 0x74 && h[6] === 0x79 && h[7] === 0x70) return 'm4a'
  if (h[0] === 0x4f && h[1] === 0x67 && h[2] === 0x67 && h[3] === 0x53) return 'ogg'
  if (h[0] === 0x1a && h[1] === 0x45 && h[2] === 0xdf && h[3] === 0xa3) return 'webm'
  return null
}

// 把歌曲文件读成 base64 Data URL；文件不存在时抛出原始 ENOENT 错误
// 🧠 新增：如果 DB 里存的 format 和实际文件头 sniff 出的扩展名不一致
//     → 自动 UPDATE songs.format 修正（修掉旧版本 ext 默认给 mp3 导致 "无法播放" 问题）
function readAudioAsDataUrl(song) {
  const data = fs.readFileSync(song.filepath)
  let fmt = song.format || 'mp3'
  const sniffed = sniffExtByMagic(data)
  if (sniffed && sniffed !== fmt) {
    console.log(`[readAudio] 🔧 DB format="${fmt}" 与文件头 sniff="${sniffed}" 不一致，自动修复：song.id=${song.id} title="${song.title}"`)
    fmt = sniffed
    try {
      const db = getDb()
      db.prepare('UPDATE songs SET format = ? WHERE id = ?').run(fmt, song.id)
    } catch (dbErr) { console.warn('[readAudio] 修复 format 列失败：', dbErr.message) }
  }
  const mime = AUDIO_MIME[fmt] || AUDIO_MIME.mp3
  return `data:${mime};base64,${data.toString('base64')}`
}

// 获取音频文件的 base64 Data URL（渲染进程播放，绕过 file:// 协议限制）
// 在线缓存歌曲文件丢失时（缓存被清理等），自动回退音源重新下载缓存
ipcMain.handle('music:getAudioDataUrl', async (event, id) => {
  const song = getSongById(id)
  if (!song) return null
  try {
    return readAudioAsDataUrl(song)
  } catch (e) {
    // 缓存丢失的在线歌曲：重新从音源获取并重建缓存后重试一次
    if (e?.code === 'ENOENT' && song.source === 'online' && song.source_id) {
      // 推断这条记录属于哪个源（online_type 列是后加的，存量记录是空的）
      //  QQ songmid = 10~16 位字母数字混合
      //  网易 id = 纯数字且通常位数较多（6~12 位）
      //  Hi歌曲 rid = 纯数字且较短（5~9 位，解析自 data-rid）
      //  熊猫无损 slug = 小写字母数字用 '-' 连接（如 zhoujielun-ye-qu）
      //  闺蜜音乐 id = 20~40 位大小写字母数字混合（可含 - _）
      let onlineType = song.online_type
      if (!onlineType) {
        const sid = String(song.source_id)
        if (/^\d{6,12}$/.test(sid) && !/kuwo/i.test(sid)) onlineType = 'netease'
        else if (/^\d{5,9}$/.test(sid)) onlineType = 'higequ'
        else if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(sid)) onlineType = 'xmwav'
        else if (/^[0-9a-zA-Z_-]{20,40}$/.test(sid) && /[A-Z]/.test(sid)) onlineType = 'gmmp3'
        else if (/^[0-9a-zA-Z]{10,32}$/.test(sid) && !/^\d+$/.test(sid)) onlineType = 'qq'
        // 其余情况 fallback：先按当前激活源；再逐个源尝试一轮
      }
      try {
        console.log('[music] 在线缓存丢失，重新获取:', song.source_id, '源类型:', onlineType || '(推断失败 先试当前激活源)')
        await prepareOnlineSong({
          sourceId: song.source_id,
          title: song.title,
          artist: song.artist,
          album: song.album,
          duration: song.duration,
          // 关键：优先使用这首歌当初缓存的源，不要按当前激活源重建
          // （否则 QQ songmid 换到 netease 激活源永远解析不到）
          onlineType
        })
        const fresh = getSongById(id)
        if (fresh) return readAudioAsDataUrl(fresh)
      } catch (e2) {
        // 第一轮失败（且上面没推断出类型或推断错）：所有三个源逐个再试一次（3 源最多就 3 次）
        try {
          const tried = new Set([onlineType].filter(Boolean))
          const fallbacks = ['qq', 'netease', 'higequ', 'gequbao', 'onemusic', 'xmwav', 'gmmp3'].filter((t) => !tried.has(t))
          for (const fb of fallbacks) {
            try {
              console.log('[music]  再试源:', fb)
              await prepareOnlineSong({
                sourceId: song.source_id,
                title: song.title,
                artist: song.artist,
                album: song.album,
                duration: song.duration,
                onlineType: fb
              })
              const fresh = getSongById(id)
              if (fresh && fs.existsSync(fresh.filepath)) {
                // 命中了，顺便把 online_type 写回库里，下次不用再走 guess 流程
                try {
                  getDb().prepare('UPDATE songs SET online_type = ? WHERE id = ?').run(fb, id)
                } catch {}
                return readAudioAsDataUrl(fresh)
              }
            } catch (_fbErr) {
              // 继续下一个
            }
          }
        } catch {}
        console.error('[music] 在线缓存重建失败:', e2.message)
        return null
      }
    }
    console.error('[music] 读取音频失败:', e)
    return null
  }
})

// 获取封面图 base64 Data URL（扫描时已从音频内嵌提取到缓存目录）
ipcMain.handle('music:getCoverDataUrl', async (event, id) => {
  const song = getSongById(id)
  if (!song) return null

  const readCover = (row) => {
    if (!row?.cover_path) return null
    try {
      const data = fs.readFileSync(row.cover_path)
      const ext = require('path').extname(row.cover_path).slice(1).toLowerCase()
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      return `data:${mime};base64,${data.toString('base64')}`
    } catch {
      return null
    }
  }

  let result = readCover(song)
  // 封面缺失（cover_path 为空或文件丢失）的在线歌曲：先补拉封面再重读一次
  if (!result && song.source === 'online' && song.source_id) {
    try {
      const { refetchOnlineCoverForRow } = require('./services/onlineSource')
      if (await refetchOnlineCoverForRow(song)) {
        result = readCover(getSongById(id))
      }
    } catch {
      // 补拉失败返回占位
    }
  }
  return result
})

// 获取歌词（带解析，含逐字歌词）
ipcMain.handle('music:getLyrics', async (event, id) => {
  const song = getSongById(id)
  if (!song) return { lyrics: [], plainText: null, synced: false, wordLyrics: [] }

  // 缺逐字歌词时后台跨源补拉（网易云 YRC，含本地/QQ源歌曲），完成后推送给渲染进程
  const fetchAndPushWordLyrics = () => {
    fetchWordLyricForSong(song)
      .then((parsed) => {
        if (parsed && parsed.length && event.sender && !event.sender.isDestroyed()) {
          event.sender.send('music:wordLyrics', { songId: id, wordLyrics: parsed })
        }
      })
      .catch(() => {})
  }

  // 先检查数据库中是否已有歌词缓存
  let lyricRecord = getLyrics(id)
  if (lyricRecord && (lyricRecord.lrc_text || lyricRecord.plain_text)) {
    // 使用缓存的歌词
    if (lyricRecord.synced && lyricRecord.lrc_text) {
      const { lyrics, plainText } = parseLRC(lyricRecord.lrc_text)
      const wordLyrics = lyricRecord.word_lrc ? parseWordLyrics(lyricRecord.word_lrc) : []
      // 老歌缺逐字歌词：后台静默补拉，不阻塞本次返回
      if (!wordLyrics.length) fetchAndPushWordLyrics()
      return { lyrics, plainText, synced: true, wordLyrics }
    } else if (lyricRecord.plain_text) {
      fetchAndPushWordLyrics()
      return { lyrics: [], plainText: lyricRecord.plain_text, synced: false, wordLyrics: [] }
    }
  }

  // 尝试从音频文件中提取内嵌歌词
  try {
    const mm = require('music-metadata')
    const metadata = await mm.parseFile(song.filepath)
    const rawText = extractLyricText(metadata.common?.lyrics)
    if (rawText) {
      const { lyrics, plainText } = parseLRC(rawText)
      const synced = lyrics.length > 0
      saveLyrics(id, synced ? rawText : null, plainText || (!synced ? rawText : null), synced)
      fetchAndPushWordLyrics()
      return { lyrics, plainText, synced, wordLyrics: [] }
    }
  } catch (e) {
    console.warn('[music] 提取歌词失败:', e.message)
  }

  // 尝试读取外部 .lrc 文件
  try {
    const dir = require('path').dirname(song.filepath)
    const baseName = require('path').basename(song.filepath, require('path').extname(song.filepath))
    const lrcPath = require('path').join(dir, baseName + '.lrc')
    if (fs.existsSync(lrcPath)) {
      const lrcText = readTextSmart(fs.readFileSync(lrcPath))
      const { lyrics, plainText } = parseLRC(lrcText)
      const synced = lyrics.length > 0
      saveLyrics(id, synced ? lrcText : null, plainText || (!synced ? lrcText : null), synced)
      fetchAndPushWordLyrics()
      return { lyrics, plainText, synced, wordLyrics: [] }
    }
  } catch (e) {
    console.warn('[music] 读取外部 lrc 失败:', e.message)
  }

  fetchAndPushWordLyrics()
  return { lyrics: [], plainText: null, synced: false, wordLyrics: [] }
})

// ============ 收藏（红心） ============

// 收藏 / 取消收藏
ipcMain.handle('favorites:toggle', (event, songId) => {
  try {
    const db = getDb()
    const exists = db.prepare('SELECT 1 FROM favorites WHERE song_id = ?').get(songId)
    if (exists) {
      db.prepare('DELETE FROM favorites WHERE song_id = ?').run(songId)
      return { favorited: false }
    }
    db.prepare('INSERT INTO favorites (song_id) VALUES (?)').run(songId)
    return { favorited: true }
  } catch (e) {
    console.warn('[favorites] toggle 失败:', e.message)
    return { favorited: false, error: e.message }
  }
})

// 查询单首歌是否已收藏
ipcMain.handle('favorites:check', (event, songId) => {
  try {
    return !!getDb().prepare('SELECT 1 FROM favorites WHERE song_id = ?').get(songId)
  } catch {
    return false
  }
})

// 查询全部已收藏歌曲的 id 列表（列表页批量标记用）
ipcMain.handle('favorites:listIds', () => {
  try {
    return getDb().prepare('SELECT song_id FROM favorites').all().map((r) => r.song_id)
  } catch {
    return []
  }
})

// 查询已收藏的在线歌曲 source_id 列表（在线搜索列表标记红心用）
ipcMain.handle('favorites:listSourceIds', () => {
  try {
    return getDb()
      .prepare(
        "SELECT s.source_id FROM favorites f JOIN songs s ON s.id = f.song_id WHERE s.source = 'online' AND s.source_id IS NOT NULL"
      )
      .all()
      .map((r) => String(r.source_id))
  } catch {
    return []
  }
})

// 已收藏歌曲完整列表（「喜欢」页面用）
ipcMain.handle('favorites:listSongs', () => {
  try {
    const list = getDb()
      .prepare(
        'SELECT s.*, f.added_at AS favorited_at FROM favorites f JOIN songs s ON s.id = f.song_id ORDER BY f.added_at DESC'
      )
      .all()
    return { ok: true, list }
  } catch (e) {
    return { ok: false, list: [], error: e.message }
  }
})

// ============ 播放历史 ============

// 首页推荐流（个性化）
ipcMain.handle('discover:feed', () => {
  try {
    return getDiscoverFeed()
  } catch (e) {
    console.error('[discover] feed 异常:', e)
    return { greeting: '你好', hero: null, today: [], guess: [], topList: [], playlists: [] }
  }
})

// 找到内置的「最近播放」歌单 id（不存在则创建）
function getRecentPlaylistId(db) {
  let pl = db.prepare("SELECT id FROM playlists WHERE name = '最近播放'").get()
  if (!pl) {
    const r = db.prepare("INSERT INTO playlists (name, description) VALUES ('最近播放', '最近播放的歌曲（自动）')").run()
    pl = { id: Number(r.lastInsertRowid) }
  }
  return pl.id
}

// 启动回填：把历史播放过的歌补进「最近播放」歌单（一次性幂等）
function backfillRecentPlaylist() {
  try {
    const db = getDb()
    const plId = getRecentPlaylistId(db)
    db.prepare(
      `INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id)
       SELECT ?, song_id FROM play_history GROUP BY song_id`
    ).run(plId)
  } catch (e) {
    console.warn('[history] 回填最近播放歌单失败:', e.message)
  }
}

// 记录一次播放（渲染进程 fire-and-forget），并同步维护「最近播放」歌单
ipcMain.on('history:record', (_event, songId) => {
  try {
    if (songId == null) return
    const db = getDb()
    db.prepare('INSERT INTO play_history (song_id) VALUES (?)').run(songId)
    const plId = getRecentPlaylistId(db)
    db.prepare('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id) VALUES (?, ?)').run(plId, songId)
  } catch (e) {
    console.warn('[history] 记录失败:', e.message)
  }
})

// 最近播放列表（按歌曲去重，取最近一次播放时间倒序）
ipcMain.handle('history:listSongs', () => {
  try {
    const list = getDb()
      .prepare(
        `SELECT s.*, MAX(h.played_at) AS last_played, COUNT(h.id) AS play_count
         FROM play_history h JOIN songs s ON s.id = h.song_id
         GROUP BY s.id ORDER BY last_played DESC LIMIT 500`
      )
      .all()
    return { ok: true, list }
  } catch (e) {
    return { ok: false, list: [], error: e.message }
  }
})

// ============ 歌单 ============

// 歌单列表（带歌曲数）
ipcMain.handle('playlists:list', () => {
  try {
    return getDb()
      .prepare(
        `SELECT p.id, p.name, COUNT(ps.song_id) AS count
         FROM playlists p LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
         GROUP BY p.id ORDER BY p.created_at ASC, p.id ASC`
      )
      .all()
  } catch {
    return []
  }
})

// 新建歌单
ipcMain.handle('playlists:create', (event, name) => {
  try {
    const n = String(name || '').trim()
    if (!n) return { ok: false, error: '歌单名不能为空' }
    const r = getDb().prepare('INSERT INTO playlists (name) VALUES (?)').run(n)
    return { ok: true, id: Number(r.lastInsertRowid) }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// 删除歌单（歌曲本身不受影响）
ipcMain.handle('playlists:remove', (event, id) => {
  try {
    const db = getDb()
    db.prepare('DELETE FROM playlist_songs WHERE playlist_id = ?').run(id)
    db.prepare('DELETE FROM playlists WHERE id = ?').run(id)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// 歌单内歌曲列表
ipcMain.handle('playlists:getSongs', (event, id) => {
  try {
    const playlist = getDb().prepare('SELECT id, name FROM playlists WHERE id = ?').get(id)
    if (!playlist) return { ok: false, error: '歌单不存在' }
    const list = getDb()
      .prepare(
        `SELECT s.* FROM playlist_songs ps JOIN songs s ON s.id = ps.song_id
         WHERE ps.playlist_id = ? ORDER BY ps.added_at DESC`
      )
      .all(id)
    return { ok: true, playlist, list }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// 添加歌曲到歌单（重复添加自动忽略）
ipcMain.handle('playlists:addSong', (event, playlistId, songId) => {
  try {
    getDb()
      .prepare('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id) VALUES (?, ?)')
      .run(playlistId, songId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// 从歌单移除歌曲（歌曲本身不受影响）
ipcMain.handle('playlists:removeSong', (event, playlistId, songId) => {
  try {
    getDb()
      .prepare('DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?')
      .run(playlistId, songId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// 按在线源 id 收藏 / 取消收藏；未缓存的歌先自动缓存再收藏
ipcMain.handle('favorites:toggleBySource', async (event, sourceId, meta) => {
  try {
    const db = getDb()
    let song = db
      .prepare("SELECT id FROM songs WHERE source = 'online' AND source_id = ?")
      .get(String(sourceId))
    // 未缓存：先下载缓存（复用在线播放的准备逻辑），成功后再收藏
    if (!song) {
      const r = await prepareOnlineSong(meta)
      if (!r?.song?.id) return { ok: false, favorited: false, error: '缓存失败，无法收藏' }
      song = { id: r.song.id }
    }
    const exists = db.prepare('SELECT 1 FROM favorites WHERE song_id = ?').get(song.id)
    if (exists) {
      db.prepare('DELETE FROM favorites WHERE song_id = ?').run(song.id)
      return { ok: true, favorited: false }
    }
    db.prepare('INSERT INTO favorites (song_id) VALUES (?)').run(song.id)
    return { ok: true, favorited: true }
  } catch (e) {
    console.warn('[favorites] toggleBySource 失败:', e.message)
    return { ok: false, favorited: false, error: e.message }
  }
})

// ============ 桌面歌词 IPC ============

// 开关桌面歌词悬浮窗
ipcMain.handle('lyrics:set', (event, enabled) => {
  try {
    if (enabled) {
      createLyricsWindow()
      saveConfig({ desktopLyrics: true })
    } else {
      closeLyricsWindow()
      saveConfig({ desktopLyrics: false })
    }
    return !!enabled
  } catch (e) {
    console.error('[lyrics] 切换失败:', e)
    return false
  }
})

// 主窗口 → 歌词窗口：转发当前歌词行
ipcMain.on('lyrics:update', (event, data) => {
  const win = getLyricsWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('lyrics:push', data)
  }
})

// 歌词窗口点 × 关闭
ipcMain.on('lyrics:close', () => {
  closeLyricsWindow()
})

// 获取桌面歌词设置（布局/字号/颜色/锁定）
ipcMain.handle('lyrics:getSettings', () => getLyricsSettings())

// 更新桌面歌词设置（局部合并）
ipcMain.handle('lyrics:setSettings', (event, partial) => {
  try {
    return setLyricsSettings(partial)
  } catch (e) {
    console.error('[lyrics] 更新设置失败:', e)
    return getLyricsSettings()
  }
})

// 手动拖拽：读取/移动歌词窗口位置
ipcMain.handle('lyrics:getPosition', () => getPosition())
ipcMain.on('lyrics:moveTo', (event, { x, y }) => {
  moveTo(x, y)
})

// ============ 在线音源 IPC ============

// 获取音源配置状态
ipcMain.handle('online:getStatus', () => getSourceStatus())
ipcMain.handle('online:setActiveSource', (_e, source) => {
  try {
    return setActiveSource(source)
  } catch (e) {
    return { ok: false, message: e.message }
  }
})

// 设置音源地址（含源类型：netease / qq）
ipcMain.handle('online:setSource', (event, base, type) => setSearchBase(base, type))

// 测试音源连通性（含源类型）
ipcMain.handle('online:test', (event, base, type) => testSource(base, type))

// QQ音乐扫码登录：获取二维码
ipcMain.handle('online:qqLoginQr', async () => {
  try {
    return await getQQLoginQr()
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// QQ音乐扫码登录：轮询扫码状态
ipcMain.handle('online:qqCheckLogin', async (event, ptqrtoken, qrsig) => {
  try {
    return await checkQQLogin(ptqrtoken, qrsig)
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// 查询 QQ 账号登录状态（含网易登录态）
ipcMain.handle('online:loginInfo', () => {
  try {
    return getLoginInfo()
  } catch {
    return { loggedIn: false, uin: '', neteaseLoggedIn: false, neteaseNickname: '' }
  }
})

// 打开网易云官方登录页窗口（登录成功后自动提取凭证并通知渲染进程）
ipcMain.handle('online:openNeteaseLogin', (e) => {
  createNeteaseLoginWindow(BrowserWindow.fromWebContents(e.sender))
  return { ok: true }
})
ipcMain.handle('online:neteaseLogout', () => {
  try {
    return logoutNetease()
  } catch {
    return { ok: false }
  }
})

// 退出 QQ 登录
ipcMain.handle('online:logout', () => logoutQQ())

// 手动触发：为老歌补拉封面
ipcMain.handle('online:backfillCovers', () => backfillOnlineCovers())

// 在线搜索（page 用于前端滚动分页加载）
ipcMain.handle('online:search', async (event, keyword, page) => {
  try {
    return await searchSongs(keyword, page)
  } catch (e) {
    console.error('[online] 搜索异常:', e)
    return { ok: false, error: e.message }
  }
})

// 歌手热门歌曲（歌手页）
ipcMain.handle('online:singerSongs', async (event, source, singerId) => {
  try {
    return await getSingerSongs(source, singerId)
  } catch (e) {
    console.error('[online] 歌手歌曲异常:', e)
    return { ok: false, error: e.message }
  }
})

// Hi歌曲单曲封面补齐（主进程限速队列串行抓播放页）
ipcMain.handle('online:higequCover', async (event, rid) => {
  try {
    return await getHigequCover(rid)
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// 歌曲宝单曲封面补齐（同 higequ：抓播放页解析）
ipcMain.handle('online:gequbaoCover', async (event, rid) => {
  try {
    return await getGequbaoCover(rid)
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// 闺蜜音乐单曲封面补齐（抓歌曲页 og:image，结果随页面缓存复用）
ipcMain.handle('online:gmmp3Cover', async (event, sid) => {
  try {
    return await getGmmp3Cover(sid)
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// 准备在线歌曲（缓存下载 + 入库），返回本地风格歌曲行供播放器直接使用
ipcMain.handle('online:play', async (event, meta) => {
  try {
    const { song, cached } = await prepareOnlineSong(meta)
    return { ok: true, song, cached }
  } catch (e) {
    console.error('[online] 准备歌曲失败:', e)
    return { ok: false, error: e.message }
  }
})

// QQ 音乐：获取当前登录账号的「我喜欢」歌单（分页）
ipcMain.handle('online:getQqLikedSongs', async (event, page, pageSize) => {
  try {
    return await getQqLikedSongs(page, pageSize)
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// 网易云：获取当前登录账号的「我喜欢的音乐」（分页）
ipcMain.handle('online:getNeteaseLikedSongs', async (event, page, pageSize) => {
  try {
    return await getNeteaseLikedSongs(page, pageSize)
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// 云端收藏播放：优先原源，VIP 过期/登录失效自动跨源兜底搜索+播放
ipcMain.handle('online:playCloudFavorite', async (event, meta) => {
  try {
    return await resolveCloudFavoritesPlay(meta)
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ============ 对话框 IPC ============

// 打开目录选择对话框（用 Electron 原生 dialog）
ipcMain.handle('dialog:selectDirectory', async () => {
  const win = BrowserWindow.getFocusedWindow() || getMainWindow()
  if (!win) return { canceled: true, path: null }
  const result = await dialog.showOpenDialog(win, {
    title: '选择音乐文件夹',
    properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
    buttonLabel: '扫描此文件夹'
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, path: null }
  }
  return { canceled: false, path: result.filePaths[0] }
})

// 📒 一键打开「日志文件所在文件夹」并选中当天的日志（用户端直接弹 toast 点按钮就能打开）
ipcMain.handle('app:openLogFolder', async () => {
  try {
    const logPath = logger.getLogPath()
    if (!logPath) return { ok: false, error: '日志路径尚未初始化' }
    shell.showItemInFolder(logPath)
    return { ok: true, path: logPath }
  } catch (e) { return { ok: false, error: e.message } }
})

// 窗口控制（无边框窗口需要自己实现）
ipcMain.on('window:minimize', () => {
  const win = BrowserWindow.getFocusedWindow() || getMainWindow()
  if (win) win.minimize()
})

ipcMain.handle('window:maximize', () => {
  const win = getMainWindow()
  if (!win) return false
  if (win.isMaximized()) {
    win.unmaximize()
    return false
  } else {
    win.maximize()
    return true
  }
})

ipcMain.handle('window:isMaximized', () => {
  const win = getMainWindow()
  return win ? win.isMaximized() : false
})

ipcMain.on('window:close', () => {
  const win = getMainWindow()
  if (win) win.close()
})

// ============ 迷你模式 ============
let preMiniBounds = null

ipcMain.handle('window:setMiniMode', (event, enabled) => {
  const win = getMainWindow()
  if (!win) return { ok: false }
  const screen = require('electron').screen
  if (enabled) {
    if (!win.isMaximized()) preMiniBounds = win.getBounds()
    else preMiniBounds = null
    if (win.isMaximized()) win.unmaximize()
    setMiniModeFlag(true)
    win.setMinimumSize(0, 0)
    win.resizable = false
    const W = 360, H = 100
    const { workArea } = screen.getPrimaryDisplay()
    win.setBounds({
      width: W,
      height: H,
      x: workArea.x + workArea.width - W - 24,
      y: workArea.y + workArea.height - H - 24
    })
    win.setAlwaysOnTop(true, 'screen-saver')
  } else {
    setMiniModeFlag(false)
    win.setAlwaysOnTop(false)
    win.resizable = true
    win.setMinimumSize(1000, 700)
    if (preMiniBounds) {
      win.setBounds(preMiniBounds)
      preMiniBounds = null
    } else {
      win.setSize(1280, 800)
      win.center()
    }
  }
  return { ok: true }
})

// ============ 应用生命周期 ============

function bootstrap() {
  createLoginWindow()
}

// 在 app.whenReady 之前注册自定义协议的特权
// 让 music:// 协议具备标准协议权限，Howler.js 可识别
protocol.registerSchemesAsPrivileged([
  { scheme: 'music', privileges: { standard: true, secure: true } }
])

app.whenReady().then(async () => {
  // 注册自定义协议：music://local/<id> 映射到本地音频文件
  protocol.registerFileProtocol('music', (request, callback) => {
    const urlPath = request.url.replace('music://local/', '')
    const id = parseInt(urlPath, 10)
    if (!id || isNaN(id)) {
      callback({ statusCode: 404 })
      return
    }
    try {
      const song = getSongById(id)
      if (!song) {
        callback({ statusCode: 404 })
        return
      }
      callback({ path: song.filepath })
    } catch (e) {
      console.error('[protocol] 处理失败:', e)
      callback({ statusCode: 500 })
    }
  })

  // 先等内置音源起来并写入配置，再开窗口（避免在线音乐页看到"未配置"中间态）
  try {
    const base = await startAudioServer()
    if (!base) console.warn('[audio-server] 内置音源未就绪，在线音乐 QQ 源将不可用')
  } catch (e) {
    console.error('[audio-server] 启动失败:', e.message)
  }

  // 📒 初始化日志文件（userData 目录此时才可用）
  let logPath = null
  try { logPath = logger.ensureLogPath(app.getPath('userData')) }
  catch (e) { console.warn('[logger] 初始化失败:', e.message) }
  console.log('[logger] ✅ 主进程日志持久化已开启：', logPath || '(未知路径)')
  // —— 用户反馈：启动时弹日志 Toast 干扰，暂时关闭（2026-08-31）
  //    保留：1) 文件持久化写入正常；2) preload onShowLogPath/openLogFolder 接口；3) app:openLogFolder IPC
  //    如需恢复，解注释下面 setTimeout 即可（3.5s 后主进程主动广播 app:show-log-path）
  // setTimeout(() => {
  //   try {
  //     const mw = getMainWindow()
  //     if (mw && logPath && !mw.isDestroyed()) mw.webContents.send('app:show-log-path', logPath)
  //   } catch (_) { /* ignore */ }
  // }, 3500)

  bootstrap()

  // 把历史播放记录回填进「最近播放」歌单（幂等，只补缺的）
  backfillRecentPlaylist()

  // ============ 系统集成：托盘 + 全局媒体键 ============
  createTray()

  // 渲染进程上报播放状态 → 更新托盘提示（鼠标悬停托盘显示当前歌曲）
  ipcMain.on('media:update-meta', (_e, meta = {}) => {
    const title = meta.title || ''
    const artist = meta.artist || ''
    const state = meta.isPlaying ? '▶' : '⏸'
    setTrayTooltip(title ? `${state} ${title} - ${artist}` : 'MSC 音乐播放器')
  })

  // 键盘多媒体键全局控制（任何应用在前台都有效）
  const sendControl = (action) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) win.webContents.send('media:control', action)
  }
  try {
    globalShortcut.register('MediaPlayPause', () => sendControl('toggle'))
    globalShortcut.register('MediaNextTrack', () => sendControl('next'))
    globalShortcut.register('MediaPreviousTrack', () => sendControl('prev'))
  } catch (e) {
    console.warn('[media-keys] 注册失败:', e.message)
  }

  // 启动 5 秒后后台为老歌补拉专辑封面（失败静默，不影响使用）
  setTimeout(() => {
    backfillOnlineCovers().catch(() => {})
  }, 5000)

  // 启动 8 秒后后台为老歌补拉逐字歌词（QRC/YRC，失败静默）
  setTimeout(() => {
    backfillWordLyrics().catch(() => {})
  }, 8000)
})

app.on('activate', () => {
  // macOS 重新激活时，没有窗口则重建登录窗
  if (BrowserWindow.getAllWindows().length === 0) {
    bootstrap()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  app.isQuitting = true
  try { globalShortcut.unregisterAll() } catch {}
  disablePowerSave()
  stopAudioServer()
})
