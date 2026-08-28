// 配置文件读写：所有可持久化的设置都在这里
const fs = require('fs')
const path = require('path')
const { getConfigPath, ensureDir } = require('./paths')

// 默认配置
const DEFAULT_CONFIG = {
  passwordHash: null,        // null 表示首次启动，使用代码里的默认密码
  localMusicDirs: [],        // 本地音乐扫描目录列表，空时使用默认目录
  theme: 'dark',             // 主题：dark / light（当前仅 dark）
  primaryColor: '#31C27C',   // 主色 QQ绿
  windowBounds: null,        // 主窗口上次位置和大小 {x, y, width, height}
  windowMaximized: false,    // 主窗口是否最大化
  lastTrack: null,           // 上次播放的歌曲信息（id、name、source 等）
  lastPosition: 0,           // 上次播放位置（秒）
  lastPlaylist: null,        // 上次播放列表（曲目数组）
  volume: 1,                 // 音量 0~1
  playMode: 'list',          // 播放模式：list / random / single
  cacheEnabled: true,        // 是否缓存在线歌曲
  desktopLyric: true,        // 是否显示桌面歌词
  preventSleep: true,        // 听歌时防止系统休眠
  shortcuts: {               // 全局快捷键（用户可改）
    playPause: 'CommandOrControl+Alt+P',
    prev: 'CommandOrControl+Alt+Left',
    next: 'CommandOrControl+Alt+Right',
    volumeUp: 'CommandOrControl+Alt+Up',
    volumeDown: 'CommandOrControl+Alt+Down',
    toggleWindow: 'CommandOrControl+Alt+M',
    toggleLyric: 'CommandOrControl+Alt+L'
  }
}

let configCache = null

function loadConfig() {
  if (configCache) return configCache
  try {
    const p = getConfigPath()
    if (fs.existsSync(p)) {
      const data = fs.readFileSync(p, 'utf8')
      configCache = deepMerge({ ...DEFAULT_CONFIG }, JSON.parse(data))
    } else {
      configCache = { ...DEFAULT_CONFIG }
    }
  } catch (e) {
    console.error('[config] 读取失败:', e)
    configCache = { ...DEFAULT_CONFIG }
  }
  return configCache
}

function saveConfig(updates = {}) {
  const current = loadConfig()
  configCache = deepMerge({ ...current }, updates)
  try {
    const p = getConfigPath()
    ensureDir(path.dirname(p))
    fs.writeFileSync(p, JSON.stringify(configCache, null, 2), 'utf8')
  } catch (e) {
    console.error('[config] 保存失败:', e)
  }
  return configCache
}

// 简单深合并：把 src 合到 dst 上
function deepMerge(dst, src) {
  for (const k of Object.keys(src)) {
    if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') {
      dst[k] = deepMerge({ ...dst[k] }, src[k])
    } else {
      dst[k] = src[k]
    }
  }
  return dst
}

function resetConfig() {
  configCache = { ...DEFAULT_CONFIG }
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(configCache, null, 2), 'utf8')
  } catch (e) {
    console.error('[config] 重置失败:', e)
  }
  return configCache
}

module.exports = {
  loadConfig,
  saveConfig,
  resetConfig,
  DEFAULT_CONFIG
}
