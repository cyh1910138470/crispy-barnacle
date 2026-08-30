// 播放器状态管理（Pinia）
// 负责管理：当前播放、播放队列、播放模式、音量、进度等
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { Howl, Howler } from 'howler'

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
  const wordLyrics = ref([])         // 逐字歌词 [{start, duration, text, words:[{text,start,duration}]}]
  const showLyricsPanel = ref(false) // 是否显示歌词面板
  const showNowPlaying = ref(false)  // 是否显示全屏歌曲详情页
  const desktopLyrics = ref(false)   // 桌面歌词悬浮窗是否开启

  // Howl 实例
  let howl = null
  let progressTimer = null

  // ============ 音频可视化（频谱数据源） ============
  // 从 Howler 共享的 WebAudio 图上接一个 AnalyserNode 旁路抽头（不影响发声）
  let analyser = null
  let spectrumData = null

  function ensureAnalyser() {
    if (analyser) return analyser
    const ctx = Howler.ctx
    const master = Howler.masterGain
    if (!ctx || !master) return null
    try {
      analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.82
      spectrumData = new Uint8Array(analyser.frequencyBinCount)
      master.connect(analyser)
      return analyser
    } catch (e) {
      console.warn('[player] 频谱分析器初始化失败:', e)
      return null
    }
  }

  // 获取当前频谱（Uint8Array，0-255），无可用分析器时返回 null
  function getSpectrum() {
    const a = ensureAnalyser()
    if (!a || !spectrumData) return null
    a.getByteFrequencyData(spectrumData)
    return spectrumData
  }

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
          // 🚨 解码器错误直接弹给用户，不再"哑巴失败"
          try {
            const text = '🎵 播放失败：音频解码/加载出错（可能是缓存损坏或该格式兼容性差），已自动尝试下一个音源，稍等或换首歌吧'
            window.dispatchEvent(new CustomEvent('app:toast', {
              detail: { text, type: 'error', duration: 5000 }
            }))
          } catch (_) { /* ignore */ }
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

  // 解析在线占位条目（搜索/歌手/在线页列表项：无 id、只有 sourceId）
  // 调主进程 playOnline 入库并下载缓存，成功返回带 id 的歌曲
  async function resolveOnlineTrack(track) {
    try {
      const r = await window.mscAPI.playOnline({ ...track })
      if (!r?.ok) {
        window.dispatchEvent(
          new CustomEvent('app:toast', {
            detail: `「${track.title}」播放失败：${r?.error || '未知错误'}`
          })
        )
        return null
      }
      const song = { ...r.song, sourceId: track.sourceId }
      // 附加歌手信息，播放栏歌手名可跳转歌手页
      if (track.singerId) {
        song.singerId = track.singerId
        song.singerSource = track.singerSource || song.singerSource
      }
      return song
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent('app:toast', { detail: `「${track.title}」播放失败：${e.message}` })
      )
      return null
    }
  }

  async function play(track) {
    if (!track) return
    // 队列中的在线占位条目：先解析入库，再用真实歌曲替换占位（上一首/下一首不再重复解析）
    if (!track.id && track.sourceId) {
      const resolved = await resolveOnlineTrack(track)
      if (!resolved) return
      const i = queue.value.indexOf(track)
      if (i >= 0) queue.value[i] = resolved
      track = resolved
    }
    stop()
    currentTrack.value = track
    currentTime.value = 0
    duration.value = track.duration || 0

    // 重置歌词
    lyrics.value = []
    plainLyrics.value = null
    isLyricsSynced.value = false
    wordLyrics.value = []

    // 通过 IPC 获取 base64 Data URL（绕过 file:// 协议限制）
    const dataUrl = await window.mscAPI.getAudioDataUrl(track.id)
    if (!dataUrl) {
      console.error('[player] 无法获取音频数据:', track.id)
      // 通知全局 toast（App.vue 监听）：缓存缺失且无法从音源重新获取
      window.dispatchEvent(
        new CustomEvent('app:toast', {
          detail: `「${track.title}」播放失败：文件缺失，且音源未配置或不可用`
        })
      )
      return
    }

    // 异步加载歌词
    loadLyrics(track.id)

    const format = track.format || 'mp3'
    try {
      await initHowl(dataUrl, format)
      howl.play()
      // 记录到播放历史（fire-and-forget，失败不影响播放）
      window.mscAPI.recordHistory?.(track.id)
      // 当前歌已开播：后台静默预解析队列下一首在线占位（提前下载缓存），切歌秒开
      prefetchNextOnline()
    } catch (e) {
      console.error('[player] 播放失败:', e)
    }
  }

  // 静默预解析队列里当前歌的下一首在线占位（fire-and-forget，不弹 toast、不动播放状态）
  // 提前在主进程下载缓存；等 playNext 轮到它时 prepareOnlineSong 命中本地缓存直接秒开
  function prefetchNextOnline() {
    try {
      if (playMode.value === 'random') return // 随机模式下一首不可预知，不预取
      const next = queue.value[currentIndex.value + 1]
      if (!next || next.id || !next.sourceId) return
      window.mscAPI
        .playOnline({ ...next })
        .then((r) => {
          if (!r?.ok) return
          const i = queue.value.indexOf(next)
          if (i >= 0) queue.value[i] = { ...r.song, sourceId: next.sourceId }
        })
        .catch(() => {})
    } catch {}
  }

  async function loadLyrics(trackId) {
    try {
      const result = await window.mscAPI.getLyrics(trackId)
      if (result) {
        lyrics.value = result.lyrics || []
        plainLyrics.value = result.plainText || null
        isLyricsSynced.value = result.synced || false
        wordLyrics.value = result.wordLyrics || []
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

  function toggleNowPlaying() {
    showNowPlaying.value = !showNowPlaying.value
  }

  // ============ 桌面歌词 ============

  // 开关桌面歌词悬浮窗（状态由主进程返回为准）
  async function setDesktopLyrics(on) {
    try {
      const enabled = await window.mscAPI.setDesktopLyrics(on)
      desktopLyrics.value = !!enabled
    } catch (e) {
      console.warn('[player] 桌面歌词切换失败:', e)
    }
  }

  // 二分查找当前时间对应的歌词行
  function findLyricIdx(time) {
    let lo = 0
    let hi = lyrics.value.length - 1
    let idx = -1
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      if (lyrics.value[mid].time <= time) {
        idx = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return idx
  }

  // 实时把当前歌词行推送给桌面歌词悬浮窗
  // 有逐字歌词时推送 words 数组（每字精确时间），悬浮窗做逐字级卡拉OK填色
  // 无逐字歌词时仅带行起止时间，悬浮窗按加权估算
  watch([currentTime, lyrics, wordLyrics, isPlaying, desktopLyrics], () => {
    if (!desktopLyrics.value || !window.mscAPI?.updateDesktopLyrics) return
    const t = currentTime.value
    let payload = { text: '', next: '', playing: isPlaying.value, lineStart: 0, lineEnd: 0, time: t, words: [] }

    // 优先走逐字歌词
    if (currentTrack.value && wordLyrics.value.length > 0) {
      const wIdx = findLyricIdxIn(wordLyrics.value, t)
      if (wIdx >= 0) {
        const line = wordLyrics.value[wIdx]
        const wEnd = line.start + line.duration
        payload.text = line.text
        payload.lineStart = line.start
        payload.lineEnd = wEnd
        payload.words = line.words || []
        const nIdx = wIdx + 1
        if (nIdx < wordLyrics.value.length) payload.next = wordLyrics.value[nIdx].text
      }
    } else if (currentTrack.value && lyrics.value.length > 0) {
      const idx = findLyricIdx(t)
      if (idx >= 0) {
        payload.text = lyrics.value[idx].text
        payload.lineStart = lyrics.value[idx].time
        // 行结束时间 = 下一行开始时间；最后一行按 6 秒估算
        payload.lineEnd = idx + 1 < lyrics.value.length ? lyrics.value[idx + 1].time : payload.lineStart + 6
        if (idx + 1 < lyrics.value.length) payload.next = lyrics.value[idx + 1].text
      }
    }
    try {
      // 必须深拷贝为纯 JSON：payload.words 里含 Vue reactive 代理，直接发送会触发 IPC 克隆错误
      window.mscAPI.updateDesktopLyrics(JSON.parse(JSON.stringify(payload)))
    } catch (e) {
      console.warn('[player] 桌面歌词推送失败:', e?.message)
    }
  })

  // 主进程后台补拉到逐字歌词后推送过来（首次播放时可能还没拉到，拉到后即时生效）
  if (window.mscAPI?.onWordLyrics) {
    window.mscAPI.onWordLyrics((data) => {
      if (data?.songId && data.wordLyrics?.length && currentTrack.value?.id === data.songId) {
        wordLyrics.value = data.wordLyrics
      }
    })
  }

  // 通用二分查找：lines 需按时间升序（兼容 time / start 两种字段名）
  function findLyricIdxIn(lines, time) {
    let lo = 0
    let hi = lines.length - 1
    let idx = -1
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      const lineTime = lines[mid].time ?? lines[mid].start ?? 0
      if (lineTime <= time) {
        idx = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return idx
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

  // 从队列移除单曲；若移除的是当前播放的歌则停止播放
  function removeQueueItem(index) {
    if (index < 0 || index >= queue.value.length) return
    const isCurrent = index === currentIndex.value
    queue.value.splice(index, 1)
    if (index < currentIndex.value) {
      // 移除的歌在当前歌前面：指针前移保持指向同一首歌
      currentIndex.value--
    } else if (isCurrent) {
      // 移除的是正在播放的歌：停止并清空当前歌
      stop()
      currentIndex.value = Math.min(index, queue.value.length - 1)
      currentTrack.value = null
    }
    // 移除的歌在当前歌后面：指针不变
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

  // ============ 系统媒体集成（Windows SMTC + 托盘/媒体键）============
  function bindSystemMedia() {
    if (bindSystemMedia._done || typeof window === 'undefined') return
    bindSystemMedia._done = true

    // 1) 全局媒体键 / 托盘菜单 → 播放控制
    window.mscAPI?.onMediaControl?.((action) => {
      if (action === 'toggle') togglePlay()
      else if (action === 'next') playNext()
      else if (action === 'prev') playPrev()
    })

    // 2) Windows 系统媒体控件（SMTC）：音量弹窗/锁屏显示歌曲信息并可控
    const ms = navigator.mediaSession
    if (ms) {
      try {
        ms.setActionHandler('play', () => { if (!isPlaying.value) togglePlay() })
        ms.setActionHandler('pause', () => { if (isPlaying.value) togglePlay() })
        ms.setActionHandler('previoustrack', () => playPrev())
        ms.setActionHandler('nexttrack', () => playNext())
      } catch {}
    }

    // 3) 歌曲或播放状态变化 → 同步元数据
    const syncMeta = async () => {
      const t = currentTrack.value
      const title = t?.title || '未在播放'
      const artist = t?.artist || ''
      try {
        if (ms) {
          if (t && typeof MediaMetadata !== 'undefined') {
            let artwork
            try {
              const cover = await window.mscAPI?.getCoverDataUrl?.(t.id)
              if (cover) artwork = [{ src: cover, sizes: '512x512', type: 'image/png' }]
            } catch {}
            ms.metadata = new MediaMetadata({ title, artist, album: t.album || '', artwork })
          }
          ms.playbackState = isPlaying.value ? 'playing' : 'paused'
        }
      } catch {}
      window.mscAPI?.updateMediaMeta?.({ title, artist, isPlaying: isPlaying.value })
    }

    watch(currentTrack, syncMeta)
    watch(isPlaying, syncMeta)
  }
  bindSystemMedia()

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
    wordLyrics,
    showLyricsPanel,
    showNowPlaying,
    desktopLyrics,
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
    removeQueueItem,
    clearQueue,
    toggleQueue,
    loadLyrics,
    toggleLyricsPanel,
    toggleNowPlaying,
    setDesktopLyrics,
    getSpectrum,
    formatTime
  }
})
