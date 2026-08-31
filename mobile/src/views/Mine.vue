<template>
  <div class="mine-page">
    <!-- 用户卡 -->
    <div class="profile-card card">
      <div class="avatar">
        <var-icon name="account-circle" size="46" color="#31c27c" />
      </div>
      <div class="u-info">
        <div class="u-name">MSC-TT 用户</div>
        <div class="u-desc">移动端 · 三源聚合音乐播放器</div>
      </div>
    </div>

    <!-- 数据概览 -->
    <div class="stats-row">
      <div class="stat card" @click="tab='fav'">
        <div class="stat-num">{{ player.favorites.length }}</div>
        <div class="stat-label">收藏</div>
      </div>
      <div class="stat card" @click="tab='hist'">
        <div class="stat-num">{{ player.history.length }}</div>
        <div class="stat-label">历史</div>
      </div>
      <div class="stat card" @click="tab='queue'">
        <div class="stat-num">{{ player.queue.length }}</div>
        <div class="stat-label">队列</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-wrap">
      <var-tabs v-model:active="tab" line-width="40" elevation="0">
        <var-tab name="fav">我的收藏</var-tab>
        <var-tab name="hist">最近播放</var-tab>
        <var-tab name="queue">播放队列</var-tab>
        <var-tab name="about">关于</var-tab>
      </var-tabs>
    </div>

    <!-- 列表 -->
    <div v-if="tab === 'fav'" class="list-box">
      <div v-if="!player.favorites.length" class="empty-state">
        <var-icon name="heart-outline" size="36" color="#4a535b" />
        <p>暂无收藏的歌曲</p>
        <span>播放时点击 ❤️ 即可收藏</span>
      </div>
      <div
        v-for="(f, i) in player.favorites"
        :key="'f'+i"
        class="song-line"
        @click="playIt(f, player.favorites, i)"
      >
        <div class="row-cover">
          <img v-if="f.coverUrl" :src="f.coverUrl" />
          <var-icon v-else name="music-note" size="18" color="#31c27c" />
        </div>
        <div class="row-meta">
          <div class="t ellipsis">{{ f.title }}</div>
          <div class="s ellipsis">{{ f.artist }} · {{ f.album || '未知专辑' }}</div>
        </div>
        <div class="row-actions">
          <var-icon
            name="heart"
            size="18"
            color="#ff4d4f"
            @click.stop="player.removeFavorite(i); Snackbar('已取消收藏')"
          />
        </div>
      </div>
    </div>

    <div v-if="tab === 'hist'" class="list-box">
      <div v-if="!player.history.length" class="empty-state">
        <var-icon name="history" size="36" color="#4a535b" />
        <p>暂无播放记录</p>
      </div>
      <div
        v-for="(h, i) in player.history"
        :key="'h'+i"
        class="song-line"
        @click="playIt(h, player.history, i)"
      >
        <div class="row-cover">
          <img v-if="h.coverUrl" :src="h.coverUrl" />
          <var-icon v-else name="music-note" size="18" color="#31c27c" />
        </div>
        <div class="row-meta">
          <div class="t ellipsis">{{ h.title }}</div>
          <div class="s ellipsis">{{ h.artist }}</div>
        </div>
        <div class="row-sub">
          {{ formatAt(h.at) }}
        </div>
      </div>
    </div>

    <div v-if="tab === 'queue'" class="list-box">
      <div v-if="!player.queue.length" class="empty-state">
        <var-icon name="format-list-bulleted" size="36" color="#4a535b" />
        <p>播放队列为空</p>
        <span>去搜索页点击「全部播放」创建队列</span>
      </div>
      <div
        v-for="(q, i) in player.queue"
        :key="'q'+i"
        class="song-line"
        :class="{ cur: player.currentIndex === i }"
        @click="playIt(q, player.queue, i)"
      >
        <div class="q-idx">{{ i + 1 }}</div>
        <div class="row-meta">
          <div class="t ellipsis">{{ q.title }}</div>
          <div class="s ellipsis">{{ q.artist }}</div>
        </div>
        <var-icon
          v-if="player.currentIndex === i && player.isPlaying"
          name="volume-high"
          size="18"
          color="#31c27c"
        />
      </div>
    </div>

    <div v-if="tab === 'about'" class="list-box">
      <div class="about-card card">
        <div class="about-logo">
          <div class="logo-dot"></div>
          <span>MSC-TT</span>
        </div>
        <div class="about-ver">Version 0.1.0 (Mobile)</div>
        <div class="about-desc">
          <p>基于 Vue3 + Vite + Capacitor + Howler 构建的三源聚合音乐播放器</p>
          <p>· 源1：Hi歌曲音乐网（higequ.com）</p>
          <p>· 源4：熊猫无损音乐网（xmwav.net）</p>
          <p>· 源5：闺蜜音乐（gmmp3.com）</p>
        </div>
        <var-button
          type="primary"
          round
          block
          size="large"
          @click="onClearCache"
          style="margin-top:10px; background: #1c242a !important; color: #ff4d4f !important"
        >
          清除本地缓存（收藏/历史/队列）
        </var-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Snackbar, Dialog } from '@varlet/ui'
import { usePlayerStore } from '@shared/stores/player'

const player = usePlayerStore()
const tab = ref('fav')

function playIt(meta, queue, idx) {
  player
    .play(
      {
        sourceId: meta.sourceId,
        onlineType: meta.onlineType,
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        coverUrl: meta.coverUrl
      },
      queue,
      idx
    )
    .catch((e) => Snackbar.error(String(e.message || '播放失败')))
}

function formatAt(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return m + '分钟前'
  const h = Math.floor(m / 60)
  if (h < 24) return h + '小时前'
  const d = Math.floor(h / 24)
  if (d < 7) return d + '天前'
  const dt = new Date(ts)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

function onClearCache() {
  Dialog({
    title: '确认清除本地缓存？',
    message: '将会清空收藏 / 播放历史 / 播放队列，操作不可恢复',
    onConfirm: () => {
      localStorage.clear()
      // 重置内存里的响应式数组
      player.favorites.splice(0)
      player.history.splice(0)
      player.queue.splice(0)
      player.currentMeta = null
      player.currentTrack = null
      Snackbar.success('已清除所有本地缓存')
    }
  })
}
</script>

<style scoped>
.mine-page {
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.profile-card {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  background: linear-gradient(135deg, rgba(49, 194, 124, 0.22), rgba(20, 26, 30, 0.9));
  border: 1px solid rgba(49, 194, 124, 0.3);
}
.avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #0e1418;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(49, 194, 124, 0.35);
}
.u-name {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
}
.u-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* 数据统计 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.stat {
  padding: 14px 10px;
  text-align: center;
}
.stat-num {
  font-size: 20px;
  font-weight: 800;
  color: var(--brand);
}
.stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 3px;
}

.tabs-wrap {
  background: var(--bg-card);
  border-radius: 12px;
  border: 1px solid var(--line);
  padding: 4px 6px;
}

.list-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 10px;
}
.empty-state {
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--text-tertiary);
  font-size: 12px;
}
.empty-state p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
}

.song-line {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--bg-card);
  border: 1px solid var(--line);
}
.song-line.cur {
  border-color: rgba(49, 194, 124, 0.5);
  background: linear-gradient(90deg, rgba(49, 194, 124, 0.1), transparent 70%);
}
.row-cover {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #0e1418;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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
.row-meta .t {
  font-size: 14px;
  color: #fff;
  font-weight: 500;
}
.row-meta .s {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}
.row-sub {
  font-size: 11px;
  color: var(--text-tertiary);
}
.row-actions {
  display: flex;
  gap: 12px;
  padding-left: 6px;
}
.q-idx {
  width: 24px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.about-card {
  padding: 22px 16px;
  text-align: center;
}
.about-logo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 1px;
  color: #fff;
}
.logo-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--brand);
  box-shadow: var(--brand-glow);
}
.about-ver {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}
.about-desc {
  margin-top: 16px;
  text-align: left;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.8;
}
.about-desc p {
  margin: 0;
}
</style>
