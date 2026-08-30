// 系统托盘：最小化到托盘后台播放
const { Tray, Menu, nativeImage, app } = require('electron')
const { join } = require('path')
// 注意：不能在顶部 require ./main（会与 main.js 依赖本模块形成循环依赖），在函数内按需引入

let tray = null

// 托盘是否可用（创建失败时关窗应直接退出，避免窗口隐藏后无法召回）
function isTrayAvailable() {
  return tray !== null && !tray.isDestroyed()
}

function sendToRenderer(action) {
  const { getMainWindow } = require('./main')
  const win = getMainWindow()
  if (win && !win.isDestroyed()) win.webContents.send('media:control', action)
}

function createTray() {
  try {
    // 打包后图标位于 resources/icon.png（extraResources），开发时在项目 build/ 目录
    const iconPath = app.isPackaged
      ? join(process.resourcesPath, 'icon.png')
      : join(app.getAppPath(), 'build', 'icon.png')
    const icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) {
      console.warn('[tray] 图标加载失败(' + iconPath + ')，托盘未创建')
      return null
    }
    tray = new Tray(icon.resize({ width: 16, height: 16 }))
  } catch (err) {
    console.warn('[tray] 创建失败:', err.message)
    return null
  }

  const menu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: showMainWindow },
    { type: 'separator' },
    { label: '播放 / 暂停', click: () => sendToRenderer('toggle') },
    { label: '上一首', click: () => sendToRenderer('prev') },
    { label: '下一首', click: () => sendToRenderer('next') },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('MSC 音乐播放器')
  tray.setContextMenu(menu)
  tray.on('double-click', showMainWindow)
  return tray
}

function showMainWindow() {
  const { getMainWindow } = require('./main')
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function setTrayTooltip(text) {
  if (tray && !tray.isDestroyed()) tray.setToolTip(text)
}

// 首次最小化到托盘时气泡提示
function displayBalloonOnce() {
  if (!tray || tray.isDestroyed() || process.platform !== 'win32') return
  try {
    tray.displayBalloon({
      iconType: 'info',
      title: 'MSC 音乐播放器仍在运行',
      content: '已最小化到系统托盘，音乐继续播放。点击托盘图标可重新打开窗口，右键托盘可完全退出。'
    })
  } catch {}
}

module.exports = { createTray, setTrayTooltip, displayBalloonOnce, showMainWindow, isTrayAvailable }
