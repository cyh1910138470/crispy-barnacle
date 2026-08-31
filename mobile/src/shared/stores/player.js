/**
 * 移动端播放器状态管理（Pinia）
 * 基于桌面版 player.js 精简而来：
 *   - 移除 Electron IPC / 桌面悬浮歌词 / 本地文件 (base64 DataURL) 逻辑
 *   - 统一 Howler 直接播 HTTP 直链
 *   - 播放历史 & 收藏用 localStorage 持久化
 */
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { Howl, Howler } from 'howler'
import { resolveSong } from '@shared/services/tripleSources'
import { formatTime } from '@shared/utils/lrc'

// Howler 全局：同域跨源支持
Howler.autoUnlock = true
Howler.html5PoolSize = 20

const HISTORY_KEY = 'msctt_history'
const FAVORITES_KEY = 'msctt_favorites'
const QUEUE_KEY = 'msctt_queue'
const LAST_TRACK_KEY = 'msctt_last_track'

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}
function saveJSON(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val))
  } catch {}
}

export const usePlayerStore = defineStore('player', () => {
  // ======== 状态 ========
  const currentTrack = ref(null)      // 解析后的完整歌曲（含 playUrl / lyrics / cover）
  const currentMeta = ref(null)       // 搜索列表里的原始项（未解析）
  const currentIndex = ref(-1)
  const queue = ref(loadJSON(QUEUE_KEY, []))
  const isPlaying = ref(false)
  const isPaused = ref(false)
  const isLoading = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(Number(localStorage.getItem('msctt_vol') ?? 1))
  const playMode = ref(localStorage.getItem('msctt_mode') || 'list') // list / random / single
  const history = ref(loadJSON(HISTORY_KEY, []))
  const favorites = ref(loadJSON(FAVORITES_KEY, []))

  // 歌词
  const lyrics = ref([])
  const plainLyrics = ref(null)
  const isLyricsSynced = ref(false)
  const activeLyricIndex = ref(-1)

  let howl = null
  let timer = null

  // ======== 计算属性 ========
  const progress = computed(() =>
    duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0
  )
  const currentTimeText = computed(() => formatTime(currentTime.value))
  const durationText = computed(() => formatTime(duration.value))
  const isFavorite = computed(() => {
    if (!currentMeta.value?.sourceId) return false
    return favorites.value.some(
      (f) => f.sourceId === currentMeta.value.sourceId && f.onlineType === currentMeta.value.onlineType
    )
  })

  // ======== Howler 生命周期 ========
  function destroyHowl() {
    if (howl) {
      try {
        howl.unload()
      } catch {}
      howl = null
    }
    stopTimer()
  }

  function startTimer() {
    stopTimer()
    timer = setInterval(() => {
      if (!howl) return
      try {
        const t = howl.seek()
        if (typeof t === 'number' && !isNaN(t)) currentTime.value = t
        // 歌词滚动
        if (lyrics.value.length) {
          let idx = -1
          for (let i = 0; i < lyrics.value.length; i++) {
            if (lyrics.value[i].time <= currentTime.value + 0.1) idx = i
            else break
          }
          activeLyricIndex.value = idx
        }
      } catch {}
    }, 400)
  }
  function stopTimer() {
    if (timer) clearInterval(timer)
    timer = null
  }

  function initHowl(src, format) {
    destroyHowl()
    return new Promise((resolve, reject) => {
      howl = new Howl({
        src: [src],
        format: format || undefined,
        html5: true, // 跨源音频必须用 HTML5 Audio（否则拿不到进度/时长）
        volume: volume.value,
        onload: () => {
          try {
            duration.value = howl.duration() || 0
          } catch {}
          isLoading.value = false
          resolve()
        },
        onloaderror: (id, err) => {
          isLoading.value = false
          destroyHowl()
          reject(new Error('音频加载失败（可能直链已过期，请重新搜索播放） code=' + err))
        },
        onplay: () => {
          isPlaying.value = true
          isPaused.value = false
          startTimer()
        },
        onpause: () => {
          isPlaying.value = false
          isPaused.value = true
          stopTimer()
        },
        onstop: () => {
          isPlaying.value = false
          isPaused.value = false
          currentTime.value = 0
          stopTimer()
        },
        onend: () => handleTrackEnd(),
        onseek: () => {
          try {
            currentTime.value = howl.seek() || 0
          } catch {}
        }
      })
    })
  }

  // ======== 播放/暂停/切歌 ========
  async function play(meta, _queue = null, _index = null) {
    if (!meta?.sourceId) throw new Error('缺少歌曲信息')
    isLoading.value = true
    try {
      // 1. 解析直链 + 封面 + 歌词
      const resolved = await resolveSong(meta)
      currentMeta.value = { ...meta }
      currentTrack.value = resolved
      lyrics.value = resolved.lyrics || []
      plainLyrics.value = resolved.plainLyrics || null
      isLyricsSynced.value = !!resolved.lyricsSynced
      activeLyricIndex.value = -1
      currentTime.value = 0
      duration.value = 0

      // 2. 队列同步
      if (Array.isArray(_queue)) {
        queue.value = _queue
        saveJSON(QUEUE_KEY, queue.value)
      }
      if (typeof _index === 'number') currentIndex.value = _index
      else {
        const idx = queue.value.findIndex(
          (q) => q.sourceId === meta.sourceId && q.onlineType === meta.onlineType
        )
        if (idx >= 0) currentIndex.value = idx
      }

      // 3. 推断格式（xmwav是ogg / higequ gmmp3是mp3 / 兜底不指定howler自动嗅探）
      let fmt = undefined
      const url = (resolved.playUrl || '').toLowerCase()
      if (url.includes('.ogg')) fmt = 'ogg'
      else if (url.includes('.mp3')) fmt = 'mp3'
      else if (url.includes('.flac')) fmt = 'flac'
      else if (url.includes('.m4a') || url.includes('.aac')) fmt = 'm4a'
      else if (url.includes('.wav')) fmt = 'wav'
      else if (url.includes('.webm')) fmt = 'webm'

      await initHowl(resolved.playUrl, fmt)
      howl.play()

      // 4. 播放历史 + 最后一首记忆
      pushHistory(resolved, meta)
      saveJSON(LAST_TRACK_KEY, meta)
    } finally {
      isLoading.value = false
    }
  }

  function pushHistory(resolved, meta) {
    const item = {
      sourceId: meta.sourceId,
      onlineType: meta.onlineType,
      title: resolved.title,
      artist: resolved.artist,
      album: resolved.album || '',
      coverUrl: resolved.coverUrl || '',
      at: Date.now()
    }
    const arr = history.value.filter(
      (h) => !(h.sourceId === item.sourceId && h.onlineType === item.onlineType)
    )
    arr.unshift(item)
    history.value = arr.slice(0, 200)
    saveJSON(HISTORY_KEY, history.value)
  }

  function toggle() {
    if (!howl) return
    if (isPlaying.value) howl.pause()
    else howl.play()
  }
  function pause() {
    howl && howl.pause()
  }

  function seek(sec) {
    if (!howl) return
    howl.seek(Math.max(0, sec))
    currentTime.value = sec
  }

  function setVolume(v) {
    volume.value = Math.max(0, Math.min(1, Number(v) || 0))
    if (howl) howl.volume(volume.value)
    Howler.volume(volume.value)
    localStorage.setItem('msctt_vol', String(volume.value))
  }
  // 初始化全局音量
  Howler.volume(volume.value)

  function toggleMode() {
    const order = ['list', 'random', 'single']
    const i = order.indexOf(playMode.value)
    playMode.value = order[(i + 1) % order.length]
    localStorage.setItem('msctt_mode', playMode.value)
  }

  function handleTrackEnd() {
    if (playMode.value === 'single') {
      howl && howl.seek(0)
      howl && howl.play()
      return
    }
    next()
  }

  function next() {
    if (!queue.value.length) return
    let idx
    if (playMode.value === 'random') {
      idx = Math.floor(Math.random() * queue.value.length)
    } else {
      idx = currentIndex.value + 1
      if (idx >= queue.value.length) idx = 0
    }
    const m = queue.value[idx]
    if (m) play(m, queue.value, idx)
  }
  function prev() {
    if (!queue.value.length) return
    let idx
    if (playMode.value === 'random') {
      idx = Math.floor(Math.random() * queue.value.length)
    } else {
      idx = currentIndex.value - 1
      if (idx < 0) idx = queue.value.length - 1
    }
    const m = queue.value[idx]
    if (m) play(m, queue.value, idx)
  }

  // ======== 收藏 ========
  function toggleFavorite() {
    if (!currentMeta.value?.sourceId) return
    const key = `${currentMeta.value.onlineType}#${currentMeta.value.sourceId}`
    const existsIdx = favorites.value.findIndex(
      (f) => `${f.onlineType}#${f.sourceId}` === key
    )
    if (existsIdx >= 0) favorites.value.splice(existsIdx, 1)
    else
      favorites.value.unshift({
        ...currentMeta.value,
        title: currentTrack.value?.title || currentMeta.value.title,
        artist: currentTrack.value?.artist || currentMeta.value.artist,
        album: currentTrack.value?.album || currentMeta.value.album,
        coverUrl: currentTrack.value?.coverUrl || currentMeta.value.coverUrl,
        favAt: Date.now()
      })
    saveJSON(FAVORITES_KEY, favorites.value)
  }
  function removeFavorite(idx) {
    favorites.value.splice(idx, 1)
    saveJSON(FAVORITES_KEY, favorites.value)
  }
  function clearHistory() {
    history.value = []
    saveJSON(HISTORY_KEY, [])
  }

  // 立即同步持久化 queue
  watch(queue, (v) => saveJSON(QUEUE_KEY, v), { deep: true })

  return {
    // state
    currentTrack,
    currentMeta,
    currentIndex,
    queue,
    isPlaying,
    isPaused,
    isLoading,
    currentTime,
    duration,
    volume,
    playMode,
    history,
    favorites,
    lyrics,
    plainLyrics,
    isLyricsSynced,
    activeLyricIndex,
    // computed
    progress,
    currentTimeText,
    durationText,
    isFavorite,
    // methods
    play,
    toggle,
    pause,
    seek,
    setVolume,
    toggleMode,
    next,
    prev,
    toggleFavorite,
    removeFavorite,
    clearHistory
  }
})
