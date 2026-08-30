<template>
  <div class="discover">
    <div class="disc-loading" v-if="loading">加载中...</div>
    <div v-else class="discover-scroll">
      <!-- 问候 + 今日专属推荐 -->
      <div class="hero-row">
        <div class="hero-greet">{{ feed.greeting }}，来听点什么？</div>
        <div class="hero-card" @click="playHero">
          <div class="hero-info">
            <div class="hero-tip" v-if="feed.hero">{{ feed.hero.tip || '为你推荐' }}</div>
            <div class="hero-title">
              {{ feed.hero ? feed.hero.title : '今天还没有推荐' }}
            </div>
            <div class="hero-sub">
              {{ feed.hero ? feed.hero.subtitle : '先去在线音乐找几首歌收藏，下次就有专属推荐啦' }}
            </div>
            <button class="hero-play">
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
              <span>{{ feed.hero ? '立即播放' : '去在线音乐' }}</span>
            </button>
          </div>
          <div class="hero-cover">
            <img
              v-if="heroCover && !isBroken('hero')"
              :src="heroCover"
              alt=""
              referrerpolicy="no-referrer"
              @error="e => onCoverError(e, 'hero', () => (heroCover.value = null))"
            />
            <div v-else class="hero-cover-fallback">
              <svg viewBox="0 0 24 24" width="40" height="40"><path fill="currentColor" d="M12 3v9.55A4 4 0 1014 16V7h4V3z"/></svg>
            </div>
            <div class="hero-disc"></div>
          </div>
        </div>
      </div>

      <!-- 今日推荐：有数据就歌曲封面；冷启动就显示主题歌单 -->
      <section class="section" v-if="todayOrTopics.length">
        <SecHead :title="hasSongs ? '今日推荐' : '今日推荐主题'" :subtitle="hasSongs ? '为你精选 · 每天不一样' : '点一个主题立刻开始聆听'" />
        <div class="song-grid">
          <div
            v-for="(it, i) in todayOrTopics"
            :key="'t-' + (it.id || it.title)"
            class="song-card"
            @click="onTodayClick(it)"
          >
            <div class="sc-cover">
              <span v-if="hasSongs" class="sc-index">{{ String(i + 1).padStart(2, '0') }}</span>
              <img
                v-if="coverMap[coverKey(it)] && !isBroken(coverKey(it))"
                :src="coverMap[coverKey(it)]"
                class="sc-img"
                alt=""
                referrerpolicy="no-referrer"
                loading="lazy"
                @error="e => onCoverError(e, coverKey(it), () => { const c = { ...coverMap.value }; delete c[coverKey(it)]; coverMap.value = c; })"
              />
              <div v-else class="sc-ph">♪</div>
              <button class="sc-play" @click.stop="onTodayClick(it)">
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
              </button>
            </div>
            <div class="sc-title" :title="it.title">{{ it.title }}</div>
            <div class="sc-artist" :title="it.subtitle || it.artist">{{ hasSongs ? (it.artist || '未知艺人') : (it.cnt + ' 首精选') }}</div>
          </div>
        </div>
      </section>

      <!-- 猜你喜欢 -->
      <section class="section" v-if="feed.guess.length">
        <SecHead :title="hasSongs ? '猜你喜欢' : '热门歌曲精选'" :subtitle="hasSongs ? '基于你收藏的艺人推荐' : '千万听众一致好评'">
          <template #extra v-if="!hasSongs" v-text="'点击任意歌曲 · 自动搜索播放'" />
        </SecHead>
        <div class="song-list">
          <div
            v-for="(s, i) in feed.guess"
            :key="'g-' + (s.id || s.title)"
            class="song-row"
            @click="onGuessClick(s)"
          >
            <span class="sr-idx">{{ i + 1 }}</span>
            <span class="sr-cover-cell">
              <img
                v-if="coverMap[coverKey(s)] && !isBroken(coverKey(s))"
                :src="coverMap[coverKey(s)]"
                class="sr-cover"
                loading="lazy"
                referrerpolicy="no-referrer"
                @error="e => onCoverError(e, coverKey(s), () => { const c = { ...coverMap.value }; delete c[coverKey(s)]; coverMap.value = c; })"
              />
              <span v-else class="sr-cover-ph">♪</span>
            </span>
            <span class="sr-info">
              <span class="sr-title" :title="s.title">{{ s.title }}</span>
              <span class="sr-artist">{{ s.artist || '未知艺人' }}</span>
            </span>
            <span class="sr-album" :title="s.album">{{ s.album || '—' }}</span>
            <span class="sr-dur">{{ formatTime(s.duration) }}</span>
          </div>
        </div>
      </section>

      <!-- 我的歌单宝藏库 -->
      <section class="section" v-if="feed.playlists.length">
        <SecHead :title="hasSongs ? '我的歌单宝藏库' : '精选推荐歌单'" />
        <div class="playlist-grid">
          <div
            v-for="pl in feed.playlists"
            :key="'pl-' + pl.id"
            class="pl-card"
            @click="onPlaylistClick(pl)"
          >
            <div class="plc-cover">
              <img
                v-if="coverMap['pl-' + pl.id] && !isBroken('pl-' + pl.id)"
                :src="coverMap['pl-' + pl.id]"
                class="plc-img"
                loading="lazy"
                referrerpolicy="no-referrer"
                @error="e => onCoverError(e, 'pl-' + pl.id, () => { const c = { ...coverMap.value }; delete c['pl-' + pl.id]; coverMap.value = c; })"
              />
              <div v-else class="plc-ph">
                <svg viewBox="0 0 24 24" width="34" height="34"><path fill="currentColor" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2zm-1-2V7l-5 3-5-3v12h10z"/></svg>
              </div>
              <span class="plc-cnt">{{ pl.cnt }} 首</span>
            </div>
            <div class="plc-title" :title="pl.name">{{ pl.name }}</div>
          </div>
        </div>
      </section>

      <!-- 排行榜 -->
      <section class="section" v-if="feed.topList.length">
        <SecHead :title="hasSongs ? '最近热听榜' : '热门推荐榜'" :subtitle="hasSongs ? '按你的播放次数排名' : '全网热门 · 精选 TOP 12'" />
        <div class="song-list">
          <div
            v-for="(s, i) in feed.topList"
            :key="'top-' + (s.id || s.title)"
            class="song-row"
            @click="onTopClick(s)"
          >
            <span class="sr-idx" :class="['r' + (i + 1)]">{{ i + 1 }}</span>
            <span class="sr-cover-cell">
              <img
                v-if="coverMap[coverKey(s)] && !isBroken(coverKey(s))"
                :src="coverMap[coverKey(s)]"
                class="sr-cover"
                loading="lazy"
                referrerpolicy="no-referrer"
                @error="e => onCoverError(e, coverKey(s), () => { const c = { ...coverMap.value }; delete c[coverKey(s)]; coverMap.value = c; })"
              />
              <span v-else class="sr-cover-ph">♪</span>
            </span>
            <span class="sr-info">
              <span class="sr-title" :title="s.title">{{ s.title }}</span>
              <span class="sr-artist">{{ s.artist || '未知艺人' }}</span>
            </span>
            <span class="sr-album" :title="s.album">{{ s.album || '—' }}</span>
            <span class="sr-meta">{{ hasSongs && s.play_count ? '播放 ' + s.play_count + ' 次' : '' }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, reactive } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useCover } from '../composables/useCover'

const emit = defineEmits(['open-playlist', 'search-online'])
const player = usePlayerStore()
const { isBroken, resetAllBroken, onCoverError } = useCover()

// 冷启动的兜底封面接口不确定稳定性 —— 统一走本地缓存判断
const onlineCoverBrokenKeys = reactive(new Set())
function safeOnlineCoverUrl(kw) {
  if (!kw) return null
  return 'https://cover.douyio.xyz/api/cover?type=song&name=' + encodeURIComponent(kw)
}

const loading = ref(true)
const feed = ref({
  greeting: '你好',
  hero: null,
  today: [],
  guess: [],
  topList: [],
  playlists: []
})

const hasSongs = computed(() => feed.value.today.length > 0 || (feed.value.hero && feed.value.hero.song))

// 冷启动时 today 为空 → 把歌单推荐抽一张放上来，避免一大块空
const todayOrTopics = computed(() => {
  if (feed.value.today.length) return feed.value.today.slice(0, 20)
  return (feed.value.playlists || []).slice(0, 6)
})

onMounted(async () => {
  try {
    feed.value = await window.mscAPI.getDiscoverFeed()
  } catch (e) {
    console.warn('[discover] 加载失败', e)
  }
  loading.value = false
  resetAllBroken()
  await hydrateAllCovers()
})

// ================= 封面统一加载（getCoverDataUrl 优先，coverUrl 其次） =================
const coverMap = ref({})

function coverKey(s) {
  if (s && typeof s.id === 'number') return 's-' + s.id
  if (s && s.search) return 'q-' + s.search
  if (s && s.coverSeed) return 'q-' + s.coverSeed
  if (s && (s.title || s.name)) return 't-' + (s.title || s.name)
  return Math.random().toString(36).slice(2)
}

const heroCover = ref(null)
async function hydrateHeroCover() {
  const h = feed.value.hero
  if (!h) { heroCover.value = null; return }
  if (h.coverUrl) { heroCover.value = h.coverUrl; return }
  if (h.coverSongId) {
    try { heroCover.value = await window.mscAPI.getCoverDataUrl(h.coverSongId) || null } catch {}
    if (heroCover.value) return
  }
  if (h.search || h.title) {
    // 兜底在线封面：接口失效时不抛错，heroCover 保持 null → 前端走占位
    const url = safeOnlineCoverUrl(h.search || (h.title + ' ' + h.subtitle))
    try {
      const ok = await testImage(url)
      heroCover.value = ok ? url : null
    } catch { heroCover.value = null }
  }
}

// 预检测：公共封面接口是不是能返回图片
function testImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(false)
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = url
  })
}

async function loadCoverFor(key, item) {
  try {
    // 1) 如果有 cover_url/coverUrl 直接用
    if (item.coverUrl) {
      coverMap.value = { ...coverMap.value, [key]: item.coverUrl }
      return
    }
    // 2) 数据库歌曲走 getCoverDataUrl（cover_path / cover_url 都走统一映射）
    if (typeof item.id === 'number' && item.id > 0) {
      const d = await window.mscAPI.getCoverDataUrl(item.id)
      if (d) {
        coverMap.value = { ...coverMap.value, [key]: d }
        return
      }
    }
    // 3) cover_song_id（歌单封面取自该歌单里某首歌）
    if (item.cover_song_id) {
      const d = await window.mscAPI.getCoverDataUrl(item.cover_song_id)
      if (d) {
        coverMap.value = { ...coverMap.value, [key]: d }
        return
      }
    }
    // 4) 冷启动条目：search 关键词 / coverSeed → 先探测再用
    if (item.search || item.coverSeed || item.title) {
      const kw = item.coverSeed || item.search || (item.title + ' ' + (item.artist || ''))
      const url = safeOnlineCoverUrl(kw)
      const ok = await testImage(url)
      if (ok) coverMap.value = { ...coverMap.value, [key]: url }
      // 失败时不填值 → 模板走 ♪ 占位，不裂图
    }
  } catch {}
}

async function hydrateAllCovers() {
  await hydrateHeroCover()
  const tasks = []
  feed.value.today.forEach((s) => tasks.push(loadCoverFor(coverKey(s), s)))
  feed.value.guess.forEach((s) => tasks.push(loadCoverFor(coverKey(s), s)))
  feed.value.topList.forEach((s) => tasks.push(loadCoverFor(coverKey(s), s)))
  feed.value.playlists.forEach((pl) => tasks.push(loadCoverFor('pl-' + pl.id, pl)))
  // todayOrTopics 可能包含歌单（冷启动），上面已覆盖 pl-xxx
  for (const it of todayOrTopics.value) {
    if (it.cnt != null && it.search) {
      // 它是歌单卡片 → 可能已在 playlists 里处理过；再补一次保险
      tasks.push(loadCoverFor(coverKey(it), it))
    }
  }
  await Promise.all(tasks)
}

// ===== 跳转 / 播放逻辑 =====
function searchTo(kw) {
  window.dispatchEvent(new CustomEvent('app:search-go', { detail: kw }))
}

function playOne(s) {
  if (!s) return
  player.addToQueue(s)
  player.playIndex(player.queue.length - 1)
}

function playHero() {
  const h = feed.value.hero
  if (!h) {
    window.dispatchEvent(new CustomEvent('app:nav-to', { detail: 'online' }))
    return
  }
  if (h.song) { playOne(h.song); return }
  if (h.search) { searchTo(h.search); return }
  window.dispatchEvent(new CustomEvent('app:nav-to', { detail: 'online' }))
}

function onTodayClick(it) {
  if (hasSongs.value && it.id) { playOne(it); return }
  // 冷启动：todayOrTopics 可能是主题歌单
  if (it.search) { searchTo(it.search); return }
}

function onGuessClick(s) {
  if (s.id) { playOne(s); return }
  if (s.search) { searchTo(s.search); return }
}

function onTopClick(s) {
  if (s.id) { playOne(s); return }
  if (s.search) { searchTo(s.search); return }
}

function onPlaylistClick(pl) {
  if (!pl) return
  if (pl.id > 0) {
    // 有 id 且为正数：真正的自建歌单，进入歌单详情
    emit('open-playlist', pl.id)
    return
  }
  // 冷启动的主题歌单：负数/无 id → 跳搜索
  if (pl.search) { searchTo(pl.search) }
}

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ===== 分节标题组件 =====
const SecHead = {
  name: 'SecHead',
  props: ['title', 'subtitle'],
  template: `
    <div class="sec-head">
      <div class="sec-title">
        <span class="sec-bar"></span>
        <span class="sec-title-text">{{ title }}</span>
        <span v-if="subtitle" class="sec-sub">{{ subtitle }}</span>
      </div>
    </div>
  `
}
</script>

<style scoped>
.discover {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text-primary, #eaf5ee);
  user-select: none;
}
.discover > .disc-loading,
.discover > template + div,
.discover > *:not(style) {
  flex: 1 1 auto;
}
.discover-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 18px 28px 120px;
}

.disc-loading {
  padding: 80px;
  text-align: center;
  color: var(--text-tertiary, #6b7c75);
}

/* ===== Hero ===== */
.hero-row { margin-bottom: 26px; }
.hero-greet {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 14px;
  color: var(--text-primary);
}
.hero-card {
  display: flex;
  align-items: stretch;
  gap: 28px;
  background: linear-gradient(135deg, #183a29 0%, #0f2118 60%, #0c1812 100%);
  border: 1px solid rgba(61, 220, 132, 0.18);
  border-radius: 16px;
  padding: 28px 32px;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease;
}
.hero-card:hover {
  transform: translateY(-2px);
  border-color: rgba(61, 220, 132, 0.36);
}
.hero-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}
.hero-tip {
  font-size: 12px;
  color: #95f0b8;
  letter-spacing: 1px;
}
.hero-title {
  font-size: 28px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hero-sub {
  font-size: 14px;
  color: var(--text-secondary, #9fb3a8);
}
.hero-play {
  width: fit-content;
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 20px;
  border: none;
  border-radius: 24px;
  background: var(--color-primary, #1db954);
  color: #06130c;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: filter 0.15s ease;
}
.hero-play:hover { filter: brightness(1.12); }

.hero-cover {
  width: 170px;
  height: 170px;
  position: relative;
  flex: none;
  border-radius: 50%;
}
.hero-cover img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
}
.hero-cover-fallback {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  color: #5c7567;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
}
.hero-disc {
  position: absolute;
  inset: -22px;
  border-radius: 50%;
  background:
    repeating-radial-gradient(circle at center, transparent 0, transparent 2px, rgba(255,255,255,0.05) 3px, transparent 4px);
  pointer-events: none;
  z-index: -1;
}

/* ===== Section ===== */
.section { margin: 34px 0 0; }
.sec-head { margin-bottom: 14px; }
.sec-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sec-bar {
  width: 4px;
  height: 16px;
  background: var(--color-primary, #1db954);
  border-radius: 2px;
}
.sec-title-text {
  font-size: 18px;
  font-weight: 700;
}
.sec-sub {
  margin-left: 6px;
  font-size: 12px;
  color: var(--text-tertiary, #6b7c75);
}

/* ===== Song Grid ===== */
.song-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 20px 16px;
}
.song-card { cursor: pointer; }
.sc-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  margin-bottom: 10px;
}
.sc-index {
  position: absolute;
  top: 8px;
  left: 10px;
  z-index: 2;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0,0,0,0.6);
  letter-spacing: 0.5px;
}
.sc-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}
.sc-ph {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #566b61;
  font-size: 40px;
}
.song-card:hover .sc-img { transform: scale(1.06); }
.sc-play {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: var(--color-primary, #1db954);
  color: #06130c;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: translateY(8px);
  transition: all 0.2s ease;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(0,0,0,0.5);
}
.song-card:hover .sc-play { opacity: 1; transform: translateY(0); }
.sc-title {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sc-artist {
  font-size: 12px;
  color: var(--text-tertiary, #6b7c75);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

/* ===== Song List ===== */
.song-list {
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  padding: 6px 0;
}
.song-row {
  display: grid;
  grid-template-columns: 36px 52px 1fr 180px 120px;
  gap: 12px;
  align-items: center;
  padding: 8px 18px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.song-row:hover { background: rgba(255, 255, 255, 0.05); }
.sr-idx {
  text-align: center;
  color: var(--text-tertiary, #6b7c75);
  font-size: 13px;
  font-weight: 600;
}
.sr-idx.r1 { color: #ff6b6b; font-size: 16px; }
.sr-idx.r2 { color: #ffa94d; font-size: 15px; }
.sr-idx.r3 { color: #ffd43b; font-size: 15px; }
.sr-cover-cell {
  width: 42px; height: 42px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(255,255,255,0.04);
  display: flex;
  align-items: center;
  justify-content: center;
}
.sr-cover { width: 100%; height: 100%; object-fit: cover; }
.sr-cover-ph { color: #566b61; font-size: 20px; }
.sr-info { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.sr-title {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sr-artist {
  font-size: 12px;
  color: var(--text-tertiary, #6b7c75);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sr-album {
  font-size: 12px;
  color: var(--text-tertiary, #6b7c75);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sr-dur {
  font-size: 12px;
  color: var(--text-tertiary, #6b7c75);
  text-align: right;
}
.sr-meta {
  font-size: 12px;
  color: var(--text-tertiary, #6b7c75);
  text-align: right;
}

/* ===== Playlist Grid ===== */
.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 22px 18px;
}
.pl-card { cursor: pointer; }
.plc-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  margin-bottom: 10px;
}
.plc-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; }
.pl-card:hover .plc-img { transform: scale(1.06); }
.plc-ph {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: #566b61;
}
.plc-cnt {
  position: absolute;
  right: 8px;
  top: 8px;
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
}
.plc-title {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
