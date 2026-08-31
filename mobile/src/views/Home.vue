<template>
  <div class="home">
    <!-- Banner -->
    <div class="banner card">
      <div class="banner-left">
        <div class="banner-tag">MSC-TT 移动端</div>
        <div class="banner-title">海量无损音乐</div>
        <div class="banner-sub">三源聚合搜索 · 免费畅听</div>
      </div>
      <div class="banner-ic">
        <var-icon name="music-note" size="46" color="#31c27c" />
      </div>
    </div>

    <!-- 热门搜索 -->
    <div class="section">
      <div class="section-head">
        <span class="section-title">🔥 热门搜索</span>
        <span class="section-more">点击即搜</span>
      </div>
      <div class="chip-wrap">
        <var-chip
          v-for="(w, i) in hotKeywords"
          :key="i"
          :color="'primary'"
          size="large"
          round
          type="outline"
          @click="onGo(w)"
          style="margin: 4px"
        >
          {{ w }}
        </var-chip>
      </div>
    </div>

    <!-- 音源介绍 -->
    <div class="section">
      <div class="section-head">
        <span class="section-title">🎧 可用音源</span>
      </div>

      <div
        v-for="(s, idx) in sources"
        :key="s.id"
        class="source-card card"
        @click="onGo(s.sample)"
      >
        <div class="source-ic" :style="{ background: s.color }">
          <span class="source-idx">{{ idx + 1 }}</span>
        </div>
        <div class="source-meta">
          <div class="source-name">{{ s.name }}</div>
          <div class="source-desc">{{ s.desc }}</div>
        </div>
        <var-icon name="chevron-right" size="20" color="#6b7680" />
      </div>
    </div>

    <!-- 最近播放 -->
    <div v-if="player.history.length" class="section">
      <div class="section-head">
        <span class="section-title">🕘 最近播放</span>
        <span
          class="section-more link"
          @click="player.clearHistory(); Snackbar.success('已清空历史')"
        >
          清空
        </span>
      </div>
      <div
        v-for="(h, i) in player.history.slice(0, 6)"
        :key="'h' + i"
        class="song-row"
        @click="playHist(h)"
      >
        <div class="row-cover">
          <img v-if="h.coverUrl" :src="h.coverUrl" />
          <var-icon v-else name="music-note" size="18" color="#31c27c" />
        </div>
        <div class="row-meta">
          <div class="row-title ellipsis">{{ h.title }}</div>
          <div class="row-artist ellipsis">{{ h.artist }}</div>
        </div>
        <var-icon name="play-circle-outline" size="22" color="#a7b0b7" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { Snackbar } from '@varlet/ui'
import { HOT_KEYWORDS, SOURCE_LABELS } from '@shared/services/tripleSources'
import { usePlayerStore } from '@shared/stores/player'

const emit = defineEmits(['search-go'])

const player = usePlayerStore()
const hotKeywords = HOT_KEYWORDS

const sources = [
  {
    id: 'higequ',
    name: SOURCE_LABELS.higequ,
    desc: '服务端渲染，稳定可用，带同步歌词',
    color: 'linear-gradient(135deg,#31c27c,#36d68a)',
    sample: '晴天'
  },
  {
    id: 'xmwav',
    name: SOURCE_LABELS.xmwav,
    desc: '无损索引站，试听 ogg 直链，音质优先',
    color: 'linear-gradient(135deg,#5B8DEF,#9DDCFD)',
    sample: '夜曲'
  },
  {
    id: 'gmmp3',
    name: SOURCE_LABELS.gmmp3,
    desc: 'JSON-LD 结构化，酷我 CDN 302 直链',
    color: 'linear-gradient(135deg,#FF8A65,#FFB74D)',
    sample: '稻香'
  }
]

function onGo(w) {
  emit('search-go', w)
}
function playHist(h) {
  player.play({
    sourceId: h.sourceId,
    onlineType: h.onlineType,
    title: h.title,
    artist: h.artist,
    album: h.album,
    coverUrl: h.coverUrl
  }, player.history, 0)
}
</script>

<style scoped>
.home {
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.banner {
  padding: 18px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, rgba(49, 194, 124, 0.22), rgba(20, 26, 30, 0.9));
  border: 1px solid rgba(49, 194, 124, 0.35);
  overflow: hidden;
}
.banner-tag {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(49, 194, 124, 0.2);
  color: var(--brand);
  margin-bottom: 6px;
}
.banner-title {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 2px;
}
.banner-sub {
  font-size: 12px;
  color: var(--text-secondary);
}
.banner-ic {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #208854, #0e1418 70%);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.9;
  box-shadow: inset 0 0 16px rgba(49, 194, 124, 0.45);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.section-title {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
}
.section-more {
  font-size: 12px;
  color: var(--text-tertiary);
}
.section-more.link {
  color: var(--brand);
}

.chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

/* 音源卡片 */
.source-card {
  display: flex;
  align-items: center;
  padding: 14px;
  gap: 12px;
  margin-bottom: 10px;
}
.source-ic {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 800;
  font-size: 16px;
  flex-shrink: 0;
}
.source-meta {
  flex: 1;
  min-width: 0;
}
.source-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 2px;
}
.source-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

/* 歌曲行 */
.song-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--bg-card);
  border: 1px solid var(--line);
  margin-bottom: 6px;
}
.row-cover {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: #0e1418;
  display: flex;
  align-items: center;
  justify-content: center;
}
.row-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.row-meta {
  flex: 1;
  min-width: 0;
}
.row-title {
  font-size: 14px;
  color: #fff;
  font-weight: 500;
}
.row-artist {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}
</style>
