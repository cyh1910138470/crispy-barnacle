// 主窗口
const { BrowserWindow, shell, screen, app } = require('electron')
const { join } = require('path')
const { loadConfig, saveConfig } = require('../utils/config')
const { closeLyricsWindow } = require('./lyrics')
const { displayBalloonOnce } = require('./tray')

let mainWin = null
let miniModeActive = false

function setMiniModeFlag(v) {
  miniModeActive = !!v
}

function createMainWindow() {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.focus()
    return mainWin
  }

  const config = loadConfig()
  const bounds = config.windowBounds || { width: 1280, height: 800 }

  const options = {
    width: bounds.width || 1280,
    height: bounds.height || 800,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    frame: false,              // 无边框，自定义标题栏
    backgroundColor: '#0d0d0d',
    title: 'MSC-TT',
    webPreferences: {
      preload: join(__dirname, '../../preload/main.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  }

  // 只有当上次位置在某个屏幕可视区域内才恢复，否则居中
  if (bounds.x != null && bounds.y != null) {
    const displays = screen.getAllDisplays()
    const visible = displays.some(d => {
      const { x, y, width, height } = d.bounds
      return bounds.x >= x && bounds.x < x + width && bounds.y >= y && bounds.y < y + height
    })
    if (visible) {
      options.x = bounds.x
      options.y = bounds.y
    } else {
      options.center = true
    }
  } else {
    options.center = true
  }

  mainWin = new BrowserWindow(options)

  // 记住窗口位置和大小（防抖）
  let saveTimer = null
  const debouncedSave = () => {
    if (miniModeActive) return // 迷你模式下的尺寸变化不写入配置
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (miniModeActive) return
      if (!mainWin || mainWin.isDestroyed()) return
      const isMax = mainWin.isMaximized()
      if (!isMax) {
        saveConfig({ windowBounds: mainWin.getBounds(), windowMaximized: false })
      } else {
        saveConfig({ windowMaximized: true })
      }
    }, 300)
  }
  mainWin.on('resize', debouncedSave)
  mainWin.on('move', debouncedSave)
  mainWin.on('maximize', () => saveConfig({ windowMaximized: true }))
  mainWin.on('unmaximize', () => saveConfig({ windowMaximized: false }))

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWin.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/main/')
  } else {
    mainWin.loadFile(join(__dirname, '../../renderer/main/index.html'))
  }

  mainWin.once('ready-to-show', () => {
    mainWin.show()
    // 上次是最大化则恢复
    if (config.windowMaximized) {
      mainWin.maximize()
    }
  })

  // 点关闭按钮：默认最小化到托盘继续播放；设置里选"直接退出"则正常关闭
  mainWin.on('close', (e) => {
    if (app.isQuitting) return
    const config = loadConfig()
    if (config.closeAction === 'exit') return // 不拦截，走正常关闭 → window-all-closed → quit
    // 托盘不可用时不允许隐藏（否则窗口无法召回、后台一直放歌），直接退出
    const { isTrayAvailable } = require('./tray')
    if (!isTrayAvailable()) {
      app.isQuitting = true
      app.quit()
      return
    }
    e.preventDefault()
    mainWin.hide()
    if (!config.trayHintShown) {
      displayBalloonOnce()
      saveConfig({ trayHintShown: true })
    }
  })

  mainWin.on('closed', () => {
    mainWin = null
    // 主窗口关闭时同步关闭桌面歌词，避免应用残留后台
    closeLyricsWindow()
  })

  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  return mainWin
}

function getMainWindow() {
  return mainWin
}

module.exports = {
  createMainWindow,
  getMainWindow,
  setMiniModeFlag
}
