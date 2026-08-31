<template>
  <div class="player-page">
    <!-- 背景模糊大图 -->
    <div class="bg-img" v-if="cover">
      <img :src="cover" alt="" />
      <div class="bg-mask"></div>
    </div>
    <div class="bg-fallback" v-else></div>

    <div class="container">
      <!-- 专辑封面（旋转） -->
      <div class="cover-wrap" :class="{ rotate: player.isPlaying }">
        <div class="cover-inner">
          <img v-if="cover" :src="cover" alt="" />
          <div v-else class="cover-placeholder">
            <var-icon name="music-note" size="72" color="#31c27c" />
          </div>
          <div class="cover-hole"></div>
        </div>
      </div>

      <!-- 标题歌手 -->
      <div class="song-meta">
        <div class="title ellipsis" :title="title">{{ title }}</div>
        <div class="artist ellipsis" :title="artist">{{ artist }} · {{ album || '未知专辑' }}</div>
      </div>

      <!-- 歌词 / 封面 切换区（我们默认展示歌词，同步歌词自动滚动，纯文本用滚动 div） -->
      <div class="lyrics-wrap scroll-y no-scrollbar" ref="lrcBox" @click="showLrc = !showLrc">
        <template v-if="player.isLyricsSynced && player.lyrics.length">
          <div class="synced">
            <div
              v-for="(ln, idx) in player.lyrics"
              :key="idx"
              class="lrc-line"
              :class="{ active: idx === player.activeLyricIndex, near: Math.abs(idx - player.activeLyricIndex) <= 2 }"
            >
              {{ ln.text }}
            </div>
          </div>
        </template>
        <template v-else-if="player.plainLyrics">
          <div class="plain">{{ player.plainLyrics }}</div>
        </template>
        <template v-else-if="player.isLoading">
          <div class="empty">
            <var-icon name="loading" transition="rotate" size="28" color="#31c27c" />
            <p>解析歌词中...</p>
          </div>
        </template>
        <template v-else>
          <div class="empty">
            <var-icon name="file-document-outline" size="40" color="#4a535b" />
            <p>该源暂未提供歌词</p>
          </div>
        </template>
      </div>

      <!-- 进度/时间 -->
      <div class="progress-row">
        <span class="t">{{ player.currentTimeText }}</span>
        <div class="progress" @click="onSeekClick">
          <div class="progress-bg"></div>
          <div class="progress-fill" :style="{ width: player.progress + '%' }">
            <div class="thumb"></div>
          </div>
          <div class="progress-input" ref="seekRef"></div>
        </div>
        <span class="t">{{ player.durationText }}</span>
      </div>

      <!-- 控制按钮 -->
      <div class="controls">
        <div class="mode-btn" @click="player.toggleMode()">
          <var-icon :name="modeIcon" size="22" color="#a7b0b7" />
        </div>
        <div class="prev-btn" @click="player.prev()">
          <var-icon name="skip-previous" size="30" color="#fff" />
        </div>
        <div class="play-btn" @click="player.toggle()">
          <var-icon
            v-if="player.isLoading"
            name="loading"
            transition="rotate"
            size="32"
            color="#fff"
          />
          <var-icon v-else-if="player.isPlaying" name="pause" size="36" color="#fff" />
          <var-icon v-else name="play" size="40" color="#fff" style="margin-left: 4px" />
        </div>
        <div class="next-btn" @click="player.next()">
          <var-icon name="skip-next" size="30" color="#fff" />
        </div>
        <div class="fav-btn" @click="player.toggleFavorite()">
          <var-icon
            :name="player.isFavorite ? 'heart' : 'heart-outline'"
            size="22"
            :color="player.isFavorite ? '#ff4d4f' : '#a7b0b7'"
          />
        </div>
      </div>

      <!-- 音量 -->
      <div class="vol-row">
        <var-icon name="volume-medium" size="18" color="#6b7680" />
        <input
          type="range"
          min="0"
          max="100"
          :value="Math.round(player.volume * 100)"
          @input="(e) => player.setVolume(Number(e.target.value) / 100)"
          class="vol-slider"
        />
        <var-icon name="volume-high" size="18" color="#6b7680" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { usePlayerStore } from '@shared/stores/player'

const player = usePlayerStore()
const showLrc = ref(true)
const lrcBox = ref(null)

const title = computed(() => player.currentTrack?.title || player.currentMeta?.title || '未在播放')
const artist = computed(() => player.currentTrack?.artist || player.currentMeta?.artist || '')
const album = computed(() => player.currentTrack?.album || player.currentMeta?.album || '')
const cover = computed(() => player.currentTrack?.coverUrl || player.currentMeta?.coverUrl || '')

const modeIcon = computed(() => {
  switch (player.playMode) {
    case 'random':
      return 'shuffle'
    case 'single':
      return 'repeat-once'
    default:
      return 'repeat'
  }
})

// 点击进度条 seek
function onSeekClick(e) {
  if (!player.duration) return
  const rect = e.currentTarget.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  player.seek(ratio * player.duration)
}

// 同步歌词自动滚动到当前行
watch(
  () => player.activeLyricIndex,
  (idx) => {
    if (idx < 0 || !lrcBox.value) return
    nextTick(() => {
      const lines = lrcBox.value.querySelectorAll('.lrc-line')
      const cur = lines[idx]
      if (cur) {
        const boxH = lrcBox.value.clientHeight
        const targetTop =
          cur.offsetTop - boxH / 2 + cur.offsetHeight / 2
        lrcBox.value.scrollTo({
          top: Math.max(0, targetTop),
          behavior: 'smooth'
        })
      }
    })
  }
)
</script>

<style scoped>
.player-page {
  position: fixed;
  inset: 0;
  overflow: hidden;
  z-index: 100;
  background: #000;
  color: #fff;
  display: flex;
  flex-direction: column;
}

/* 背景图 */
.bg-img {
  position: absolute;
  inset: 0;
  z-index: 0;
  filter: blur(38px) brightness(0.4) saturate(1.2);
  transform: scale(1.2);
}
.bg-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.bg-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.25) 0%,
    rgba(14, 20, 24, 0.85) 70%,
    rgba(14, 20, 24, 0.98) 100%
  );
}
.bg-fallback {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 0%, rgba(49, 194, 124, 0.22), #0e1418 55%, #000 100%);
}

.container {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: calc(64px + var(--safe-top)) 24px calc(40px + var(--safe-bottom)) 24px;
  gap: 14px;
}

/* 封面 */
.cover-wrap {
  flex-shrink: 0;
  width: 48vw;
  max-width: 240px;
  height: 48vw;
  max-height: 240px;
  margin: 4px auto 0;
  border-radius: 50%;
  background: radial-gradient(circle at center, #222, #000 70%);
  padding: 8px;
  box-shadow: 0 10px 38px rgba(0, 0, 0, 0.7);
}
.cover-wrap.rotate {
  animation: spin 16s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0); }
  to { transform: rotate(360deg); }
}
.cover-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
}
.cover-inner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cover-placeholder {
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at 30% 30%, #208854, #0e1418 70%);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cover-hole {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 26%;
  height: 26%;
  border-radius: 50%;
  background: #0a0f12;
  transform: translate(-50%, -50%);
  border: 4px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 0 0 6px rgba(49, 194, 124, 0.2);
}

/* 标题 */
.song-meta {
  text-align: center;
  margin-top: 4px;
}
.song-meta .title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.song-meta .artist {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* 歌词 */
.lyrics-wrap {
  flex: 1;
  min-height: 140px;
  max-height: 40vh;
  text-align: center;
  padding: 14px 6px;
  mask-image: linear-gradient(180deg, transparent, #000 20%, #000 80%, transparent);
}
.synced {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 40% 0;
}
.lrc-line {
  font-size: 13px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.35);
  transition: color 0.2s, transform 0.2s;
}
.lrc-line.near {
  color: rgba(255, 255, 255, 0.65);
}
.lrc-line.active {
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  transform: scale(1.02);
  text-shadow: 0 0 10px rgba(49, 194, 124, 0.4);
}
.plain {
  white-space: pre-line;
  font-size: 13px;
  line-height: 1.9;
  color: rgba(255, 255, 255, 0.7);
  padding: 14px 8px;
}
.empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #6b7680;
  font-size: 13px;
}

/* 进度条 */
.progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: #a7b0b7;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.progress {
  flex: 1;
  position: relative;
  height: 20px;
  display: flex;
  align-items: center;
  cursor: pointer;
}
.progress-bg {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 999px;
}
.progress-fill {
  position: absolute;
  left: 0;
  height: 3px;
  background: linear-gradient(90deg, #31c27c, #36d68a);
  border-radius: 999px;
  box-shadow: 0 0 8px rgba(49, 194, 124, 0.6);
}
.progress-fill .thumb {
  position: absolute;
  right: -6px;
  top: 50%;
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  transform: translateY(-50%);
  box-shadow: 0 0 8px rgba(49, 194, 124, 0.8);
}

/* 控制区 */
.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
}
.controls > div {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}
.controls > div:active {
  transform: scale(0.92);
}
.play-btn {
  width: 66px !important;
  height: 66px !important;
  background: linear-gradient(180deg, #36d68a, #2aad69);
  box-shadow: var(--brand-glow);
}

/* 音量条 */
.vol-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 2px;
}
.vol-slider {
  flex: 1;
  appearance: none;
  background: transparent;
  height: 20px;
}
.vol-slider::-webkit-slider-runnable-track {
  height: 3px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 999px;
}
.vol-slider::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -6px;
  border-radius: 50%;
  background: var(--brand);
  box-shadow: 0 0 6px rgba(49, 194, 124, 0.7);
  border: 2px solid #fff;
}
</style>
