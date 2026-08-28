// 登录窗口的 preload：暴露登录相关 API
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('loginAPI', {
  // 验证密码（成功后主进程会自动切到主窗口）
  verify: (password) => ipcRenderer.invoke('auth:verify', password),
  // 修改密码
  changePassword: (oldPassword, newPassword) =>
    ipcRenderer.invoke('auth:changePassword', { oldPassword, newPassword })
})
