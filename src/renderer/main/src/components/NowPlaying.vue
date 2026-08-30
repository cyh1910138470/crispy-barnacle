<template>
  <div class="now-playing">
    <!-- 背景：封面模糊放大填充 -->
    <div class="np-bg" :style="coverUrl ? { backgroundImage: 'url(' + coverUrl + ')' } : null"></div>
    <div class="np-bg-mask"></div>

    <!-- 顶部收起按钮 -->
    <button class="np-collapse" title="收起详情页" @click="player.toggleNowPlaying()">
      <svg viewBox="0 0 24 24" width="20" height="20"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 9l7 7 7-7"/></svg>
    </button>

    <!-- 底部频谱可视化 -->
    <canvas v-if="player.currentTrack" ref="spectrumCanvas" class="np-spectrum"></canvas>

    <!-- 空状态 -->
    <div v-if="!player.currentTrack" class="np-empty">当前没有播放中的歌曲</div>

    <div v-else class="np-content">
      <!-- 左侧：黑胶唱片机 -->
      <div class="np-vinyl-area">
        <div class="np-vinyl-pad">
          <div class="np-disc" :class="{ paused: !player.isPlaying }">
            <div class="np-disc-grooves"></div>
            <img
              v-if="coverUrl && !isBroken('now')"
              class="np-disc-cover"
              :src="coverUrl"
              alt=""
              draggable="false"
              referrerpolicy="no-referrer"
              @error="e => onCoverError(e, 'now', () => (coverUrl.value = null))"
            />
            <div v-else class="np-disc-cover np-cover-fallback">
              <svg viewBox="0 0 24 24" width="40" height="40"><path fill="currentColor" d="M12 3v9.55A4 4 0 1014 16V7h4V3z"/></svg>
            </div>
            <div class="np-disc-hole"></div>
          </div>
        </div>
        <!-- 唱针：播放时搭在唱片上，暂停时抬起 -->
        <div class="np-tonearm" :class="{ playing: player.isPlaying }">
          <div class="np-arm-pivot"></div>
          <div class="np-arm-rod"></div>
          <div class="np-arm-head"></div>
        </div>
      </div>

      <!-- 右侧：歌曲信息 + 歌词 -->
      <div class="np-info">
        <div class="np-title">{{ player.currentTrack.title }}</div>
        <div class="np-artist">{{ player.currentTrack.artist || '未知艺人' }}</div>
        <div class="np-lyrics">
          <LyricsPanel
            :lyrics="player.lyrics"
            :plain-text="player.plainLyrics"
            :synced="player.isLyricsSynced"
            :current-time="player.currentTime"
            :track-id="player.currentTrack.id"
            @seek-to="handleSeek"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useCover } from '../composables/useCover'
import LyricsPanel from './LyricsPanel.vue'

const player = usePlayerStore()
const { isBroken, resetBrokenKey, onCoverError } = useCover()
const coverUrl = ref(null)

// 加载当前歌曲的封面
watch(() => player.currentTrack?.id, async (id) => {
  resetBrokenKey('now')
  coverUrl.value = null
  if (!id || !window.mscAPI?.getCoverDataUrl) return
  coverUrl.value = await window.mscAPI.getCoverDataUrl(id)
}, { immediate: true })

function handleSeek(time) {
  if (!player.duration) return
  // seek 接收百分比（0-100），歌词行时间需要先换算
  player.seek((time / player.duration) * 100)
}

// Esc 键收起详情页
function onKeydown(e) {
  if (e.key === 'Escape' && player.showNowPlaying) {
    player.toggleNowPlaying()
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// ============ 频谱可视化 ============
const spectrumCanvas = ref(null)
const BAR_COUNT = 56
const TOP_BINS = 96 // 只取低中频段（高频多为空，浪费宽度）
let rafId = 0
let barHeights = new Float32Array(BAR_COUNT)

function drawSpectrum() {
  rafId = requestAnimationFrame(drawSpectrum)
  const canvas = spectrumCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const W = canvas.clientWidth
  const H = canvas.clientHeight
  if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
    canvas.width = W * dpr
    canvas.height = H * dpr
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)

  const spec = player.getSpectrum()
  const barW = W / BAR_COUNT
  const gap = Math.max(2, barW * 0.28)
  const bw = barW - gap

  for (let i = 0; i < BAR_COUNT; i++) {
    let target = 0
    if (spec) {
      // 对数取样：低频密集高频稀疏，让条形分布更均匀
      const from = Math.floor(Math.pow(i / BAR_COUNT, 1.6) * TOP_BINS)
      const to = Math.max(from + 1, Math.floor(Math.pow((i + 1) / BAR_COUNT, 1.6) * TOP_BINS))
      let sum = 0
      for (let b = from; b < to; b++) sum += spec[b] || 0
      target = Math.pow(sum / (to - from) / 255, 0.8) * H
    }
    // 缓动：上升快、下落慢，视觉更自然
    barHeights[i] = target > barHeights[i] ? barHeights[i] + (target - barHeights[i]) * 0.5 : barHeights[i] + (target - barHeights[i]) * 0.18
    const h = Math.max(2, barHeights[i])
    const x = i * barW + gap / 2
    const y = H - h
    const grad = ctx.createLinearGradient(0, y, 0, H)
    grad.addColorStop(0, 'rgba(126, 240, 173, 0.95)')
    grad.addColorStop(1, 'rgba(29, 185, 84, 0.35)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.roundRect(x, y, bw, h, Math.min(3, bw / 2))
    ctx.fill()
  }
}

onMounted(() => {
  drawSpectrum()
})
onBeforeUnmount(() => cancelAnimationFrame(rafId))
</script>

<style scoped>
.now-playing {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 56px; /* 留出底部播放栏 */
  z-index: 200;
  overflow: hidden;
  background: var(--bg-base, #141414);
}

/* ---- 背景 ---- */
.np-bg {
  position: absolute;
  inset: -80px;
  background-size: cover;
  background-position: center;
  filter: blur(90px) brightness(0.5) saturate(1.3);
  transform: scale(1.2);
}

.np-bg-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.5));
}

/* ---- 收起按钮 ---- */
.np-collapse {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 5;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

/* ---- 底部频谱可视化 ---- */
.np-spectrum {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: 18px;
  width: min(920px, 72vw);
  height: 64px;
  z-index: 4;
  pointer-events: none;
  opacity: 0.9;
}

.np-collapse:hover {
  background: rgba(255, 255, 255, 0.24);
}

/* ---- 空状态 ---- */
.np-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #999);
  font-size: 15px;
}

/* ---- 主内容 ---- */
.np-content {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 72px;
  padding: 48px 64px;
}

/* ---- 黑胶唱片机 ---- */
.np-vinyl-area {
  position: relative;
  width: 380px;
  height: 380px;
  flex-shrink: 0;
}

.np-vinyl-pad {
  width: 100%;
  height: 100%;
  border-radius: 28px;
  background: linear-gradient(145deg, #fdfdfd, #e7e7ec);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.np-disc {
  position: relative;
  width: 76%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, #222 0%, #0d0d0d 55%, #050505 100%);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: np-spin 22s linear infinite;
}

.np-disc.paused {
  animation-play-state: paused;
}

.np-disc-grooves {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: repeating-radial-gradient(circle at center, transparent 0 6px, rgba(255, 255, 255, 0.035) 6px 7px);
}

.np-disc-cover {
  width: 52%;
  aspect-ratio: 1;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.08);
}

.np-cover-fallback {
  background: linear-gradient(135deg, #3a3a3a, #5a5a5a);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}

.np-disc-hole {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #dcdce0;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
}

@keyframes np-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---- 唱针 ---- */
.np-tonearm {
  position: absolute;
  top: -20px;
  right: -4px;
  width: 140px;
  height: 140px;
  transform-origin: 24px 24px;
  transform: rotate(-24deg);
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 3;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.4));
}

.np-tonearm.playing {
  transform: rotate(4deg);
}

.np-arm-pivot {
  position: absolute;
  top: 0;
  left: 0;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #f6f6f8, #b9b9c2 70%, #8f8f99);
}

.np-arm-rod {
  position: absolute;
  top: 21px;
  left: 22px;
  width: 95px;
  height: 7px;
  border-radius: 4px;
  background: linear-gradient(to bottom, #ececf1, #b3b3bd);
  transform: rotate(36deg);
  transform-origin: left center;
}

.np-arm-head {
  position: absolute;
  top: 72px;
  left: 94px;
  width: 20px;
  height: 30px;
  border-radius: 6px;
  background: linear-gradient(to bottom, #dcdce2, #a2a2ac);
}

/* ---- 右侧信息 ---- */
.np-info {
  flex: 1;
  max-width: 560px;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 56px 0 24px;
}

.np-title {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.np-artist {
  margin-top: 8px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.72);
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.3);
}

.np-lyrics {
  flex: 1;
  min-height: 0;
  margin-top: 18px;
}

/* 歌词面板融入详情页背景 */
.np-lyrics :deep(.lyrics-panel) {
  background: transparent;
}

.np-lyrics :deep(.lyric-line) {
  color: rgba(255, 255, 255, 0.45);
}

.np-lyrics :deep(.lyric-line:hover) {
  color: rgba(255, 255, 255, 0.75);
}

.np-lyrics :deep(.lyric-line.active) {
  color: var(--accent);
}

/* 响应式：窄窗口缩小唱片 */
@media (max-width: 980px) {
  .np-content {
    gap: 40px;
    padding: 40px 32px;
  }

  .np-vinyl-area {
    width: 280px;
    height: 280px;
  }

  .np-title {
    font-size: 22px;
  }
}
</style>
