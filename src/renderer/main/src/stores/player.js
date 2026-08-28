// 播放器状态管理（Pinia）
// 负责管理：当前播放、播放队列、播放模式、音量、进度等
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { Howl } from 'howler'

export const usePlayerStore = defineStore('player', () => {
  // 状态
  const currentTrack = ref(null)     // 当前播放的歌曲对象
  const currentIndex = ref(-1)       // 当前歌曲在队列中的索引
  const queue = ref([])              // 播放队列 [{id, title, artist, ...}]
  const isPlaying = ref(false)
  const isPaused = ref(false)
  const currentTime = ref(0)          // 当前播放时间（秒）
  const duration = ref(0)            // 歌曲总时长（秒）
  const volume = ref(1)              // 音量 0~1
  const playMode = ref('list')       // list / random / single
  const showQueue = ref(false)
  // 歌词状态
  const lyrics = ref([])             // [{time, text}] 解析后的同步歌词
  const plainLyrics = ref(null)      // 纯文本歌词（无时间戳）
  const isLyricsSynced = ref(false)  // 歌词是否有时间戳（同步）
  const showLyricsPanel = ref(false) // 是否显示歌词面板

  // Howl 实例
  let howl = null
  let progressTimer = null

  // 计算属性
  const progress = computed(() => {
    return duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0
  })

  const currentTimeText = computed(() => formatTime(currentTime.value))
  const durationText = computed(() => formatTime(duration.value))

  // 方法
  function initHowl(src, format) {
    destroyHowl()
    return new Promise((resolve, reject) => {
      const options = {
        src: [src],
        volume: volume.value,
        onload: () => {
          duration.value = howl.duration()
          resolve()
        },
        onplay: () => {
          isPlaying.value = true
          isPaused.value = false
          startProgressTimer()
        },
        onpause: () => {
          isPlaying.value = false
          isPaused.value = true
          stopProgressTimer()
        },
        onstop: () => {
          isPlaying.value = false
          isPaused.value = false
          stopProgressTimer()
        },
        onend: () => {
          handleTrackEnd()
        },
        onerror: (id, err) => {
          console.error('[player] Howler 错误:', err)
          reject(err)
        }
      }
      // 显式指定音频格式，帮助 Howler 正确解析
      if (format) {
        options.format = [format]
      }
      howl = new Howl(options)
    })
  }

  function destroyHowl() {
    if (howl) {
      howl.stop()
      howl.unload()
      howl = null
    }
  }

  function startProgressTimer() {
    stopProgressTimer()
    progressTimer = setInterval(() => {
      if (howl && isPlaying.value) {
        currentTime.value = howl.seek() || 0
      }
    }, 250)
  }

  function stopProgressTimer() {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
  }

  async function play(track) {
    if (!track) return
    stop()
    currentTrack.value = track
    currentTime.value = 0
    duration.value = track.duration || 0

    // 重置歌词
    lyrics.value = []
    plainLyrics.value = null
    isLyricsSynced.value = false

    // 通过 IPC 获取 base64 Data URL（绕过 file:// 协议限制）
    const dataUrl = await window.mscAPI.getAudioDataUrl(track.id)
    if (!dataUrl) {
      console.error('[player] 无法获取音频数据:', track.id)
      return
    }

    // 异步加载歌词
    loadLyrics(track.id)

    const format = track.format || 'mp3'
    try {
      await initHowl(dataUrl, format)
      howl.play()
    } catch (e) {
      console.error('[player] 播放失败:', e)
    }
  }

  async function loadLyrics(trackId) {
    try {
      const result = await window.mscAPI.getLyrics(trackId)
      if (result) {
        lyrics.value = result.lyrics || []
        plainLyrics.value = result.plainText || null
        isLyricsSynced.value = result.synced || false
      }
    } catch (e) {
      console.warn('[player] 加载歌词失败:', e.message)
      lyrics.value = []
      plainLyrics.value = null
      isLyricsSynced.value = false
    }
  }

  function toggleLyricsPanel() {
    showLyricsPanel.value = !showLyricsPanel.value
  }

  function playIndex(index) {
    if (index < 0 || index >= queue.value.length) return
    currentIndex.value = index
    play(queue.value[index])
  }

  function playNext() {
    if (queue.value.length === 0) return
    let nextIndex
    if (playMode.value === 'single') {
      // 单曲循环：重播当前
      play(currentTrack.value)
      return
    } else if (playMode.value === 'random') {
      nextIndex = Math.floor(Math.random() * queue.value.length)
    } else {
      nextIndex = currentIndex.value + 1
      if (nextIndex >= queue.value.length) nextIndex = 0
    }
    playIndex(nextIndex)
  }

  function playPrev() {
    if (queue.value.length === 0) return
    let prevIndex
    if (playMode.value === 'single') {
      play(currentTrack.value)
      return
    } else if (playMode.value === 'random') {
      prevIndex = Math.floor(Math.random() * queue.value.length)
    } else {
      prevIndex = currentIndex.value - 1
      if (prevIndex < 0) prevIndex = queue.value.length - 1
    }
    playIndex(prevIndex)
  }

  function togglePlay() {
    if (!howl) return
    if (isPlaying.value) {
      howl.pause()
    } else {
      howl.play()
    }
  }

  function pause() {
    if (howl) howl.pause()
  }

  function stop() {
    destroyHowl()
    currentTime.value = 0
    duration.value = 0
    isPlaying.value = false
    isPaused.value = false
  }

  function seek(percent) {
    if (!howl) return
    const seekTime = (percent / 100) * duration.value
    howl.seek(seekTime)
    currentTime.value = seekTime
  }

  function setVolume(val) {
    volume.value = Math.max(0, Math.min(1, val))
    if (howl) howl.volume(volume.value)
  }

  function setPlayMode(mode) {
    playMode.value = mode
  }

  function handleTrackEnd() {
    if (playMode.value === 'single') {
      // 单曲循环：重新播放
      play(currentTrack.value)
    } else {
      playNext()
    }
  }

  function setQueue(tracks, startIndex = 0) {
    queue.value = tracks
    if (tracks.length > 0) {
      playIndex(startIndex)
    }
  }

  function addToQueue(track) {
    queue.value.push(track)
  }

  function clearQueue() {
    stop()
    queue.value = []
    currentIndex.value = -1
    currentTrack.value = null
  }

  function toggleQueue() {
    showQueue.value = !showQueue.value
  }

  // 格式化时间
  function formatTime(sec) {
    if (!sec || isNaN(sec)) return '00:00'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return {
    // 状态
    currentTrack,
    currentIndex,
    queue,
    isPlaying,
    isPaused,
    currentTime,
    duration,
    volume,
    playMode,
    showQueue,
    // 歌词状态
    lyrics,
    plainLyrics,
    isLyricsSynced,
    showLyricsPanel,
    // 计算
    progress,
    currentTimeText,
    durationText,
    // 方法
    play,
    playIndex,
    playNext,
    playPrev,
    togglePlay,
    pause,
    stop,
    seek,
    setVolume,
    setPlayMode,
    setQueue,
    addToQueue,
    clearQueue,
    toggleQueue,
    loadLyrics,
    toggleLyricsPanel,
    formatTime
  }
})
