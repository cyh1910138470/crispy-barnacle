// 主进程日志持久化：把 console.log/warn/error 的全部输出同时写入 userData/logs 目录
// 解决「npm run dev 的主进程控制台输出被 electron-vite 吃掉 / 用户不知道在哪里看」的问题
const fs = require('fs')
const path = require('path')

let logFilePath = null
let logQueue = []
let initialized = false
let origLog = console.log.bind(console)
let origWarn = console.warn.bind(console)
let origError = console.error.bind(console)

function pad2(n) { return n < 10 ? '0' + n : '' + n }
function todayTag() {
  const d = new Date()
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
}
function timeStamp() {
  const d = new Date()
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

function ensureLogPath(userDataDir) {
  if (!initialized && userDataDir) {
    try {
      const logDir = path.join(userDataDir, 'logs')
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
      logFilePath = path.join(logDir, `main-${todayTag()}.log`)
      initialized = true
      // 把启动前暂存的队列先 flush 一次
      const q = logQueue
      logQueue = null
      for (const line of q) writeLine(line)
    } catch (e) {
      // 打日志失败不要影响 App，回退到只打印控制台
      console.error('[logger] 初始化日志文件失败：', e.message)
      initialized = true
      logQueue = null
      logFilePath = null
    }
  }
  return logFilePath
}

function writeLine(line) {
  if (!initialized) { logQueue.push(line); return }
  if (!logFilePath) return
  try {
    fs.appendFileSync(logFilePath, line + '\n', 'utf8')
  } catch (_) {
    // 忽略日志写盘失败
  }
}

function installHooks() {
  function wrap(orig, prefix) {
    return function (...args) {
      orig.apply(console, args)
      try {
        // 把任意 args 转成一行字符串
        const msg = args.map((a) => {
          if (a instanceof Error) return `[ERR ${a.name}] ${a.message}${a.stack ? '\n' + a.stack : ''}`
          if (typeof a === 'string') return a
          try { return JSON.stringify(a) } catch (_) { return String(a) }
        }).join(' ')
        writeLine(`[${timeStamp()}] ${prefix} ${msg}`)
      } catch (_) { /* ignore */ }
    }
  }
  console.log = wrap(origLog, 'LOG')
  console.warn = wrap(origWarn, 'WRN')
  console.error = wrap(origError, 'ERR')
}

// 立即安装 hook（确保 require 这个模块之后的所有 console 输出都会被持久化）
installHooks()

module.exports = {
  ensureLogPath,
  getLogPath: () => logFilePath
}
