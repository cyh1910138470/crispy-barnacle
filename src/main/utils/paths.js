// 路径管理：所有应用数据都在 userData 下统一管理
// Windows: C:\Users\<用户>\AppData\Roaming\MSC-TT\
const { app } = require('electron')
const path = require('path')
const fs = require('fs')

// 确保目录存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function getUserDataPath() {
  return app.getPath('userData')
}

// 配置文件路径
function getConfigPath() {
  return path.join(getUserDataPath(), 'config.json')
}

// SQLite 数据库路径
function getDbPath() {
  return path.join(getUserDataPath(), 'msc.db')
}

// 缓存根目录
function getCacheRoot() {
  return ensureDir(path.join(getUserDataPath(), 'cache'))
}

// 各类缓存子目录
function getMusicCacheDir() {
  return ensureDir(path.join(getCacheRoot(), 'music'))
}

function getLyricsCacheDir() {
  return ensureDir(path.join(getCacheRoot(), 'lyrics'))
}

function getCoverCacheDir() {
  return ensureDir(path.join(getCacheRoot(), 'cover'))
}

// 默认本地音乐目录（用户可在设置里改）
function getDefaultLocalMusicDir() {
  return ensureDir(path.join(getUserDataPath(), 'local-music'))
}

module.exports = {
  ensureDir,
  getUserDataPath,
  getConfigPath,
  getDbPath,
  getCacheRoot,
  getMusicCacheDir,
  getLyricsCacheDir,
  getCoverCacheDir,
  getDefaultLocalMusicDir
}
