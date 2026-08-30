<template>
  <div class="lyrics-panel" ref="panelRef">
    <!-- 空状态 -->
    <div v-if="!hasLyrics" class="lyrics-empty">
      <svg viewBox="0 0 24 24" width="48" height="48">
        <path fill="currentColor" d="M4 4h16v2H4zm0 5h12v2H4zm0 5h16v2H4zm0 5h8v2H4z" opacity="0.3"/>
      </svg>
      <div class="empty-text">{{ emptyText }}</div>
    </div>

    <!-- 同步歌词 -->
    <div v-else-if="isSynced" class="lyrics-synced" ref="lyricsContainerRef">
      <div
        v-for="(line, index) in lyrics"
        :key="index"
        class="lyric-line"
        :class="{ active: index === currentIndex }"
        :data-index="index"
        @click="handleLineClick(line)"
      >
        {{ line.text }}
      </div>
    </div>

    <!-- 纯文本歌词 -->
    <div v-else class="lyrics-plain">
      <div v-for="(line, index) in plainLines" :key="index" class="lyric-line">
        {{ line }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'

const props = defineProps({
  lyrics: { type: Array, default: () => [] },
  plainText: { type: String, default: null },
  synced: { type: Boolean, default: false },
  currentTime: { type: Number, default: 0 },
  trackId: { type: Number, default: null }
})

const panelRef = ref(null)
const lyricsContainerRef = ref(null)
const currentIndex = ref(-1)

const isSynced = computed(() => props.synced && props.lyrics.length > 0)
const hasLyrics = computed(() => {
  if (props.synced && props.lyrics.length > 0) return true
  if (props.plainText) return true
  return false
})

const emptyText = computed(() => {
  if (!props.trackId) return '选择歌曲开始播放'
  return '暂无歌词'
})

const plainLines = computed(() => {
  if (!props.plainText) return []
  return props.plainText.split(/\r?\n/)
})

// 二分查找当前时间对应的歌词行
function findCurrentIndex(time) {
  if (!props.lyrics || props.lyrics.length === 0) return -1
  let lo = 0
  let hi = props.lyrics.length - 1
  let idx = -1
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (props.lyrics[mid].time <= time) {
      idx = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return idx
}

// 滚动到当前行
function scrollToIndex(index) {
  if (!lyricsContainerRef.value || index < 0) return
  const container = lyricsContainerRef.value
  const lineEl = container.children[index]
  if (!lineEl) return

  const containerH = container.clientHeight
  const lineTop = lineEl.offsetTop
  const lineH = lineEl.offsetHeight
  // 计算目标滚动位置：让当前行居中
  const targetScroll = lineTop - containerH / 2 + lineH / 2

  container.scrollTo({
    top: Math.max(0, targetScroll),
    behavior: 'smooth'
  })
}

// 点击某一行歌词跳转到对应时间
function handleLineClick(line) {
  if (props.synced && window.mscAPI) {
    // 通知父组件跳转（通过事件）
    emit('seekTo', line.time)
  }
}

const emit = defineEmits(['seekTo'])

// 监听当前时间变化，更新高亮和滚动
watch(() => props.currentTime, (time) => {
  if (!props.synced || props.lyrics.length === 0) return
  const idx = findCurrentIndex(time)
  if (idx !== currentIndex.value) {
    currentIndex.value = idx
    nextTick(() => scrollToIndex(idx))
  }
})

// 监听歌词数据变化
watch(() => props.lyrics, () => {
  currentIndex.value = -1
  nextTick(() => {
    if (props.currentTime > 0) {
      const idx = findCurrentIndex(props.currentTime)
      currentIndex.value = idx
      scrollToIndex(idx)
    } else if (props.lyrics.length > 0) {
      // 滚动到顶部
      if (lyricsContainerRef.value) {
        lyricsContainerRef.value.scrollTo({ top: 0 })
      }
    }
  })
}, { deep: true })

// 监听歌曲切换
watch(() => props.trackId, () => {
  currentIndex.value = -1
  nextTick(() => {
    if (lyricsContainerRef.value) {
      lyricsContainerRef.value.scrollTo({ top: 0 })
    }
  })
})
</script>

<style scoped>
.lyrics-panel {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background: var(--bg-surface, #191919);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
}

/* 空状态 */
.lyrics-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary, #888);
}

.lyrics-empty svg {
  opacity: 0.4;
}

.empty-text {
  font-size: 14px;
}

/* 同步歌词 */
.lyrics-synced {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 40px 20px;
  scroll-behavior: smooth;
  mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
}

.lyric-line {
  text-align: center;
  padding: 8px 16px;
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-tertiary, #666);
  transition: color 0.25s ease, transform 0.25s ease, font-weight 0.25s ease;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lyric-line:hover {
  color: var(--text-secondary, #aaa);
}

.lyric-line.active {
  color: var(--accent);
  font-size: 18px;
  font-weight: 600;
  transform: scale(1.05);
  text-shadow: 0 0 20px rgba(var(--accent-rgb), 0.4);
}

/* 纯文本歌词 */
.lyrics-plain {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  text-align: center;
}

.lyrics-plain .lyric-line {
  color: var(--text-secondary, #aaa);
  cursor: default;
}

.lyrics-plain .lyric-line:hover {
  color: var(--text-secondary, #aaa);
}

/* 自定义滚动条 */
.lyrics-synced::-webkit-scrollbar,
.lyrics-plain::-webkit-scrollbar {
  width: 4px;
}

.lyrics-synced::-webkit-scrollbar-track,
.lyrics-plain::-webkit-scrollbar-track {
  background: transparent;
}

.lyrics-synced::-webkit-scrollbar-thumb,
.lyrics-plain::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}
</style>
