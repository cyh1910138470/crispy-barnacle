// 主进程入口
// 全局错误捕获，防止异常被吞导致应用静默退出
process.on('uncaughtException', (err) => {
  console.error('[main] UNCAUGHT EXCEPTION:', err)
})
process.on('unhandledRejection', (err) => {
  console.error('[main] UNHANDLED REJECTION:', err)
})

const { app, BrowserWindow, ipcMain, powerSaveBlocker, dialog, protocol } = require('electron')
const fs = require('fs')
const { createLoginWindow, closeLoginWindow } = require('./windows/login')
const { createMainWindow, getMainWindow } = require('./windows/main')
const { verifyPassword, hashPassword } = require('./utils/password')
const { loadConfig, saveConfig } = require('./utils/config')
const {
  scanDirectory,
  queryLocalSongs,
  getSongById,
  getSongsByIds,
  deleteSong,
  getScanDirs,
  saveLyrics,
  getLyrics
} = require('./services/localScanner')
const { parseLRC, extractLyricText } = require('./utils/lrc')

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

// 验证启动密码
ipcMain.handle('auth:verify', (event, password) => {
  const config = loadConfig()
  const ok = verifyPassword(password, config.passwordHash)
  if (ok) {
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
    if (config.preventSleep) {
      enablePowerSave()
    }
  }
  return ok
})

// 修改密码
ipcMain.handle('auth:changePassword', (event, { oldPassword, newPassword }) => {
  const config = loadConfig()
  if (!verifyPassword(oldPassword, config.passwordHash)) {
    return { ok: false, msg: '原密码错误' }
  }
  if (!newPassword || newPassword.length < 4) {
    return { ok: false, msg: '新密码至少 4 位' }
  }
  const hash = hashPassword(newPassword)
  saveConfig({ passwordHash: hash })
  return { ok: true, msg: '修改成功' }
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

// 获取已配置的扫描目录
ipcMain.handle('music:getScanDirs', () => {
  return getScanDirs()
})

// 查询本地歌曲列表
ipcMain.handle('music:list', (event, { keyword, page, pageSize } = {}) => {
  try {
    return queryLocalSongs({ keyword, page, pageSize })
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

// 获取音频文件的 base64 Data URL（渲染进程播放，绕过 file:// 协议限制）
ipcMain.handle('music:getAudioDataUrl', async (event, id) => {
  const song = getSongById(id)
  if (!song) return null
  try {
    const data = fs.readFileSync(song.filepath)
    const ext = song.format || 'mp3'
    const mimeMap = {
      mp3: 'audio/mpeg',
      flac: 'audio/flac',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      wma: 'audio/x-ms-wma'
    }
    const mime = mimeMap[ext] || 'application/octet-stream'
    const base64 = data.toString('base64')
    return `data:${mime};base64,${base64}`
  } catch (e) {
    console.error('[music] 读取音频失败:', e)
    return null
  }
})

// 获取歌词（带解析）
ipcMain.handle('music:getLyrics', async (event, id) => {
  const song = getSongById(id)
  if (!song) return { lyrics: [], plainText: null, synced: false }

  // 先检查数据库中是否已有歌词缓存
  let lyricRecord = getLyrics(id)
  if (lyricRecord && (lyricRecord.lrc_text || lyricRecord.plain_text)) {
    // 使用缓存的歌词
    if (lyricRecord.synced && lyricRecord.lrc_text) {
      const { lyrics, plainText } = parseLRC(lyricRecord.lrc_text)
      return { lyrics, plainText, synced: true }
    } else if (lyricRecord.plain_text) {
      return { lyrics: [], plainText: lyricRecord.plain_text, synced: false }
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
      return { lyrics, plainText, synced }
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
      const lrcText = fs.readFileSync(lrcPath, 'utf-8')
      const { lyrics, plainText } = parseLRC(lrcText)
      const synced = lyrics.length > 0
      saveLyrics(id, synced ? lrcText : null, plainText || (!synced ? lrcText : null), synced)
      return { lyrics, plainText, synced }
    }
  } catch (e) {
    console.warn('[music] 读取外部 lrc 失败:', e.message)
  }

  return { lyrics: [], plainText: null, synced: false }
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

// ============ 应用生命周期 ============

function bootstrap() {
  createLoginWindow()
}

// 在 app.whenReady 之前注册自定义协议的特权
// 让 music:// 协议具备标准协议权限，Howler.js 可识别
protocol.registerSchemesAsPrivileged([
  { scheme: 'music', privileges: { standard: true, secure: true } }
])

app.whenReady().then(() => {
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

  bootstrap()
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
  disablePowerSave()
})
