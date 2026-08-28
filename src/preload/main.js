// 主窗口的 preload：暴露主窗口所有能力给渲染进程
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('mscAPI', {
  // ============ 配置 ============
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (data) => ipcRenderer.invoke('config:save', data),

  // ============ 鉴权 ============
  changePassword: (oldPassword, newPassword) =>
    ipcRenderer.invoke('auth:changePassword', { oldPassword, newPassword }),

  // ============ 系统 ============
  setPowerSave: (enabled) => ipcRenderer.invoke('system:setPowerSave', enabled),

  // ============ 本地音乐 ============
  scanMusic: (dirPath) => ipcRenderer.invoke('music:scan', dirPath),
  getScanDirs: () => ipcRenderer.invoke('music:getScanDirs'),
  listMusic: (opts) => ipcRenderer.invoke('music:list', opts),
  getMusicById: (id) => ipcRenderer.invoke('music:getById', id),
  getMusicByIds: (ids) => ipcRenderer.invoke('music:getByIds', ids),
  deleteMusic: (id) => ipcRenderer.invoke('music:delete', id),
  getMusicFilePath: (id) => ipcRenderer.invoke('music:getFilePath', id),
  getAudioDataUrl: (id) => ipcRenderer.invoke('music:getAudioDataUrl', id),
  getLyrics: (id) => ipcRenderer.invoke('music:getLyrics', id),

  // ============ 对话框 ============
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),

  // ============ 窗口控制（无边框窗口自定义）============
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:maximize'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  close: () => ipcRenderer.send('window:close')
})
