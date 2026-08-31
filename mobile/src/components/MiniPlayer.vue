<template>
  <div
    class="mini-player card"
    :style="{ paddingBottom: playerBarBottom + 'px' }"
    @click="$router.push('/player')"
  >
    <!-- 封面 -->
    <div class="cover" :class="{ rotate: player.isPlaying }">
      <img
        v-if="player.currentTrack?.coverUrl"
        :src="player.currentTrack.coverUrl"
        alt=""
      />
      <div v-else class="cover-fallback">
        <var-icon name="music-note" size="24" color="#31c27c" />
      </div>
    </div>
    <!-- 标题/歌手 -->
    <div class="meta">
      <div class="title ellipsis">
        {{ player.currentTrack?.title || player.currentMeta?.title || '暂无播放' }}
      </div>
      <div class="artist ellipsis">
        {{ player.currentTrack?.artist || player.currentMeta?.artist || '——' }}
      </div>
      <!-- 进度条 -->
      <div class="bar">
        <div class="fill" :style="{ width: player.progress + '%' }"></div>
      </div>
    </div>
    <!-- 控制 -->
    <div class="ctrl">
      <var-icon
        name="skip-previous"
        size="22"
        color="#cfd4d8"
        @click.stop="player.prev()"
      />
      <div class="play-ic" @click.stop="player.toggle()">
        <var-icon
          v-if="player.isLoading"
          name="loading"
          size="22"
          color="#fff"
          transition="rotate"
        />
        <var-icon v-else-if="player.isPlaying" name="pause" size="22" color="#fff" />
        <var-icon v-else name="play" size="22" color="#fff" style="margin-left:2px" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePlayerStore } from '@shared/stores/player'

const player = usePlayerStore()
// 非Tab显示时（player/单独显示）直接贴底
const playerBarBottom = computed(() => {
  const tabbarActive = true // App.vue 决定我们位置靠 tabbar 的 bottom=56px；我们是固定在 56px tabbar 上方 → 我们自己在父级里被固定到 bottom:56px（或者这里通过 css calc）
  // 实际上我们在 style 里定位到 bottom=56px，再加上自己的 padding=0
  return 0 // safe-bottom 由父容器 App.vue 控制 tabbar bottom，我们紧贴 tabbar 上沿
})
</script>

<style scoped>
.mini-player {
  position: fixed;
  left: 10px;
  right: 10px;
  bottom: 56px; /* 对应 tabbar 高度 */
  z-index: 40;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  padding: 6px 10px;
  gap: 10px;
  backdrop-filter: blur(16px);
  background: rgba(28, 36, 42, 0.94);
  border: 1px solid rgba(49, 194, 124, 0.25);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}
.cover {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #0e1418;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(49, 194, 124, 0.25);
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cover.rotate {
  animation: spin 12s linear infinite;
}
.cover-fallback {
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at center, #1d2a22, #0e1418);
  display: flex;
  align-items: center;
  justify-content: center;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}
.title {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  line-height: 1.2;
}
.artist {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.2;
}
.bar {
  height: 2px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
  margin-top: 2px;
}
.fill {
  height: 100%;
  background: linear-gradient(90deg, #31c27c, #36d68a);
  box-shadow: 0 0 6px rgba(49, 194, 124, 0.6);
  transition: width 0.3s linear;
}
.ctrl {
  display: flex;
  align-items: center;
  gap: 10px;
}
.play-ic {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(180deg, #36d68a, #2aad69);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--brand-glow);
  flex-shrink: 0;
}
.play-ic:active {
  transform: scale(0.95);
}
</style>
