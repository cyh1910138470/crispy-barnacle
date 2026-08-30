// 网易云登录窗口：加载官方登录页（扫码/手机号均可），
// 登录成功后从 session cookie 中提取 MUSIC_U 并持久化
const { BrowserWindow, session } = require('electron')
const { setNeteaseCookie } = require('../services/onlineSource')

let win = null
let pollTimer = null

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

/**
 * 打开网易云登录窗口
 * @param {Electron.BrowserWindow} [parent] 主窗口（用于成功后通知渲染进程）
 */
function createNeteaseLoginWindow(parent) {
  if (win) {
    win.focus()
    return
  }
  // 独立持久 session：官方页面写 cookie，我们负责提取 MUSIC_U
  const ses = session.fromPartition('persist:netease')
  win = new BrowserWindow({
    width: 1024,
    height: 720,
    title: '网易云登录',
    autoHideMenuBar: true,
    ...(parent ? { parent } : {}),
    webPreferences: {
      session: ses,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  win.loadURL('https://music.163.com/login')

  win.on('closed', () => {
    win = null
    stopPoll()
  })

  // 轮询 session cookie：出现 MUSIC_U 即登录成功
  pollTimer = setInterval(async () => {
    if (!win || win.isDestroyed()) return
    try {
      const cookies = await ses.cookies.get({ url: 'https://music.163.com' })
      const mu = cookies.find((c) => c.name === 'MUSIC_U' && c.value && c.value.length > 10)
      if (!mu) return
      // 命中即停轮询，避免重复触发
      stopPoll()
      setNeteaseCookie(mu.value) // 同步内存 + 配置文件，搜索/播放本会话立即生效
      console.log('[online] 网易登录成功（官方页），已保存凭证')
      try {
        parent?.webContents?.send('netease:loginSuccess', { ok: true })
      } catch {}
      const w = win
      win = null
      if (w && !w.isDestroyed()) w.close()
    } catch {}
  }, 1500)
}

module.exports = { createNeteaseLoginWindow }
