<template>
  <div class="search-page" @scroll="onScroll">
    <div class="page-title">搜索「{{ keyword }}」</div>

    <!-- 在线结果 -->
    <div v-if="sourceConfigured" class="section">
      <div class="sec-head">
        <span class="sec-title">在线音乐</span>
        <span class="sec-sub">{{ sourceTypeLabel }}{{ onlineSearched ? ` · ${onlineList.length} 首` : '' }}</span>
      </div>

      <div v-if="onlineSearching" class="hint">在线搜索中...</div>
      <div v-else-if="onlineError" class="hint err">{{ onlineError }}</div>
      <template v-else-if="onlineList.length">
        <div
          v-for="item in onlineList"
          :key="item.sourceId + (item.__page || '')"
          class="row"
          :class="{ loading: loadingId === item.sourceId }"
          @click="playOnlineRow(item)"
        >
          <span class="row-cover-cell">
            <img
              v-if="(item.coverUrl || higequCovers[item.sourceId] || gequbaoCovers[item.sourceId] || gmmp3Covers[item.sourceId]) && !isBroken('sr-o-' + (item.id || item.sourceId))"
              :src="item.coverUrl || higequCovers[item.sourceId] || gequbaoCovers[item.sourceId] || gmmp3Covers[item.sourceId]"
              class="row-cover"
              loading="lazy"
              referrerpolicy="no-referrer"
              alt=""
              @error="e => onCoverError(e, 'sr-o-' + (item.id || item.sourceId), () => {
                if (item.coverUrl) item.coverUrl = ''
                if (higequCovers.value && higequCovers.value[item.sourceId]) {
                  const hc = { ...higequCovers.value }; delete hc[item.sourceId]; higequCovers.value = hc
                }
                if (gequbaoCovers.value && gequbaoCovers.value[item.sourceId]) {
                  const gc = { ...gequbaoCovers.value }; delete gc[item.sourceId]; gequbaoCovers.value = gc
                }
                if (gmmp3Covers.value && gmmp3Covers.value[item.sourceId]) {
                  const mc = { ...gmmp3Covers.value }; delete mc[item.sourceId]; gmmp3Covers.value = mc
                }
              })"
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
          <div class="row-artist clickable" title="查看歌手" @click.stop="goSinger(item)">{{ item.artist }}</div>
          <div class="row-album">{{ item.album }}</div>
          <div class="row-dur">{{ formatDur(item.duration) }}</div>
        </div>
        <div v-if="rowMsg" class="hint err">{{ rowMsg }}</div>
        <!-- 分页：滚动到底自动加载下一页 -->
        <div v-if="loadingMore" class="hint load-more-hint">正在加载更多...</div>
        <div v-else-if="onlineHasMore" class="hint load-more-hint clickable" @click="loadMore">加载更多 ↓</div>
        <div v-else class="hint load-more-hint">已加载全部结果</div>
      </template>
      <div v-else class="hint">没有搜到在线结果</div>
    </div>

    <div v-else class="section">
      <div class="sec-head">
        <span class="sec-title">在线音乐</span>
      </div>
      <div class="hint">
        未接入音源，只能在本地搜索。
        <a class="link" href="#" @click.prevent="$emit('goOnline')">去接入在线音源 →</a>
      </div>
    </div>

    <!-- 本地结果 -->
    <div class="section">
      <div class="sec-head">
        <span class="sec-title">本地音乐</span>
        <span class="sec-sub">{{ localList.length }} 首</span>
      </div>
      <div v-if="localList.length">
        <div
          v-for="song in localList"
          :key="song.id"
          class="row local"
          :class="{ playing: player.currentTrack?.id === song.id }"
          @click="playLocal(song)"
        >
          <span class="row-cover-cell">
            <img
              v-if="localCovers[song.id] && !isBroken('sr-l-' + song.id)"
              :src="localCovers[song.id]"
              class="row-cover"
              alt=""
              referrerpolicy="no-referrer"
              @error="e => onCoverError(e, 'sr-l-' + song.id, () => { const c = { ...localCovers.value }; delete c[song.id]; localCovers.value = c; })"
            />
            <span v-else class="cover-ph">♪</span>
          </span>
          <div class="row-main">
            <span class="row-name">{{ song.title }}</span>
          </div>
          <button
            class="row-fav"
            :class="{ active: song.favorited }"
            :title="song.favorited ? '取消收藏' : '收藏'"
            @click.stop="toggleLocalFav(song)"
          >
            <svg v-if="song.favorited" viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"/></svg>
            <svg v-else viewBox="0 0 24 24" width="15" height="15"><path fill="none" stroke="currentColor" stroke-width="2" d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"/></svg>
          </button>
          <div class="row-artist">{{ song.artist }}</div>
          <div class="row-album">{{ song.album }}</div>
          <div class="row-dur">{{ formatDuration(song.duration) }}</div>
        </div>
      </div>
      <div v-else class="hint">本地没有匹配的歌曲</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useCover } from '../composables/useCover'
import { SOURCE_NAMES } from '../constants/sources'

const props = defineProps({
  keyword: { type: String, default: '' }
})
const emit = defineEmits(['goOnline', 'openSinger'])

const player = usePlayerStore()
const { isBroken, resetAllBroken, onCoverError } = useCover()

const localList = ref([])
const localCovers = ref({})
const onlineList = ref([])
const onlineSearching = ref(false)
const onlineSearched = ref(false)
const onlineError = ref('')
const rowMsg = ref('')
const loadingId = ref('')
const sourceConfigured = ref(false)
const sourceType = ref('netease')
const sourceTypeLabel = computed(() => SOURCE_NAMES[sourceType.value] || sourceType.value)

// 在线搜索分页状态
const onlinePage = ref(1)
const onlineHasMore = ref(false)
const loadingMore = ref(false)

// Hi歌曲源封面懒补（源站搜索页无封面，逐首抓播放页 og:image）
const higequCovers = ref({})
let higequCoverToken = 0

watch(
  onlineList,
  (list) => {
    if (sourceType.value !== 'higequ' || !list.length) return
    const token = ++higequCoverToken
    ;(async () => {
      for (const it of list) {
        if (token !== higequCoverToken) return
        if (it.coverUrl || higequCovers.value[it.sourceId]) continue
        try {
          const r = await window.mscAPI.getHigequCover(it.sourceId)
          if (token !== higequCoverToken) return
          if (r?.ok && r.coverUrl) higequCovers.value = { ...higequCovers.value, [it.sourceId]: r.coverUrl }
        } catch {}
      }
    })()
  },
  { deep: false }
)

// 歌曲宝源封面懒补（源站搜索页无封面，逐首抓播放页 appData.mp3_cover）
const gequbaoCovers = ref({})
let gequbaoCoverToken = 0

watch(
  onlineList,
  (list) => {
    if (sourceType.value !== 'gequbao' || !list.length) return
    const token = ++gequbaoCoverToken
    ;(async () => {
      // 只补首屏前 12 首，减少对源站的播放页请求（抓多了会触发源站限流）
      for (const it of list.slice(0, 12)) {
        if (token !== gequbaoCoverToken) return
        if (it.coverUrl || gequbaoCovers.value[it.sourceId]) continue
        try {
          const r = await window.mscAPI.getGequbaoCover(it.sourceId)
          if (token !== gequbaoCoverToken) return
          if (r?.ok && r.coverUrl) gequbaoCovers.value = { ...gequbaoCovers.value, [it.sourceId]: r.coverUrl }
        } catch {}
      }
    })()
  },
  { deep: false }
)

// 闺蜜音乐源封面懒补（源站搜索页无封面，逐首抓歌曲页 og:image）
const gmmp3Covers = ref({})
let gmmp3CoverToken = 0

watch(
  onlineList,
  (list) => {
    if (sourceType.value !== 'gmmp3' || !list.length) return
    const token = ++gmmp3CoverToken
    ;(async () => {
      // 只补首屏前 12 首，减少对源站的歌曲页请求
      for (const it of list.slice(0, 12)) {
        if (token !== gmmp3CoverToken) return
        if (it.coverUrl || gmmp3Covers.value[it.sourceId]) continue
        try {
          const r = await window.mscAPI.getGmmp3Cover(it.sourceId)
          if (token !== gmmp3CoverToken) return
          if (r?.ok && r.coverUrl) gmmp3Covers.value = { ...gmmp3Covers.value, [it.sourceId]: r.coverUrl }
        } catch {}
      }
    })()
  },
  { deep: false }
)

// 收藏状态（红心）：在线按 sourceId，本地按歌曲 id
const favSourceIds = ref(new Set())
const favIdSet = ref(new Set())
const favLoadingId = ref('')

async function loadFavState() {
  try {
    const [srcIds, ids] = await Promise.all([
      window.mscAPI.listFavoriteSourceIds(),
      window.mscAPI.listFavoriteIds()
    ])
    favSourceIds.value = new Set(srcIds)
    favIdSet.value = new Set(ids)
  } catch {}
}

async function toggleOnlineFav(item) {
  if (favLoadingId.value) return
  favLoadingId.value = item.sourceId
  rowMsg.value = ''
  try {
    // 展开成普通对象再过 IPC（Vue Proxy 无法结构化克隆）
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

async function toggleLocalFav(song) {
  try {
    const r = await window.mscAPI.toggleFavorite(song.id)
    song.favorited = !!r?.favorited
    const next = new Set(favIdSet.value)
    if (song.favorited) next.add(song.id)
    else next.delete(song.id)
    favIdSet.value = next
  } catch {}
}

let lastKeyword = ''

async function loadAll() {
  const kw = props.keyword.trim()
  if (!kw) return
  lastKeyword = kw

  // 收藏状态（本地列表标记红心用）
  loadFavState()

  // 本地
  try {
    const result = await window.mscAPI.listMusic({ keyword: kw, page: 1, pageSize: 100 })
    localList.value = (result.list || []).map(s => ({ ...s, favorited: favIdSet.value.has(s.id) }))
    loadLocalCovers()
  } catch {
    localList.value = []
  }

  // 在线
  try {
    const st = await window.mscAPI.getOnlineStatus()
    sourceConfigured.value = !!st.configured
    sourceType.value = ['qq', 'netease', 'higequ', 'gequbao', 'onemusic', 'xmwav', 'gmmp3'].includes(st.type) ? st.type : 'netease'
  } catch {
    sourceConfigured.value = false
  }

  onlineList.value = []
  onlineError.value = ''
  onlineSearched.value = false
  onlinePage.value = 1
  onlineHasMore.value = false
  resetAllBroken()
  if (!sourceConfigured.value) return

  onlineSearching.value = true
  try {
    const r = await window.mscAPI.searchOnline(kw, 1)
    if (r.ok) {
      onlineList.value = (r.list || []).map((it) => ({ ...it, __page: 1 }))
      onlineHasMore.value = !!r.hasMore
    } else {
      onlineError.value = r.error || '在线搜索失败'
    }
    onlineSearched.value = true
  } catch (e) {
    onlineError.value = e.message
  } finally {
    onlineSearching.value = false
  }
}

// 加载下一页在线结果（滚动到底或点击触发）
async function loadMore() {
  if (loadingMore.value || onlineSearching.value || !onlineHasMore.value) return
  loadingMore.value = true
  try {
    const next = onlinePage.value + 1
    const r = await window.mscAPI.searchOnline(props.keyword.trim(), next)
    if (!r.ok) {
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { text: r.error || '加载更多失败', type: 'error' } }))
      return
    }
    const seen = new Set(onlineList.value.map((it) => it.sourceId))
    const items = (r.list || [])
      .filter((it) => !seen.has(it.sourceId))
      .map((it) => ({ ...it, __page: next }))
    onlineList.value = [...onlineList.value, ...items]
    onlinePage.value = next
    onlineHasMore.value = !!r.hasMore && items.length > 0
  } catch (e) {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { text: e.message, type: 'error' } }))
  } finally {
    loadingMore.value = false
  }
}

// 列表滚动到底部自动加载下一页
function onScroll(e) {
  if (loadingMore.value || !onlineHasMore.value) return
  const el = e.target
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) loadMore()
}

async function loadLocalCovers() {
  for (const s of localList.value) {
    if (localCovers.value[s.id]) continue
    try {
      const d = await window.mscAPI.getCoverDataUrl(s.id)
      if (d) localCovers.value = { ...localCovers.value, [s.id]: d }
    } catch {}
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
    // 解析后的歌替换列表对应项；其余按搜索结果顺序作为占位，
    // 点"下一曲/上一曲"轮到时由 player 自动解析入库，实现整列表连播
    // r.song 是数据库行（source_id 命名），必须补 sourceId，否则点击行定位失效 → 永远播第 0 首
    const resolved = { ...r.song, sourceId: item.sourceId }
    if (item.singerId) {
      resolved.singerId = item.singerId
      resolved.singerSource = sourceType.value
    }
    // 先在原始列表上定位点击行，再做替换
    const idx = onlineList.value.findIndex((it) => it.sourceId === item.sourceId)
    const tracks = onlineList.value.map((it) => {
      if (it.sourceId === item.sourceId) return resolved
      return {
        title: it.title,
        artist: it.artist,
        album: it.album,
        duration: it.duration || 0,
        coverUrl: it.coverUrl || '',
        vip: !!it.vip,
        sourceId: it.sourceId,
        onlineType: it.onlineType || sourceType.value,
        singerId: it.singerId,
        singerSource: it.singerId ? sourceType.value : undefined
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

// 点击歌手名 → 歌手页
function goSinger(item) {
  if (!item.singerId) {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { text: '该歌曲未提供歌手信息', type: 'info' } }))
    return
  }
  emit('openSinger', { source: sourceType.value, singerId: item.singerId, name: item.artist })
}

function playLocal(song) {
  const idx = player.queue.findIndex(s => s.id === song.id)
  if (idx >= 0) {
    player.playIndex(idx)
  } else {
    player.setQueue([song, ...localList.value.filter(s => s.id !== song.id)], 0)
  }
}

function formatDur(sec) {
  if (!sec || isNaN(sec)) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDuration(sec) {
  return formatDur(sec)
}

watch(
  () => props.keyword,
  (val) => {
    if (val && val.trim() && val.trim() !== lastKeyword) {
      loadAll()
    }
  }
)

loadAll()

// 账号面板切换音源后，按新音源重新搜索当前关键词
function onSourceChangedExternally() {
  if (props.keyword.trim()) loadAll()
}
window.addEventListener('app:source-changed', onSourceChangedExternally)
onUnmounted(() => {
  window.removeEventListener('app:source-changed', onSourceChangedExternally)
})
</script>

<style scoped>
.search-page {
  padding: 24px 32px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.page-title {
  font-size: 24px;
  font-weight: 800;
  margin-bottom: 20px;
}
.section {
  margin-bottom: 28px;
}
.sec-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
}
.sec-title {
  font-size: 16px;
  font-weight: 700;
}
.sec-sub {
  font-size: 12px;
  color: #8a8a8a;
}
.hint {
  font-size: 13px;
  color: #8a8a8a;
  padding: 8px 0;
}
.hint.err {
  color: #ff7676;
}
.load-more-hint {
  text-align: center;
  padding: 12px 0 4px;
}
.load-more-hint.clickable {
  cursor: pointer;
  color: var(--accent);
}
.load-more-hint.clickable:hover {
  text-decoration: underline;
}
.link {
  color: var(--accent);
  text-decoration: none;
}
.link:hover {
  text-decoration: underline;
}
.row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 36px 160px 180px 56px;
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
/* 红心列 */
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
.row-artist,
.row-album {
  font-size: 12px;
  color: #9a9a9a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-artist.clickable {
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.15s;
}
.row-artist.clickable:hover {
  color: var(--accent);
}
.row-dur {
  font-size: 12px;
  color: #9a9a9a;
  text-align: right;
}
</style>
