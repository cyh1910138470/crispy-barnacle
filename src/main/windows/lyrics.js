// 桌面歌词悬浮窗：透明、置顶、不抢焦点、可拖动
// 支持横排/竖排布局 + 字号/颜色/锁定等设置（持久化到 config）
const { BrowserWindow, screen } = require('electron')
const { join } = require('path')
const { loadConfig, saveConfig } = require('../utils/config')

// 横排 / 竖排两种窗口尺寸
const SIZE = {
  horizontal: { width: 920, height: 130 },
  vertical: { width: 180, height: 640 }
}

// 桌面歌词默认设置
const DEFAULT_SETTINGS = {
  layout: 'horizontal',   // horizontal | vertical
  fontSize: 'medium',     // small | medium | large
  color: '#21C37A',       // 已唱文字颜色
  locked: false           // 锁定后点击穿透、不可拖动
}

let lyricsWin = null
let posSaveTimer = null

// 防抖保存窗口位置（拖动过程中频繁触发，停止 300ms 后才写配置）
function scheduleSavePos() {
  clearTimeout(posSaveTimer)
  posSaveTimer = setTimeout(() => {
    if (lyricsWin && !lyricsWin.isDestroyed()) {
      const b = lyricsWin.getBounds()
      saveConfig({ desktopLyricsPos: { x: b.x, y: b.y } })
    }
  }, 300)
}

// 恢复上次保存的位置；校验其仍落在某块屏幕内，否则回退默认位置
function restoreSavedPos(savedPos, fallbackBounds) {
  if (!savedPos || !Number.isFinite(savedPos.x) || !Number.isFinite(savedPos.y)) {
    return fallbackBounds
  }
  const visible = screen.getAllDisplays().some((d) => {
    const wa = d.workArea
    return (
      savedPos.x >= wa.x - 100 &&
      savedPos.x < wa.x + wa.width - 60 &&
      savedPos.y >= wa.y - 40 &&
      savedPos.y < wa.y + wa.height - 40
    )
  })
  if (!visible) return fallbackBounds
  return { ...fallbackBounds, x: Math.round(savedPos.x), y: Math.round(savedPos.y) }
}

function getLyricsSettings() {
  const config = loadConfig()
  const saved = config.desktopLyricsSettings || {}
  return { ...DEFAULT_SETTINGS, ...saved }
}

// 更新设置（局部合并）：持久化 + 调整窗口 + 同步给页面
function setLyricsSettings(partial) {
  const next = { ...getLyricsSettings(), ...(partial || {}) }
  saveConfig({ desktopLyricsSettings: next })
  const win = getLyricsWindow()
  if (win && !win.isDestroyed()) {
    // 布局变化时调整窗口尺寸位置
    if (partial && partial.layout) {
      win.setBounds(boundsFor(next.layout, win))
      scheduleSavePos()
    }
    win.webContents.send('lyrics:settings', next)
  }
  return next
}

// 计算窗口摆放位置：优先保持窗口中心点不变，并夹在屏幕工作区内
function boundsFor(layout, keepCenter) {
  const { width, height } = SIZE[layout] || SIZE.horizontal
  const wa = screen.getPrimaryDisplay().workArea
  let cx = wa.x + wa.width / 2
  let cy = wa.y + wa.height / 2
  if (keepCenter) {
    const b = keepCenter.getBounds()
    cx = b.x + b.width / 2
    cy = b.y + b.height / 2
  }
  const x = Math.round(Math.min(Math.max(cx - width / 2, wa.x), wa.x + wa.width - width))
  const y = Math.round(Math.min(Math.max(cy - height / 2, wa.y), wa.y + wa.height - height))
  return { x, y, width, height }
}

function createLyricsWindow() {
  if (lyricsWin && !lyricsWin.isDestroyed()) {
    lyricsWin.show()
    return lyricsWin
  }

  const settings = getLyricsSettings()
  const config = loadConfig()
  const bounds = restoreSavedPos(config.desktopLyricsPos, boundsFor(settings.layout, null))

  lyricsWin = new BrowserWindow({
    ...bounds,
    frame: false,           // 无边框
    transparent: true,      // 背景透明
    hasShadow: false,
    alwaysOnTop: true,      // 永远在其他窗口上面
    skipTaskbar: true,      // 不占任务栏
    resizable: false,
    focusable: false,       // 点击时不抢焦点，不影响打字等操作
    show: false,
    title: '桌面歌词',
    webPreferences: {
      preload: join(__dirname, '../../preload/lyrics.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // 置顶到最高层级（盖过全屏应用）
  lyricsWin.setAlwaysOnTop(true, 'screen-saver')

  // 拖动结束后记录位置，下次打开恢复
  lyricsWin.on('moved', scheduleSavePos)

  if (process.env['ELECTRON_RENDERER_URL']) {
    lyricsWin.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/lyrics/')
  } else {
    lyricsWin.loadFile(join(__dirname, '../../renderer/lyrics/index.html'))
  }

  lyricsWin.once('ready-to-show', () => {
    lyricsWin.show()
  })

  // 页面加载完后同步当前设置
  lyricsWin.webContents.on('did-finish-load', () => {
    if (lyricsWin && !lyricsWin.isDestroyed()) {
      lyricsWin.webContents.send('lyrics:settings', getLyricsSettings())
    }
  })

  lyricsWin.on('closed', () => {
    lyricsWin = null
    // 同步配置和主窗口按钮状态
    saveConfig({ desktopLyrics: false })
    try {
      const { getMainWindow } = require('./main') // 延迟 require 避免循环依赖
      const main = getMainWindow()
      if (main && !main.isDestroyed()) {
        main.webContents.send('lyrics:closed')
      }
    } catch {}
  })

  return lyricsWin
}

function getLyricsWindow() {
  return lyricsWin && !lyricsWin.isDestroyed() ? lyricsWin : null
}

// 渲染进程手动拖拽需要：读取/设置窗口位置
function getPosition() {
  const win = getLyricsWindow()
  if (!win) return { x: 0, y: 0 }
  const b = win.getBounds()
  return { x: b.x, y: b.y }
}

function moveTo(x, y) {
  const win = getLyricsWindow()
  if (win) {
    win.setPosition(Math.round(x), Math.round(y))
  }
}

function closeLyricsWindow() {
  if (lyricsWin && !lyricsWin.isDestroyed()) {
    // 关闭前把当前位置存档，下次打开恢复
    try {
      const b = lyricsWin.getBounds()
      saveConfig({ desktopLyricsPos: { x: b.x, y: b.y } })
    } catch {}
    lyricsWin.close() // close 会触发 closed 事件完成状态同步
  }
  clearTimeout(posSaveTimer)
  lyricsWin = null
}

module.exports = {
  createLyricsWindow,
  getLyricsWindow,
  closeLyricsWindow,
  getLyricsSettings,
  setLyricsSettings,
  getPosition,
  moveTo
}
