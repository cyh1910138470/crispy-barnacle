<template>
  <div class="local-music-page">
    <!-- 页面头部：大标题 + Tab + 操作栏 -->
    <div class="page-header">
      <h1 class="page-title">最近播放</h1>

      <!-- Tab 切换 -->
      <div class="tabs">
        <div class="tab active" @click="activeTab = 'songs'">
          歌曲<span class="tab-count">{{ total }}</span>
        </div>
        <div class="tab" @click="activeTab = 'videos'">
          视频<span class="tab-count">0</span>
        </div>
      </div>

      <!-- 操作栏 -->
      <div class="action-bar">
        <div class="action-left">
          <button class="act-btn play-all">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
            播放
          </button>
          <button class="act-btn">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            下载
          </button>
          <button class="act-btn">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 5h14v2H3zm0 4h14v2H3zm0 4h14v2H3zm0 4h14v2H3z"/></svg>
            批量
          </button>
        </div>
      </div>
    </div>

    <!-- 扫描进度提示 -->
    <div v-if="scanning" class="scan-banner">
      <svg viewBox="0 0 24 24" width="14" height="14" class="spin-icon"><path fill="currentColor" d="M12 2a10 10 0 0110 10h-2a8 8 0 10-8 8v2a10 10 0 010-20z"/></svg>
      <span>扫描中... {{ scanProgressText }}</span>
      <button class="banner-btn" @click="openScanDialog">重新扫描</button>
    </div>

    <!-- 歌曲列表 / 网格 -->
    <div class="song-list-wrapper">
      <!-- 列表视图 -->
      <div v-if="viewMode === 'list' && songs.length > 0" class="song-list">
        <div
          v-for="(song, idx) in songs"
          :key="song.id"
          class="song-row"
          :class="{ playing: player.currentTrack?.id === song.id }"
          @dblclick="handlePlay(song)"
          @mouseenter="hoveredIndex = idx"
          @mouseleave="hoveredIndex = -1"
        >
          <!-- 序号 / 封面 -->
          <div class="row-index">
            <div v-if="hoveredIndex === idx" class="play-icon">
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
            </div>
            <span v-else>{{ idx + 1 }}</span>
          </div>

          <!-- 歌曲信息 -->
          <div class="row-info">
            <div class="row-title">{{ song.title }}</div>
            <div class="row-artist">{{ song.artist }}</div>
          </div>

          <!-- 专辑 -->
          <div class="row-album">{{ song.album || '-' }}</div>

          <!-- 时长 -->
          <div class="row-duration">{{ formatDuration(song.duration) }}</div>

          <!-- 操作 -->
          <div class="row-actions">
            <button
              class="row-btn favorite"
              :class="{ favorited: song.favorited }"
              title="收藏"
            >
              <svg v-if="!song.favorited" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"/></svg>
              <svg v-else viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 网格视图 -->
      <div v-else-if="viewMode === 'grid' && songs.length > 0" class="song-grid">
        <div
          v-for="song in songs"
          :key="song.id"
          class="song-card"
          :class="{ playing: player.currentTrack?.id === song.id }"
          @dblclick="handlePlay(song)"
        >
          <div class="card-cover" @click="handlePlay(song)">
            <div class="cover-placeholder">
              <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
            </div>
            <div class="card-play">
              <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
          <div class="card-info">
            <div class="card-title" :title="song.title">{{ song.title }}</div>
            <div class="card-artist" :title="song.artist">{{ song.artist }}</div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="songs.length === 0" class="empty-state">
        <svg viewBox="0 0 80 80" width="64" height="64"><path fill="currentColor" d="M40 10L20 25v35l20 15 20-15V25L40 10zm0 4l14 10v32l-14 10-14-10V24L40 14z" opacity="0.2"/></svg>
        <p class="empty-title">暂无本地音乐</p>
        <p class="empty-hint">扫描文件夹添加你的音乐库</p>
        <button class="scan-btn" @click="openScanDialog">
          <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 5h14v2H3zm0 4h14v2H3zm0 4h14v2H3zm0 4h14v2H3z"/></svg>
          扫描文件夹
        </button>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="pagination">
      <button :disabled="page <= 1" @click="page--; loadSongs()">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
      </button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button :disabled="page >= totalPages" @click="page++; loadSongs()">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { usePlayerStore } from '../stores/player'

const props = defineProps({
  searchKeyword: { type: String, default: '' },
  viewMode: { type: String, default: 'grid' }
})

const player = usePlayerStore()

const activeTab = ref('songs')
const keyword = ref('')
const page = ref(1)
const pageSize = ref(100)
const total = ref(0)
const songs = ref([])
const scanning = ref(false)
const scanProgressText = ref('')
const hoveredIndex = ref(-1)

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

// 监听外部搜索关键字
watch(() => props.searchKeyword, (val) => {
  keyword.value = val
  page.value = 1
  loadSongs()
})

onMounted(() => {
  loadSongs()
})

async function loadSongs() {
  const result = await window.mscAPI.listMusic({
    keyword: keyword.value,
    page: page.value,
    pageSize: pageSize.value
  })
  total.value = result.total
  // 添加 favorited 状态
  songs.value = (result.list || []).map(s => ({ ...s, favorited: false }))
}

async function openScanDialog() {
  const result = await window.mscAPI.selectDirectory()
  if (result.canceled || !result.path) return
  await doScan(result.path)
}

async function doScan(dirPath) {
  scanning.value = true
  scanProgressText.value = '扫描中...'
  try {
    const result = await window.mscAPI.scanMusic(dirPath)
    if (result.ok) {
      scanProgressText.value = `新增 ${result.added} 首，跳过 ${result.skipped} 首`
      // 保存扫描目录
      const config = await window.mscAPI.getConfig()
      const dirs = config.localMusicDirs || []
      if (!dirs.includes(dirPath)) {
        dirs.push(dirPath)
        await window.mscAPI.saveConfig({ localMusicDirs: dirs })
      }
      page.value = 1
      await loadSongs()
    } else {
      scanProgressText.value = '扫描失败：' + (result.error || '未知错误')
    }
  } catch (e) {
    scanProgressText.value = '扫描异常：' + e.message
  } finally {
    scanning.value = false
    setTimeout(() => { scanProgressText.value = '' }, 3000)
  }
}

function handlePlay(song) {
  const idx = player.queue.findIndex(s => s.id === song.id)
  if (idx >= 0) {
    player.playIndex(idx)
  } else {
    const newQueue = [song, ...songs.value.filter(s => s.id !== song.id)]
    player.setQueue(newQueue, 0)
  }
}

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
</script>

<style scoped>
.local-music-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 页面头部 */
.page-header {
  padding: 24px 32px 0;
  flex-shrink: 0;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 16px;
}

/* Tab */
.tabs {
  display: flex;
  gap: 24px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 16px;
}

.tab {
  position: relative;
  padding: 10px 0;
  font-size: 14px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition);
}

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  color: var(--text-primary);
  font-weight: 600;
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-primary);
}

.tab-count {
  margin-left: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.tab.active .tab-count {
  color: var(--text-secondary);
}

/* 操作栏 */
.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
}

.action-left {
  display: flex;
  gap: 8px;
}

.act-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 14px;
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 500;
  transition: var(--transition);
}

.act-btn:hover {
  background: var(--bg-hover);
}

.act-btn.play-all {
  background: var(--color-primary);
  color: #fff;
}

.act-btn.play-all:hover {
  background: var(--color-primary-hover);
}

/* 扫描提示 */
.scan-banner {
  margin: 0 32px;
  padding: 10px 16px;
  background: var(--color-primary-soft);
  border-radius: var(--radius-md);
  color: var(--color-primary);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.banner-btn {
  margin-left: auto;
  height: 24px;
  padding: 0 10px;
  background: transparent;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: 12px;
  transition: var(--transition);
}

.banner-btn:hover {
  background: var(--color-primary);
  color: #fff;
}

/* 歌曲列表 */
.song-list-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 0 32px;
}

.song-list {
  padding-top: 8px;
}

.song-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 20px 16px;
  padding-top: 16px;
  padding-bottom: 16px;
}

.song-card {
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.song-card:hover {
  background: var(--bg-elevated);
  transform: translateY(-2px);
}

.song-card.playing {
  background: var(--color-primary-soft);
}

.card-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: var(--bg-hover);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-placeholder {
  color: var(--text-tertiary);
  opacity: 0.6;
}

.card-play {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 44px;
  height: 44px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  opacity: 0;
  transition: all 0.2s;
  backdrop-filter: blur(4px);
}

.song-card:hover .card-play {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.card-play:hover {
  background: var(--color-primary);
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-artist {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-row {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 44px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
}

.song-row:hover {
  background: var(--bg-hover);
}

.song-row.playing {
  background: var(--color-primary-soft);
}

.song-row.playing .row-title {
  color: var(--color-primary);
}

.row-index {
  width: 28px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
  flex-shrink: 0;
}

.play-icon {
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.row-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.row-title {
  font-size: 14px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.row-artist {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.row-album {
  width: 160px;
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.row-duration {
  width: 60px;
  text-align: right;
  font-size: 12px;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.row-actions {
  width: 40px;
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.row-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  transition: var(--transition);
  opacity: 0;
}

.song-row:hover .row-btn {
  opacity: 1;
}

.row-btn:hover {
  color: #ff5a5a;
  background: var(--bg-active);
}

.row-btn.favorited {
  color: #ff5a5a;
  opacity: 1;
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 0;
}

.empty-title {
  font-size: 16px;
  color: var(--text-secondary);
  margin-top: 12px;
}

.empty-hint {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 16px;
}

.scan-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 20px;
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 500;
  transition: var(--transition);
}

.scan-btn:hover {
  background: var(--color-primary-hover);
}

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px;
  flex-shrink: 0;
}

.pagination button {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  transition: var(--transition);
}

.pagination button:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.pagination button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.pagination span {
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 60px;
  text-align: center;
}

/* 滚动条 */
.song-list-wrapper::-webkit-scrollbar {
  width: 6px;
}

.song-list-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

.song-list-wrapper::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.song-list-wrapper::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}
</style>
