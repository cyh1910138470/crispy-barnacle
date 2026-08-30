<template>
  <div class="singer-page">
    <!-- 歌手信息头 -->
    <div class="singer-head">
      <span class="singer-avatar">
        <img v-if="singer.avatar && !isBroken('sv-avatar')" :src="singer.avatar" referrerpolicy="no-referrer" alt=""
          @error="e => onCoverError(e, 'sv-avatar', () => (singer.value.avatar = ''))"
        />
        <svg v-else viewBox="0 0 24 24" width="42" height="42"><path fill="#555" d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z"/></svg>
      </span>
      <div class="singer-meta">
        <div class="singer-name">{{ singer.name || name || '歌手' }}</div>
        <div class="singer-sub">
          {{ sourceLabel }} · 热门歌曲{{ loaded ? ` · ${list.length} 首` : '' }}
        </div>
      </div>
      <button class="play-all" :disabled="!list.length" @click="playAll">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
        播放全部
      </button>
    </div>

    <!-- 歌曲列表 -->
    <div v-if="loading" class="hint">正在加载歌手歌曲...</div>
    <div v-else-if="error" class="hint err">{{ error }}</div>
    <template v-else-if="list.length">
      <div
        v-for="item in list"
        :key="item.sourceId"
        class="row"
        :class="{ loading: loadingId === item.sourceId, playing: currentSourceId === item.sourceId }"
        @click="playOnlineRow(item)"
      >
        <span class="row-cover-cell">
          <img
            v-if="item.coverUrl && !isBroken('sv-' + (item.id || item.sourceId))"
            :src="item.coverUrl"
            class="row-cover"
            loading="lazy"
            referrerpolicy="no-referrer"
            alt=""
            @error="e => onCoverError(e, 'sv-' + (item.id || item.sourceId), () => { if (item.coverUrl) item.coverUrl = '' })"
          />
          <span v-else class="cover-ph">♪</span>
          <span v-if="loadingId === item.sourceId" class="cover-play always"><span class="spinner"></span></span>
          <span v-else class="cover-play">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
          </span>
        </span>
        <div class="row-main">
          <span class="row-name">{{ item.title }}</span>
          <span v-if="item.vip" class="vip-badge" title="VIP 歌曲，需登录你的音源账号">VIP</span>
        </div>
        <button
          class="row-fav"
          :class="{ active: favSourceIds.has(item.sourceId), busy: favLoadingId === item.sourceId }"
          :title="favSourceIds.has(item.sourceId) ? '取消收藏' : '收藏'"
          @click.stop="toggleOnlineFav(item)"
        >
          <svg v-if="favSourceIds.has(item.sourceId)" viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"/></svg>
          <svg v-else viewBox="0 0 24 24" width="15" height="15"><path fill="none" stroke="currentColor" stroke-width="2" d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"/></svg>
        </button>
        <div class="row-album">{{ item.album }}</div>
        <div class="row-dur">{{ formatDur(item.duration) }}</div>
      </div>
      <div v-if="rowMsg" class="hint err">{{ rowMsg }}</div>
    </template>
    <div v-else-if="loaded" class="hint">没有获取到歌曲</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useCover } from '../composables/useCover'
import { SOURCE_NAMES } from '../constants/sources'

const props = defineProps({
  source: { type: String, default: 'qq' },
  singerId: { type: String, default: '' },
  name: { type: String, default: '' }
})

const player = usePlayerStore()
const { isBroken, resetAllBroken, onCoverError } = useCover()

const singer = ref({ name: props.name, avatar: '' })
const list = ref([])
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const rowMsg = ref('')
const loadingId = ref('')
const favSourceIds = ref(new Set())
const favLoadingId = ref('')

const sourceLabel = computed(() => SOURCE_NAMES[props.source] || props.source)

// 当前正在播的在线歌（按 sourceId 匹配）
const currentSourceId = computed(() => {
  const t = player.currentTrack
  return t?.sourceId ? String(t.sourceId) : ''
})

async function loadFavState() {
  try {
    favSourceIds.value = new Set(await window.mscAPI.listFavoriteSourceIds())
  } catch {}
}

async function load() {
  if (!props.singerId) {
    error.value = '缺少歌手信息'
    return
  }
  loading.value = true
  error.value = ''
  resetAllBroken()
  try {
    const r = await window.mscAPI.getSingerSongs(props.source, props.singerId)
    if (r.ok) {
      list.value = r.list || []
      if (r.singer?.name) singer.value = r.singer
    } else {
      error.value = r.error || '获取歌手歌曲失败'
    }
    loaded.value = true
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// 点歌序号令牌：连点不同歌时旧请求的结果直接丢弃，不再被上一首卡住
let playRowSeq = 0

async function playOnlineRow(item) {
  const seq = ++playRowSeq
  loadingId.value = item.sourceId
  rowMsg.value = ''
  try {
    const r = await window.mscAPI.playOnline({ ...item })
    if (seq !== playRowSeq) return
    if (!r.ok) {
      const msg = `「${item.title}」播放失败：${r.error}`
      rowMsg.value = msg
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { text: msg, type: 'error' } }))
      return
    }
    // 解析后的歌替换列表对应项；其余按歌手热门列表顺序作为占位，
    // 点"下一曲/上一曲"轮到时由 player 自动解析入库，实现整列表连播
    // r.song 是数据库行（source_id 命名），必须补 sourceId，否则点击行定位失效 → 永远播第 0 首
    const resolved = { ...r.song, sourceId: item.sourceId }
    if (item.singerId) {
      resolved.singerId = item.singerId
      resolved.singerSource = props.source
    }
    // 先在原始列表上定位点击行，再做替换
    const idx = list.value.findIndex((it) => it.sourceId === item.sourceId)
    const tracks = list.value.map((it) => {
      if (it.sourceId === item.sourceId) return resolved
      return {
        title: it.title,
        artist: it.artist,
        album: it.album,
        duration: it.duration || 0,
        coverUrl: it.coverUrl || '',
        vip: !!it.vip,
        sourceId: it.sourceId,
        onlineType: it.onlineType || props.source,
        singerId: it.singerId || props.singerId,
        singerSource: props.source
      }
    })
    player.setQueue(tracks, Math.max(0, idx))
  } catch (e) {
    if (seq !== playRowSeq) return
    rowMsg.value = e.message
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { text: e.message, type: 'error' } }))
  } finally {
    if (seq === playRowSeq) loadingId.value = null
  }
}

function playAll() {
  if (!list.value.length) return
  // 从第一首开始顺序播放整列表（未缓存的歌曲轮到时自动解析）
  playOnlineRow(list.value[0])
}

async function toggleOnlineFav(item) {
  if (favLoadingId.value) return
  favLoadingId.value = item.sourceId
  rowMsg.value = ''
  try {
    const r = await window.mscAPI.toggleFavoriteBySource(item.sourceId, { ...item })
    if (!r.ok) {
      const msg = `「${item.title}」收藏失败：${r.error}`
      rowMsg.value = msg
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { text: msg, type: 'error' } }))
      return
    }
    const next = new Set(favSourceIds.value)
    if (r.favorited) next.add(item.sourceId)
    else next.delete(item.sourceId)
    favSourceIds.value = next
  } catch (e) {
    rowMsg.value = e.message
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { text: e.message, type: 'error' } }))
  } finally {
    favLoadingId.value = ''
  }
}

function formatDur(sec) {
  if (!sec || isNaN(sec)) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

onMounted(() => {
  loadFavState()
  load()
})
</script>

<style scoped>
.singer-page {
  padding: 24px 32px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.singer-head {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 24px;
}
.singer-avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  overflow: hidden;
  background: #242424;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.singer-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.singer-meta {
  flex: 1;
  min-width: 0;
}
.singer-name {
  font-size: 26px;
  font-weight: 800;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.singer-sub {
  font-size: 12px;
  color: #8a8a8a;
}
.play-all {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 18px;
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.play-all:hover {
  background: #2bb371;
}
.play-all:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.hint {
  font-size: 13px;
  color: #8a8a8a;
  padding: 8px 0;
}
.hint.err {
  color: #ff7676;
}
.row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 36px 180px 56px;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
}
.row-cover-cell {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  background: #242424;
}
.row-cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-ph {
  color: #555;
  font-size: 16px;
  line-height: 40px;
  display: block;
  text-align: center;
}
.cover-play {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
}
.row:hover .cover-play,
.cover-play.always {
  display: flex;
}
.row:hover {
  background: #262626;
}
.row.playing .row-name {
  color: var(--accent);
}
.row.loading {
  opacity: 0.5;
  pointer-events: none;
}
.row-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.row-name {
  font-size: 14px;
  color: #e8e8e8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.vip-badge {
  flex: none;
  font-size: 10px;
  color: #ffb023;
  border: 1px solid #ffb023;
  border-radius: 4px;
  padding: 0 4px;
  line-height: 15px;
}
.row-fav {
  border: none;
  background: transparent;
  color: #6a6a6a;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  opacity: 0.45;
  transition: opacity 0.15s, color 0.15s, transform 0.15s;
}
.row-fav:hover {
  opacity: 1;
  color: var(--accent);
  transform: scale(1.15);
}
.row-fav.active {
  color: #ec4141;
  opacity: 1;
}
.row-fav.active:hover {
  color: #ff6b6b;
}
.row-fav.busy {
  opacity: 0.3;
  pointer-events: none;
}
.row-album {
  font-size: 12px;
  color: #9a9a9a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-dur {
  font-size: 12px;
  color: #9a9a9a;
  text-align: right;
}
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
