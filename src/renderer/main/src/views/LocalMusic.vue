<template>
  <div class="local-music-page">
    <!-- 页面头部：大标题 + Tab + 操作栏 -->
    <div class="page-header">
      <h1 class="page-title">{{ pageTitle }}</h1>

      <!-- Tab 切换（仅本地库显示） -->
      <div v-if="mode === 'local'" class="tabs">
        <div class="tab active" @click="activeTab = 'songs'">
          歌曲<span class="tab-count">{{ total }}</span>
        </div>
        <div class="tab disabled" title="暂未开放">
          视频<span class="tab-count">0</span>
        </div>
      </div>

      <!-- 操作栏 -->
      <div class="action-bar">
        <div class="action-left">
          <button class="act-btn play-all" title="播放全部" @click="playAll">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
            播放
          </button>
          <button
            v-if="mode === 'playlist'"
            class="act-btn"
            title="把本地或已缓存的歌加进这个歌单"
            @click="openAddSongs"
          >
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>
            添加歌曲
          </button>
          <button v-if="mode === 'local'" class="act-btn" title="选择一个新文件夹扫描导入" @click="openScanDialog">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
            扫描文件夹
          </button>
          <button v-if="mode === 'local'" class="act-btn" title="重新扫描已导入的文件夹，添加新增歌曲" @click="rescanAll">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            刷新
          </button>
          <button
            v-if="mode === 'playlist'"
            class="act-btn danger"
            title="删除整个歌单（歌曲不受影响）"
            @click="deleteCurrentPlaylist"
          >
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            删除歌单
          </button>
        </div>
      </div>
    </div>

    <!-- 扫描进度/结果提示 -->
    <div v-if="scanning || scanProgressText" class="scan-banner">
      <svg v-if="scanning" viewBox="0 0 24 24" width="14" height="14" class="spin-icon"><path fill="currentColor" d="M12 2a10 10 0 0110 10h-2a8 8 0 10-8 8v2a10 10 0 010-20z"/></svg>
      <span>{{ scanning ? '扫描中... ' + scanProgressText : scanProgressText }}</span>
      <button v-if="scanning" class="banner-btn" @click="openScanDialog">重新扫描</button>
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
              v-if="mode !== 'playlist'"
              class="row-btn"
              title="添加到歌单"
              @click.stop="openAddToMenu(song, $event)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>
            </button>
            <button
              class="row-btn favorite"
              :class="{ favorited: song.favorited }"
              :title="song.favorited ? '取消收藏' : '收藏'"
              @click.stop="toggleFav(song)"
            >
              <svg v-if="song.favorited" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"/></svg>
              <svg v-else viewBox="0 0 24 24" width="14" height="14"><path fill="none" stroke="currentColor" stroke-width="2" d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"/></svg>
            </button>
            <button
              v-if="mode === 'playlist'"
              class="row-btn"
              title="从歌单移除"
              @click.stop="removeFromPlaylist(song)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
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
            <img
              v-if="coverMap[song.id] && !isBroken('lm-' + song.id)"
              :src="coverMap[song.id]"
              class="card-cover-img"
              alt=""
              loading="lazy"
              referrerpolicy="no-referrer"
              @error="e => onCoverError(e, 'lm-' + song.id, () => { const c = { ...coverMap.value }; delete c[song.id]; coverMap.value = c; })"
            />
            <div v-else class="cover-placeholder">
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
        <p class="empty-title">{{ emptyTitle }}</p>
        <p class="empty-hint">{{ emptyHint }}</p>
        <button v-if="mode === 'local'" class="scan-btn" @click="openScanDialog">
          <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 5h14v2H3zm0 4h14v2H3zm0 4h14v2H3zm0 4h14v2H3z"/></svg>
          扫描文件夹
        </button>
        <button v-if="mode === 'playlist'" class="scan-btn" @click="openAddSongs">
          <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>
          添加歌曲
        </button>
      </div>
    </div>

    <!-- 分页（仅本地库需要） -->
    <div v-if="mode === 'local' && total > pageSize" class="pagination">
      <button :disabled="page <= 1" @click="page--; loadSongs()">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
      </button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button :disabled="page >= totalPages" @click="page++; loadSongs()">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
      </button>
    </div>

    <!-- 添加到歌单菜单（跟随点击位置） -->
    <teleport to="body">
      <div v-if="addToMenu.show" class="addto-mask" @click="closeAddToMenu" @contextmenu.prevent="closeAddToMenu">
        <div class="addto-menu" :style="{ left: addToMenu.x + 'px', top: addToMenu.y + 'px' }" @click.stop>
          <div class="addto-head">添加到歌单</div>
          <div v-if="menuPlaylists.length === 0" class="addto-empty">还没有歌单</div>
          <div
            v-for="pl in menuPlaylists"
            :key="pl.id"
            class="addto-item"
            @click="addToPlaylist(pl)"
          >
            {{ pl.name }}
          </div>
        </div>
      </div>
    </teleport>

    <!-- 添加歌曲弹窗（歌单页用） -->
    <teleport to="body">
      <div v-if="addSongsModal" class="plmodal-mask" @click.self="closeAddSongs">
        <div class="plmodal">
          <div class="plmodal-head">
            <span>添加歌曲到「{{ pageTitle }}」</span>
            <button class="plmodal-close" @click="closeAddSongs">
              <svg viewBox="0 0 12 12" width="12" height="12"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5"/></svg>
            </button>
          </div>
          <input
            v-model="addSongsKeyword"
            class="plmodal-search"
            placeholder="搜索播放过的歌曲（本地 / 在线）"
          />
          <div class="plmodal-list">
            <div v-for="s in addableSongs" :key="s.id" class="plmodal-row">
              <div class="plmodal-info">
                <div class="plmodal-title">
                  {{ s.title }}
                  <span v-if="s.source === 'online'" class="src-tag">在线</span>
                </div>
                <div class="plmodal-artist">{{ s.artist }}</div>
              </div>
              <button
                class="plmodal-add"
                :disabled="addedIds.has(s.id)"
                @click="addOneSong(s)"
              >
                {{ addedIds.has(s.id) ? '已添加' : '添加' }}
              </button>
            </div>
            <div v-if="addableSongs.length === 0" class="addto-empty">没有匹配的歌曲</div>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { usePlayerStore } from '../stores/player'
import { appConfirm } from '../utils/confirm'

const props = defineProps({
  mode: { type: String, default: 'local' },   // local / history / favorites / playlist
  playlistId: { type: Number, default: null },
  searchKeyword: { type: String, default: '' },
  viewMode: { type: String, default: 'grid' }
})
const emit = defineEmits(['playlist-deleted', 'counts-changed'])

const player = usePlayerStore()
import { useCover } from '../composables/useCover'
const { isBroken, resetAllBroken, onCoverError } = useCover()
const activeTab = ref('songs')
const keyword = ref('')
const page = ref(1)
const pageSize = ref(100)
const total = ref(0)
const songs = ref([])
const scanning = ref(false)
const scanProgressText = ref('')
const hoveredIndex = ref(-1)
const playlistName = ref('')

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

// 封面图缓存：songId → dataURL（网格卡片展示）
const coverMap = ref({})

// 逐首异步加载封面（在线歌曲封面文件丢失时主进程会自动补拉，首次可能稍慢）
async function loadCovers() {
  resetAllBroken()
  for (const s of songs.value) {
    if (coverMap.value[s.id]) continue
    try {
      const d = await window.mscAPI.getCoverDataUrl(s.id)
      if (d) coverMap.value = { ...coverMap.value, [s.id]: d }
    } catch {
      // 无封面保持占位符
    }
  }
}

// 列表变化后刷新封面
watch(songs, (list) => {
  if (list?.length) loadCovers()
})

// 页面标题与空状态文案
const pageTitle = computed(() => {
  if (props.mode === 'history') return '最近播放'
  if (props.mode === 'favorites') return '喜欢'
  if (props.mode === 'local') return '本地和下载'
  return playlistName.value || '歌单'
})
const emptyTitle = computed(() => {
  if (props.mode === 'history') return '还没有播放记录'
  if (props.mode === 'favorites') return '还没有收藏的歌曲'
  if (props.mode === 'playlist') return '歌单还是空的'
  return '暂无本地音乐'
})
const emptyHint = computed(() => {
  if (props.mode === 'history') return '去播放几首歌，这里会记录下来'
  if (props.mode === 'favorites') return '点击歌曲旁的红心收藏，就会出现在这里'
  if (props.mode === 'playlist') return '点击下方按钮，把喜欢的歌加进来'
  return '扫描文件夹添加你的音乐库'
})

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
  // 各模式数据源不同；本地库支持关键词 + 分页
  if (props.mode === 'favorites') {
    try {
      const r = await window.mscAPI.listFavoriteSongs()
      songs.value = (r?.list || []).map((s) => ({ ...s, favorited: true }))
    } catch {
      songs.value = []
    }
    total.value = songs.value.length
    return
  }
  if (props.mode === 'history') {
    try {
      const r = await window.mscAPI.listHistorySongs()
      songs.value = await markFavorites(r?.list || [])
    } catch {
      songs.value = []
    }
    total.value = songs.value.length
    return
  }
  if (props.mode === 'playlist') {
    try {
      const r = await window.mscAPI.getPlaylistSongs(props.playlistId)
      if (r?.ok) {
        playlistName.value = r.playlist.name
        songs.value = await markFavorites(r.list || [])
      } else {
        songs.value = []
      }
    } catch {
      songs.value = []
    }
    total.value = songs.value.length
    return
  }
  // local：全部本地/缓存歌曲
  const result = await window.mscAPI.listMusic({
    keyword: keyword.value,
    page: page.value,
    pageSize: pageSize.value
  })
  total.value = result.total
  // 用真实收藏数据标记红心状态
  songs.value = await markFavorites(result.list || [])
}

// 批量标记收藏状态
async function markFavorites(list) {
  let favIds = new Set()
  try {
    favIds = new Set(await window.mscAPI.listFavoriteIds())
  } catch {}
  return list.map((s) => ({ ...s, favorited: favIds.has(s.id) }))
}

// ============ 播放全部 ============
function playAll() {
  if (songs.value.length === 0) return
  player.setQueue(songs.value.map(s => ({ ...s })), 0)
}

// 收藏 / 取消收藏
async function toggleFav(song) {
  try {
    const r = await window.mscAPI.toggleFavorite(song.id)
    song.favorited = !!r?.favorited
    emit('counts-changed')
  } catch {}
}

// ============ 添加到歌单（行内 + 菜单） ============
const addToMenu = ref({ show: false, x: 0, y: 0, song: null })
const menuPlaylists = ref([])

async function openAddToMenu(song, e) {
  try {
    menuPlaylists.value = (await window.mscAPI.listPlaylists()) || []
  } catch {
    menuPlaylists.value = []
  }
  // 菜单尺寸约 180x220，防止超出窗口
  const x = Math.min(e.clientX, window.innerWidth - 200)
  const y = Math.min(e.clientY, window.innerHeight - 240)
  addToMenu.value = { show: true, x, y, song }
}

function closeAddToMenu() {
  addToMenu.value = { show: false, x: 0, y: 0, song: null }
}

async function addToPlaylist(pl) {
  const song = addToMenu.value.song
  closeAddToMenu()
  if (!song || !pl) return
  try {
    await window.mscAPI.addSongToPlaylist(pl.id, song.id)
  } catch {}
}

// ============ 歌单页：添加歌曲弹窗 ============
const addSongsModal = ref(false)
const addSongsKeyword = ref('')
const allSongs = ref([])
const addedIds = ref(new Set())

const addableSongs = computed(() => {
  const kw = addSongsKeyword.value.trim().toLowerCase()
  if (!kw) return allSongs.value
  return allSongs.value.filter(
    (s) =>
      (s.title || '').toLowerCase().includes(kw) ||
      (s.artist || '').toLowerCase().includes(kw)
  )
})

async function openAddSongs() {
  addSongsKeyword.value = ''
  addedIds.value = new Set(songs.value.map((s) => s.id))
  try {
    // scope=all：本地 + 播放过的在线歌曲（已自动缓存入库）都能添加
    const r = await window.mscAPI.listMusic({ page: 1, pageSize: 5000, scope: 'all' })
    allSongs.value = r.list || []
  } catch {
    allSongs.value = []
  }
  addSongsModal.value = true
}

function closeAddSongs() {
  addSongsModal.value = false
  // 歌单内容可能有变化，重新加载
  loadSongs()
}

async function addOneSong(s) {
  try {
    const r = await window.mscAPI.addSongToPlaylist(props.playlistId, s.id)
    if (r?.ok) {
      const next = new Set(addedIds.value)
      next.add(s.id)
      addedIds.value = next
    }
  } catch {}
}

// ============ 歌单页：移除歌曲 / 删除歌单 ============
async function removeFromPlaylist(song) {
  try {
    await window.mscAPI.removeSongFromPlaylist(props.playlistId, song.id)
    songs.value = songs.value.filter((s) => s.id !== song.id)
    total.value = songs.value.length
  } catch {}
}

async function deleteCurrentPlaylist() {
  const ok = await appConfirm(`确定删除歌单「${playlistName.value}」？歌曲不会被删除。`, {
    title: '删除歌单',
    danger: true,
    okText: '删除'
  })
  if (!ok) return
  try {
    await window.mscAPI.removePlaylist(props.playlistId)
    emit('playlist-deleted')
  } catch {}
}

async function openScanDialog() {
  const result = await window.mscAPI.selectDirectory()
  if (result.canceled || !result.path) return
  await doScan(result.path)
}

// 重新扫描所有已配置的音乐目录（刷新新增歌曲）
async function rescanAll() {
  const config = await window.mscAPI.getConfig()
  const dirs = config.localMusicDirs || []
  if (dirs.length === 0) {
    openScanDialog()
    return
  }
  scanning.value = true
  scanProgressText.value = ''
  let added = 0
  let skipped = 0
  let failed = 0
  try {
    for (const dir of dirs) {
      const result = await window.mscAPI.scanMusic(dir)
      if (result.ok) {
        added += result.added || 0
        skipped += result.skipped || 0
      } else {
        failed++
      }
    }
    // 顺便清理文件已被删除的失效歌曲
    let removedText = ''
    try {
      const cleanup = await window.mscAPI.cleanupMissingSongs()
      if (cleanup.ok && cleanup.removed > 0) {
        removedText = `，移除失效 ${cleanup.removed} 首`
      }
    } catch {}

    scanProgressText.value = `刷新完成：新增 ${added} 首${removedText}，跳过 ${skipped} 首` + (failed ? `，${failed} 个目录失败` : '')
    page.value = 1
    await loadSongs()
  } catch (e) {
    scanProgressText.value = '刷新异常：' + e.message
  } finally {
    scanning.value = false
    setTimeout(() => { scanProgressText.value = '' }, 3000)
  }
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

/* 暂未开放的 Tab：明确禁用态 */
.tab.disabled {
  cursor: default;
  opacity: 0.4;
}

.tab.disabled:hover {
  color: var(--text-tertiary);
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

/* 网格卡片封面图（有图时覆盖占位符） */
.card-cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
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

/* 删除歌单按钮（危险操作） */
.act-btn.danger:hover {
  color: #ff6b6b;
  border-color: rgba(255, 107, 107, 0.5);
}

/* ============ 添加到歌单菜单 ============ */
.addto-mask {
  position: fixed;
  inset: 0;
  z-index: 700;
}
.addto-menu {
  position: fixed;
  min-width: 160px;
  max-height: 260px;
  overflow-y: auto;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 6px;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.5);
}
.addto-head {
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 6px 10px 4px;
}
.addto-item {
  padding: 7px 10px;
  font-size: 13px;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.addto-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.addto-empty {
  padding: 10px;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
}

/* ============ 添加歌曲弹窗 ============ */
.plmodal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 700;
}
.plmodal {
  width: 420px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}
.plmodal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}
.plmodal-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
}
.plmodal-close:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
.plmodal-search {
  height: 34px;
  border-radius: 17px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary, #141414);
  color: var(--text-primary);
  padding: 0 14px;
  font-size: 13px;
  outline: none;
  margin-bottom: 10px;
  flex-shrink: 0;
}
.plmodal-search:focus {
  border-color: var(--color-primary);
}
.plmodal-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.plmodal-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 8px;
}
.plmodal-row:hover {
  background: var(--bg-hover);
}
.plmodal-info {
  flex: 1;
  min-width: 0;
}
.plmodal-title {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.src-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 0 5px;
  font-size: 10px;
  line-height: 16px;
  vertical-align: 1px;
  color: #3ddc84;
  border: 1px solid rgba(61, 220, 132, 0.45);
  border-radius: 4px;
}
.plmodal-artist {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.plmodal-add {
  height: 26px;
  padding: 0 14px;
  border-radius: 13px;
  border: 1px solid var(--color-primary);
  background: transparent;
  color: var(--color-primary);
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}
.plmodal-add:hover:not(:disabled) {
  background: var(--color-primary);
  color: #fff;
}
.plmodal-add:disabled {
  border-color: var(--border-color);
  color: var(--text-tertiary);
  cursor: default;
}
</style>
