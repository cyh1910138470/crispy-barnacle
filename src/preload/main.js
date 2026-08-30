// 主窗口的 preload：暴露主窗口所有能力给渲染进程
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('mscAPI', {
  // ============ 配置 ============
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (data) => ipcRenderer.invoke('config:save', data),

  // ============ 系统 ============
  setPowerSave: (enabled) => ipcRenderer.invoke('system:setPowerSave', enabled),

  // ============ 设置页 ============
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setOpenAtLogin: (enabled) => ipcRenderer.invoke('settings:setOpenAtLogin', enabled),
  setCloseAction: (action) => ipcRenderer.invoke('settings:setCloseAction', action),
  openAppDir: (which) => ipcRenderer.invoke('settings:openDir', which),
  clearOnlineCache: () => ipcRenderer.invoke('settings:clearOnlineCache'),

  // ============ 系统媒体集成 ============
  // 托盘/全局媒体键的播放控制回调
  onMediaControl: (cb) => ipcRenderer.on('media:control', (_e, action) => cb(action)),
  // 向主进程上报当前歌曲信息（托盘悬停提示）
  updateMediaMeta: (meta) => ipcRenderer.send('media:update-meta', meta),

  // ============ 桌面歌词 ============
  setDesktopLyrics: (enabled) => ipcRenderer.invoke('lyrics:set', enabled),
  updateDesktopLyrics: (data) => ipcRenderer.send('lyrics:update', data),
  onDesktopLyricsClosed: (cb) => ipcRenderer.on('lyrics:closed', () => cb()),

  // ============ 本地音乐 ============
  scanMusic: (dirPath) => ipcRenderer.invoke('music:scan', dirPath),
  cleanupMissingSongs: () => ipcRenderer.invoke('music:cleanupMissing'),
  getScanDirs: () => ipcRenderer.invoke('music:getScanDirs'),
  listMusic: (opts) => ipcRenderer.invoke('music:list', opts),
  getMusicById: (id) => ipcRenderer.invoke('music:getById', id),
  getMusicByIds: (ids) => ipcRenderer.invoke('music:getByIds', ids),
  deleteMusic: (id) => ipcRenderer.invoke('music:delete', id),
  getMusicFilePath: (id) => ipcRenderer.invoke('music:getFilePath', id),
  getAudioDataUrl: (id) => ipcRenderer.invoke('music:getAudioDataUrl', id),
  getCoverDataUrl: (id) => ipcRenderer.invoke('music:getCoverDataUrl', id),
  getLyrics: (id) => ipcRenderer.invoke('music:getLyrics', id),
  // 后台补拉到逐字歌词后主进程推送（{ songId, wordLyrics }）
  onWordLyrics: (cb) => ipcRenderer.on('music:wordLyrics', (_e, data) => cb(data)),

  // ============ 收藏（红心） ============
  toggleFavorite: (id) => ipcRenderer.invoke('favorites:toggle', id),
  checkFavorite: (id) => ipcRenderer.invoke('favorites:check', id),
  listFavoriteIds: () => ipcRenderer.invoke('favorites:listIds'),
  listFavoriteSourceIds: () => ipcRenderer.invoke('favorites:listSourceIds'),
  toggleFavoriteBySource: (sourceId, meta) => ipcRenderer.invoke('favorites:toggleBySource', sourceId, meta),
  listFavoriteSongs: () => ipcRenderer.invoke('favorites:listSongs'),

  // ============ 播放历史 ============
  recordHistory: (songId) => ipcRenderer.send('history:record', songId),
  listHistorySongs: () => ipcRenderer.invoke('history:listSongs'),

  // ============ 歌单 ============
  listPlaylists: () => ipcRenderer.invoke('playlists:list'),
  getDiscoverFeed: () => ipcRenderer.invoke('discover:feed'),
  createPlaylist: (name) => ipcRenderer.invoke('playlists:create', name),
  removePlaylist: (id) => ipcRenderer.invoke('playlists:remove', id),
  getPlaylistSongs: (id) => ipcRenderer.invoke('playlists:getSongs', id),
  addSongToPlaylist: (playlistId, songId) => ipcRenderer.invoke('playlists:addSong', playlistId, songId),
  removeSongFromPlaylist: (playlistId, songId) => ipcRenderer.invoke('playlists:removeSong', playlistId, songId),

  // ============ 在线音源 ============
  getOnlineStatus: () => ipcRenderer.invoke('online:getStatus'),
  setActiveSource: (source) => ipcRenderer.invoke('online:setActiveSource', source),
  setOnlineSource: (base, type) => ipcRenderer.invoke('online:setSource', base, type),
  testOnlineSource: (base, type) => ipcRenderer.invoke('online:test', base, type),
  searchOnline: (keyword, page) => ipcRenderer.invoke('online:search', keyword, page),
  getSingerSongs: (source, singerId) => ipcRenderer.invoke('online:singerSongs', source, singerId),
  getHigequCover: (rid) => ipcRenderer.invoke('online:higequCover', rid),
  getGequbaoCover: (rid) => ipcRenderer.invoke('online:gequbaoCover', rid),
  getGmmp3Cover: (sid) => ipcRenderer.invoke('online:gmmp3Cover', sid),
  playOnline: (meta) => ipcRenderer.invoke('online:play', meta),
  getQqLikedSongs: (page, pageSize) => ipcRenderer.invoke('online:getQqLikedSongs', page, pageSize),
  getNeteaseLikedSongs: (page, pageSize) => ipcRenderer.invoke('online:getNeteaseLikedSongs', page, pageSize),
  playCloudFavorite: (meta) => ipcRenderer.invoke('online:playCloudFavorite', meta),
  getQQLoginQr: () => ipcRenderer.invoke('online:qqLoginQr'),
  checkQQLogin: (ptqrtoken, qrsig) => ipcRenderer.invoke('online:qqCheckLogin', ptqrtoken, qrsig),
  getLoginInfo: () => ipcRenderer.invoke('online:loginInfo'),
  logoutQQ: () => ipcRenderer.invoke('online:logout'),
  openNeteaseLogin: () => ipcRenderer.invoke('online:openNeteaseLogin'),
  onNeteaseLoginSuccess: (cb) => {
    ipcRenderer.on('netease:loginSuccess', (_e, payload) => cb(payload))
  },
  logoutNetease: () => ipcRenderer.invoke('online:neteaseLogout'),
  // 📒 日志文件路径通知（启动 3.5s 后主进程主动 push）
  onShowLogPath: (cb) => {
    ipcRenderer.on('app:show-log-path', (_e, p) => cb(p))
  },

  // ============ 对话框 ============
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  openLogFolder: () => ipcRenderer.invoke('app:openLogFolder'),

  // ============ 窗口控制（无边框窗口自定义）============
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:maximize'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  setMiniMode: (enabled) => ipcRenderer.invoke('window:setMiniMode', enabled),
  close: () => ipcRenderer.send('window:close')
})
