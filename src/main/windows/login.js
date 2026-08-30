// 启动密码登录窗口
const { BrowserWindow, shell } = require('electron')
const { join } = require('path')

let loginWin = null

function createLoginWindow() {
  if (loginWin && !loginWin.isDestroyed()) {
    loginWin.focus()
    return loginWin
  }

  loginWin = new BrowserWindow({
    width: 960,
    height: 640,
    useContentSize: true, // 排除高 DPI 下内容区尺寸歧义
    show: false,
    frame: false,              // 无边框，自定义标题栏
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    center: true,
    title: 'MSC-TT',
    backgroundColor: '#0d0d0d',
    webPreferences: {
      preload: join(__dirname, '../../preload/login.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  loginWin.once('ready-to-show', () => {
    // 规避 Windows 高 DPI 下无边框固定尺寸窗口的首帧缩放错位：显示前强制重排一次
    const [w, h] = loginWin.getContentSize()
    loginWin.setContentSize(w, h)
    loginWin.show()
  })

  // 页面加载失败时记录错误，便于排查
  loginWin.webContents.on('did-fail-load', (e, code, desc) => {
    console.error('[login] did-fail-load:', code, desc)
  })

  loginWin.on('closed', () => {
    loginWin = null
  })

  // 开发模式走 vite dev server，生产模式加载打包后的 HTML
  if (process.env['ELECTRON_RENDERER_URL']) {
    loginWin.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/login/')
  } else {
    loginWin.loadFile(join(__dirname, '../../renderer/login/index.html'))
  }

  // 外部链接交给系统浏览器
  loginWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  return loginWin
}

function getLoginWindow() {
  return loginWin
}

function closeLoginWindow() {
  if (loginWin && !loginWin.isDestroyed()) {
    loginWin.destroy()
  }
  loginWin = null
}

module.exports = {
  createLoginWindow,
  getLoginWindow,
  closeLoginWindow
}
