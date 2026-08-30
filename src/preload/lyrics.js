// 桌面歌词窗口的 preload：接收歌词推送、设置同步、通知关闭
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dtLyricsAPI', {
  // 主窗口推送来的当前歌词行
  onLyricsPush: (cb) => ipcRenderer.on('lyrics:push', (_event, data) => cb(data)),
  // 点击悬浮窗上的关闭按钮
  close: () => ipcRenderer.send('lyrics:close'),
  // 设置（布局/字号/颜色/锁定）
  getSettings: () => ipcRenderer.invoke('lyrics:getSettings'),
  setSettings: (partial) => ipcRenderer.invoke('lyrics:setSettings', partial),
  onSettingsChange: (cb) => ipcRenderer.on('lyrics:settings', (_event, settings) => cb(settings)),
  // 手动拖拽：读取窗口位置 / 移动窗口
  getPosition: () => ipcRenderer.invoke('lyrics:getPosition'),
  moveTo: (x, y) => ipcRenderer.send('lyrics:moveTo', { x, y })
})
