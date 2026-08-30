// 内置音源服务管理：把 qq-music-api 随应用打包，启动时用 Electron 自带 Node 拉起子进程
// 朋友拿到 exe 无需安装 Node、无需手动启动音源服务
const { spawn } = require('child_process')
const net = require('net')
const path = require('path')
const { app } = require('electron')
const { loadConfig, saveConfig } = require('../utils/config')
const { ensureDir } = require('../utils/paths')

const START_PORT = 3200
const MAX_PORT_TRIES = 10
const READY_TIMEOUT_MS = 10000

let serverChild = null
let serverPort = 0

// 探测端口是否空闲
function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port, '127.0.0.1')
  })
}

// 探测地址上是否已有 qq-music-api 在跑（有就直接复用，比如开发时手动启动的服务）
async function isServerUp(base, timeoutMs = 2000) {
  try {
    const res = await fetch(`${base}/getHotkey`, { signal: AbortSignal.timeout(timeoutMs) })
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

// bundle 文件位置：打包后在 resources/audio-server，开发时在项目 resources/audio-server
function getServerEntryPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'audio-server', 'dist', 'qq-music-api.cjs')
  }
  return path.join(app.getAppPath(), 'resources', 'audio-server', 'dist', 'qq-music-api.cjs')
}

// 服务配置目录放到用户数据下（可写），避免安装目录只读导致的问题
function getServerConfigDir() {
  return ensureDir(path.join(app.getPath('userData'), 'qq-api-config'))
}

// 等待服务就绪
async function waitReady(base, timeoutMs = READY_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isServerUp(base, 1500)) return true
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}

/**
 * 确保内置音源服务可用，返回可用的 base 地址（失败返回 null）
 * 优先级：
 *  1. 用户已配置音源地址且在线可用 → 直接复用，不做任何改动
 *  2. 从 3200 起找空闲端口，spawn 内置服务（Electron Node 模式）
 *  3. 成功后把地址写入配置（仅当原配置为空或本来就是内置地址时才覆盖）
 */
async function startAudioServer() {
  const entry = getServerEntryPath()
  if (!require('fs').existsSync(entry)) {
    console.warn('[audio-server] 未找到内置音源 bundle，跳过（请先运行 npm run build:server）')
    return null
  }

  const config = loadConfig()
  const configuredBase = (config.onlineSourceBase || '').trim()

  // 1. 用户已配置的音源在线可用 → 直接复用
  if (configuredBase && /^https?:\/\//i.test(configuredBase)) {
    if (await isServerUp(configuredBase)) {
      console.log('[audio-server] 复用已配置音源:', configuredBase)
      return configuredBase
    }
  }

  // 2. 找空闲端口启动内置服务
  for (let i = 0; i < MAX_PORT_TRIES; i++) {
    const port = START_PORT + i
    if (!(await isPortFree(port))) continue

    const base = `http://127.0.0.1:${port}`
    const child = spawn(process.execPath, [entry], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1', // Electron 二进制以纯 Node 模式运行
        PORT: String(port),
        QQ_MUSIC_API_CONFIG_DIR: getServerConfigDir(),
      },
      stdio: 'ignore',
      windowsHide: true,
    })
    child.on('error', (e) => console.error('[audio-server] 子进程异常:', e.message))

    if (await waitReady(base)) {
      serverChild = child
      serverPort = port
      console.log('[audio-server] 内置音源已启动:', base)

      // 3. 写入配置（仅当原配置为空、或本来就是之前写入的内置地址时）
      const isBuiltinAddr = configuredBase === base || /^http:\/\/127\.0\.0\.1:320\d$/.test(configuredBase)
      if (!configuredBase || isBuiltinAddr) {
        if (configuredBase !== base) {
          saveConfig({ onlineSourceBase: base, onlineSourceType: 'qq' })
          console.log('[audio-server] 已写入音源配置:', base)
        }
      }
      return base
    }

    // 启动失败，杀掉换下一个端口
    try {
      child.kill()
    } catch {}
  }

  console.error('[audio-server] 无可用端口，内置音源启动失败')
  return null
}

// 应用退出时清理子进程
function stopAudioServer() {
  if (serverChild) {
    try {
      serverChild.kill()
      console.log('[audio-server] 已停止内置音源')
    } catch {}
    serverChild = null
    serverPort = 0
  }
}

module.exports = { startAudioServer, stopAudioServer }
