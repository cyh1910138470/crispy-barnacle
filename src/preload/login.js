// 登录/激活窗口的 preload
const { contextBridge, ipcRenderer, clipboard } = require('electron')

contextBridge.exposeInMainWorld('loginAPI', {
  // 本机机器码 + 是否已激活
  getLicenseStatus: () => ipcRenderer.invoke('license:status'),
  // 提交激活码（成功后写配置，之后启动免输入）
  activate: (code) => ipcRenderer.invoke('license:activate', code),
  // 进入主窗口（主进程负责开主窗、关本窗）
  enterApp: () => ipcRenderer.invoke('auth:enter'),
  // 复制机器码到系统剪贴板
  copyMachineCode: (code) => clipboard.writeText(String(code || ''))
})
