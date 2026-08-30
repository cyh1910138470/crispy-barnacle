<template>
  <div class="cf-page" @scroll="onScroll">
    <div class="cf-header">
      <div class="cf-icon" :style="{ background: type === 'qq' ? 'linear-gradient(135deg,#31c27c,#1aa767)' : 'linear-gradient(135deg,#ff3b30,#e02020)' }">
        <svg v-if="type === 'qq'" viewBox="0 0 24 24" width="22" height="22"><path fill="#fff" d="M12 3a9 9 0 00-4.13 17A11 11 0 016 20H3a1 1 0 000 2h3v1h2v-1h1v1h2v-1h4v1h2v-1h3a1 1 0 100-2h-3a11 11 0 01-1.87-1A9 9 0 0012 3zm0 4a3 3 0 110 6 3 3 0 010-6z"/></svg>
        <svg v-else viewBox="0 0 24 24" width="22" height="22"><path fill="#fff" d="M12 2a7 7 0 00-7 7v7a4 4 0 104-4V9a3 3 0 016 0v7a5 5 0 11-2-4V9z"/></svg>
      </div>
      <div class="cf-meta">
        <div class="cf-tag">{{ type === 'qq' ? 'QQ音乐' : '网易云音乐' }} · 我喜欢</div>
        <h1 class="cf-title">{{ playlistTitle || '我喜欢的音乐' }}</h1>
        <div class="cf-sub">
          <span v-if="loggedIn">{{ qqUin ? 'QQ ' + qqUin : neteaseNickname || '已登录' }}</span>
          <span v-else class="not-login">未登录</span>
          <span class="sep">·</span>
          <span>共 {{ totalCount }} 首</span>
          <span v-if="switchedToCount" class="sep">·</span>
          <span v-if="switchedToCount" class="fallback-hint">已自动换源 {{ switchedToCount }} 首</span>
        </div>
        <div class="cf-actions">
          <button class="play-btn" :disabled="!list.length" @click="playRow(list[0])">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="#fff" d="M8 5v14l11-7z"/></svg>
            <span>播放全部</span>
          </button>
          <button class="refresh-btn" :disabled="loading" @click="reload">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            <span>刷新</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="!loggedIn" class="cf-empty-login">
      <svg viewBox="0 0 24 24" width="56" height="56" class="empty-ic"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M12 11c1.66 0 3-1.34 3-3S13.66 5 12 5 9 6.34 9 8s1.34 3 3 3zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
      <div class="empty-title">还没有登录{{ type === 'qq' ? 'QQ音乐' : '网易云' }}账号</div>
      <div class="empty-sub">登录后可以直接同步你在官方 App 里点过「喜欢」的全部歌曲</div>
      <button class="go-login-btn" @click="goToOnlineLogin">
        去「在线音乐」页登录 →
      </button>
    </div>

    <template v-else>
      <div v-if="loading && list.length === 0" class="cf-status">正在加载收藏列表...</div>
      <div v-else-if="error" class="cf-status err">{{ error }}</div>
      <template v-else>
        <div class="cf-table-head">
          <div class="th">#</div>
          <div class="th title">标题</div>
          <div class="th fav">喜欢</div>
          <div class="th artist">歌手</div>
          <div class="th album">专辑</div>
          <div class="th source">来源</div>
          <div class="th dur">时长</div>
        </div>

        <div
          v-for="(item, idx) in list"
          :key="item.sourceId + '-' + (item.__page || 0)"
          class="cf-row"
          :class="{ loading: loadingId === item.sourceId, playing: player.currentTrack?.sourceId === item.sourceId }"
          @click="playRow(item)"
        >
          <div class="td idx">
            <span class="idx-num">{{ idx + 1 }}</span>
            <span class="cover-cell">
              <img
                v-if="effectiveCover(item) && !isBroken('cf-' + (item.id || item.sourceId))"
                :src="effectiveCover(item)"
                loading="lazy"
                referrerpolicy="no-referrer"
                alt=""
                class="row-cover"
                @error="onCoverError(item)"
              />
              <span v-else class="cover-ph">♪</span>
              <span v-if="loadingId === item.sourceId" class="cover-play always"><span class="spinner"></span></span>
              <span v-else class="cover-play">
                <svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
              </span>
            </span>
          </div>
          <div class="td title-col">
            <div class="t-line">
              <span class="t-name">{{ item.title }}</span>
              <span v-if="item.vip" class="vip-badge" title="VIP 歌曲，会员过期会自动换源">VIP</span>
              <span v-if="item.__switchedFrom" class="switched-tag" :title="'原源播放失败，已切换到 ' + SOURCE_NAMES[item.__switchedTo]">
                🔀 {{ SOURCE_NAMES[item.__switchedTo] }}
              </span>
            </div>
          </div>
          <div class="td fav-col">
            <button
              class="row-fav"
              :class="{ active: favSourceIds.has(item.sourceId), busy: favLoadingId === item.sourceId }"
              :title="favSourceIds.has(item.sourceId) ? '取消本地收藏' : '收藏到本地'"
              @click.stop="toggleFav(item)"
            >
              <svg v-if="favSourceIds.has(item.sourceId)" viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"/></svg>
              <svg v-else viewBox="0 0 24 24" width="15" height="15"><path fill="none" stroke="currentColor" stroke-width="2" d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"/></svg>
            </button>
          </div>
          <div class="td artist-col" :title="item.artist">{{ item.artist }}</div>
          <div class="td album-col" :title="item.album">{{ item.album }}</div>
          <div class="td source-col">
            <span class="src-pill" :class="'src-' + (item.__switchedTo || item.onlineType || type)">
              {{ SOURCE_NAMES[item.__switchedTo || item.onlineType || type] || (item.onlineType || type) }}
            </span>
          </div>
          <div class="td dur-col">{{ formatDur(item.duration) }}</div>
        </div>

        <div v-if="rowMsg" class="cf-status tip">{{ rowMsg }}</div>

        <div v-if="loadingMore" class="cf-status load-more">正在加载更多...</div>
        <div v-else-if="hasMore" class="cf-status load-more clickable" @click="loadMore">加载更多 ↓</div>
        <div v-else-if="list.length" class="cf-status load-more">已加载全部 {{ totalCount }} 首歌曲</div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useCover } from '../composables/useCover'
import { SOURCE_NAMES } from '../constants/sources'

const props = defineProps({
  /** 'qq' 或 'netease' */
  type: { type: String, required: true }
})
const emit = defineEmits(['goOnlineLogin'])

const player = usePlayerStore()
const { isBroken, resetAllBroken } = useCover()

const list = ref([])
const totalCount = ref(0)
const playlistTitle = ref('')
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(false)
const page = ref(1)
const error = ref('')
const rowMsg = ref('')
const loadingId = ref('')

// 登录态
const loggedIn = ref(false)
const qqUin = ref('')
const neteaseNickname = ref('')

// 收藏
const favSourceIds = ref(new Set())
const favLoadingId = ref('')

// 跨源 fallback 统计（展示提示用）
const switchedToCount = computed(() => list.value.filter((it) => it.__switchedTo).length)

const PAGE_SIZE = 50

// 封面补全（Hi歌曲/歌曲宝/闺蜜音乐源需要按 sourceId 抓播放页）
const extraCovers = ref({})
let coverToken = 0
watch(
  list,
  (lst) => {
    if (!lst.length) return
    const token = ++coverToken
    ;(async () => {
      for (const it of lst.slice(0, 24)) {
        if (token !== coverToken) return
        if (it.coverUrl || extraCovers.value[it.sourceId]) continue
        const t = it.onlineType || props.type
        try {
          let r = null
          if (t === 'higequ') r = await window.mscAPI.getHigequCover(it.sourceId)
          else if (t === 'gequbao') r = await window.mscAPI.getGequbaoCover(it.sourceId)
          else if (t === 'gmmp3') r = await window.mscAPI.getGmmp3Cover(it.sourceId)
          if (token !== coverToken) return
          if (r?.ok && r.coverUrl) extraCovers.value = { ...extraCovers.value, [it.sourceId]: r.coverUrl }
        } catch {}
      }
    })()
  },
  { deep: false }
)

function effectiveCover(item) {
  return item.coverUrl || extraCovers.value?.[item.sourceId] || ''
}
function onCoverError(item) {
  if (item.coverUrl) item.coverUrl = ''
  if (extraCovers.value?.[item.sourceId]) {
    const c = { ...extraCovers.value }; delete c[item.sourceId]; extraCovers.value = c
  }
}

async function checkLogin() {
  try {
    const info = await window.mscAPI.getLoginInfo()
    if (props.type === 'qq') {
      loggedIn.value = !!(info.loggedIn && info.uin)
      qqUin.value = info.uin || ''
      neteaseNickname.value = ''
    } else {
      loggedIn.value = !!info.neteaseLoggedIn
      neteaseNickname.value = info.neteaseNickname || ''
      qqUin.value = ''
    }
  } catch {
    loggedIn.value = false
  }
}

async function loadFavState() {
  try {
    const ids = await window.mscAPI.listFavoriteSourceIds()
    favSourceIds.value = new Set(ids)
  } catch {}
}

async function fetchPage(p) {
  const r = props.type === 'qq'
    ? await window.mscAPI.getQqLikedSongs(p, PAGE_SIZE)
    : await window.mscAPI.getNeteaseLikedSongs(p, PAGE_SIZE)
  if (!r.ok) throw new Error(r.error || '拉取失败')
  if (r.playlist?.title) playlistTitle.value = r.playlist.title
  totalCount.value = Number(r.total || 0)
  hasMore.value = !!r.hasMore
  return (r.list || []).map((it) => ({ ...it, __page: p }))
}

async function loadFirstPage() {
  loading.value = true
  error.value = ''
  rowMsg.value = ''
  page.value = 1
  resetAllBroken()
  extraCovers.value = {}
  try {
    list.value = await fetchPage(1)
  } catch (e) {
    error.value = e.message
    list.value = []
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  try {
    const next = page.value + 1
    const items = await fetchPage(next)
    const seen = new Set(list.value.map((it) => it.sourceId))
    const unique = items.filter((it) => !seen.has(it.sourceId))
    list.value = [...list.value, ...unique]
    page.value = next
    hasMore.value = hasMore.value && unique.length > 0
  } catch (e) {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { text: '加载更多失败：' + e.message, type: 'error' } }))
  } finally {
    loadingMore.value = false
  }
}

function onScroll(e) {
  if (loadingMore.value || !hasMore.value) return
  const el = e.target
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 260) loadMore()
}

function reload() {
  loadFavState()
  loadFirstPage()
}

function goToOnlineLogin() {
  emit('goOnlineLogin')
}

// 点歌序号令牌：快速切歌时避免旧结果回来污染
let playSeq = 0

async function playRow(item) {
  if (!item) return
  const seq = ++playSeq
  loadingId.value = item.sourceId
  rowMsg.value = ''
  try {
    // 走云端收藏专属的播放接口：先原源，VIP/登录失效自动跨源兜底
    const r = await window.mscAPI.playCloudFavorite({ ...item })
    if (seq !== playSeq) return

    // 🚫 终极防御：ok 为 true 但入库后没 song.id（播放器靠 id 取 base64 DataUrl），也要走失败提示
    if (!r.ok || !r.song || !r.song.id) {
      const friendly = (!r.ok && r.error) ? r.error : '这首歌暂时没有可播放的音频地址，正在尝试其他音源，请稍后再试一次'
      const shortMsg = `😢 暂时听不了《${item.title}》`
      rowMsg.value = friendly
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { text: shortMsg, type: 'info', duration: 4500 }
      }))
      return
    }
    // 展示跨源切换的小提示
    if (r.switchedFrom && r.switchedTo) {
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: {
          text: `原源(${SOURCE_NAMES[r.switchedFrom]})不可用，已切换到 ${SOURCE_NAMES[r.switchedTo]} 播放`,
          type: 'info'
        }
      }))
    }
    // 解析好的歌：source_id 要补 sourceId（DB 列名 snake_case）
    const resolved = {
      ...r.song,
      sourceId: r.song?.sourceId || item.sourceId,
      __switchedFrom: r.switchedFrom || null,
      __switchedTo: r.switchedTo || null
    }
    if (item.singerId) { resolved.singerId = item.singerId; resolved.singerSource = item.onlineType || props.type }

    // 在原始列表定位索引（先定位再替换，避免 sourceId 匹配不上永远播第一首）
    const raw = list.value
    const idx = raw.findIndex((x) => x.sourceId === item.sourceId)
    const tracks = raw.map((it) => {
      if (it.sourceId === item.sourceId) return resolved
      return {
        title: it.title,
        artist: it.artist,
        album: it.album,
        duration: it.duration || 0,
        coverUrl: effectiveCover(it),
        vip: !!it.vip,
        sourceId: it.sourceId,
        onlineType: it.onlineType || props.type,
        singerId: it.singerId,
        singerSource: it.singerId ? (it.onlineType || props.type) : undefined,
        __switchedFrom: it.__switchedFrom || null,
        __switchedTo: it.__switchedTo || null
      }
    })
    // 替换列表当前行（展示 🔀 换源标签用）
    if (idx >= 0) {
      const next = list.value.slice()
      next[idx] = { ...next[idx], __switchedFrom: resolved.__switchedFrom, __switchedTo: resolved.__switchedTo }
      list.value = next
    }
    player.setQueue(tracks, Math.max(0, idx))

    // ☂️ 终极哑巴兜底：setQueue 成功后，3 秒内进度条还没动
    // → 99% 是 Howler 解码失败 / DataUrl MIME 不匹配 / AudioContext 被挂起，弹提示
    const checkSeq = seq
    let retriedPlay = false
    const runStallCheck = (delayMs) => {
      setTimeout(() => {
        if (checkSeq !== playSeq.value) return
        if (player.currentTrack && String(player.currentTrack.id) === String(resolved.id)) {
          const ctNow = Number(player.currentTime || 0)
          const stuck = ctNow < 1
          if (stuck) {
            // 第一次检测到卡住：先尝试「重新调用一次 play()」→ 常能解除 AudioContext 挂起
            if (!retriedPlay) {
              retriedPlay = true
              console.warn(`[CloudFav] ☂️ 3s 进度仍 0，自动再调用一次 player.play() 解除 AudioContext 挂起：《${resolved.title}》`)
              try { player.play(player.currentTrack) } catch (_) {}
              // 再等 3s 测一次，还不行再弹错误
              runStallCheck(3000)
              return
            }
            console.warn(`[CloudFav] ☂️ 两次重试后进度仍 0，判定彻底播放失败：《${resolved.title}》 id=${resolved.id}`)
            const friendlyDetail = r.switchedTo
              ? `（已换源到 ${SOURCE_NAMES[r.switchedTo]}，但音频解码仍失败）`
              : `（解码/加载失败）`
            const msg = `😢《${resolved.title}》还是没播起来 ${friendlyDetail}\n建议：刷新歌单 → 重新点一次试试；或换首歌继续听（小概率清理旧缓存后下一次就好）～`
            rowMsg.value = msg
            window.dispatchEvent(new CustomEvent('app:toast', {
              detail: { text: `😢《${resolved.title}》暂时播不起来，已尝试多源+重试，建议刷新后重点～`, type: 'info', duration: 7000 }
            }))
          }
        }
      }, delayMs)
    }
    runStallCheck(3000)
  } catch (e) {
    if (seq !== playSeq) return
    rowMsg.value = e.message
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { text: e.message, type: 'error' } }))
  } finally {
    if (seq === playSeq) loadingId.value = null
  }
}

async function toggleFav(item) {
  if (favLoadingId.value) return
  favLoadingId.value = item.sourceId
  try {
    const r = await window.mscAPI.toggleFavoriteBySource(item.sourceId, { ...item })
    if (!r.ok) {
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { text: '收藏失败：' + (r.error || ''), type: 'error' }
      }))
      return
    }
    const next = new Set(favSourceIds.value)
    if (r.favorited) next.add(item.sourceId)
    else next.delete(item.sourceId)
    favSourceIds.value = next
  } catch (e) {
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

// 账号登录状态变化后自动刷新
function onLoginStateChange() {
  checkLogin().then((ok) => {
    if (loggedIn.value && !list.value.length) loadFirstPage()
  })
}
window.addEventListener('app:qq-logged-in', onLoginStateChange)
window.addEventListener('app:netease-logged-in', onLoginStateChange)

onMounted(() => {
  loadFavState()
  checkLogin().then(() => {
    if (loggedIn.value) loadFirstPage()
  })
})

watch(
  () => props.type,
  () => {
    loadFavState()
    checkLogin().then(() => {
      if (loggedIn.value) loadFirstPage()
      else { list.value = []; totalCount.value = 0; playlistTitle.value = '' }
    })
  }
)

onUnmounted(() => {
  window.removeEventListener('app:qq-logged-in', onLoginStateChange)
  window.removeEventListener('app:netease-logged-in', onLoginStateChange)
})
</script>

<style scoped>
.cf-page {
  padding: 0;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.cf-header {
  display: flex;
  gap: 22px;
  align-items: flex-end;
  padding: 28px 36px 24px;
  background: linear-gradient(180deg, rgba(var(--accent-rgb), 0.18), rgba(var(--accent-rgb), 0.05) 60%, transparent);
}
.cf-icon {
  width: 140px;
  height: 140px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
  flex-shrink: 0;
}
.cf-meta { min-width: 0; flex: 1; }
.cf-tag {
  display: inline-block;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--accent);
  margin-bottom: 10px;
}
.cf-title {
  font-size: 34px;
  font-weight: 900;
  letter-spacing: 0.2px;
  margin: 0 0 10px;
  line-height: 1.15;
}
.cf-sub {
  font-size: 13px;
  color: #8a8a8a;
  margin-bottom: 18px;
}
.cf-sub .sep { margin: 0 6px; opacity: 0.6; }
.cf-sub .not-login { color: #ff7676; }
.cf-sub .fallback-hint { color: var(--accent); }
.cf-actions { display: flex; gap: 10px; }
.play-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 20px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.play-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
.play-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #ddd;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.refresh-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); color: var(--accent); }
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 未登录空态 */
.cf-empty-login {
  padding: 80px 24px;
  text-align: center;
  color: #8a8a8a;
}
.empty-ic { opacity: 0.5; }
.empty-title { font-size: 18px; color: #ddd; margin: 16px 0 6px; font-weight: 700; }
.empty-sub { font-size: 13px; margin-bottom: 20px; }
.go-login-btn {
  padding: 8px 18px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  border: none;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
}
.go-login-btn:hover { filter: brightness(1.08); }

/* 列表 */
.cf-status {
  padding: 10px 36px;
  font-size: 13px;
  color: #8a8a8a;
  line-height: 1.6;
  white-space: normal;
}
.cf-status.err { color: #ff7676; }
.cf-status.tip {
  color: #d9d9d9;
  background: rgba(var(--accent-rgb), 0.08);
  border: 1px solid rgba(var(--accent-rgb), 0.3);
  border-radius: 10px;
  margin: 12px 36px;
  padding: 12px 16px;
}
.cf-status.load-more { text-align: center; padding: 14px 0 4px; }
.cf-status.load-more.clickable { cursor: pointer; color: var(--accent); }
.cf-status.load-more.clickable:hover { text-decoration: underline; }

.cf-table-head {
  display: grid;
  grid-template-columns: 80px minmax(0, 1.3fr) 48px 1.1fr 1.2fr 120px 70px;
  gap: 14px;
  padding: 10px 36px 8px;
  font-size: 12px;
  color: #777;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  position: sticky;
  top: 0;
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(6px);
  z-index: 2;
}
.th { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.th.idx { text-align: right; padding-right: 8px; }

.cf-row {
  display: grid;
  grid-template-columns: 80px minmax(0, 1.3fr) 48px 1.1fr 1.2fr 120px 70px;
  gap: 14px;
  align-items: center;
  padding: 8px 36px;
  margin: 2px 0;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  transition: background 0.12s;
}
.cf-row:hover { background: rgba(255, 255, 255, 0.05); }
.cf-row.loading { opacity: 0.65; }
.cf-row.playing { background: rgba(var(--accent-rgb), 0.12); }
.cf-row.playing .t-name { color: var(--accent); }

.td { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; color: #ccc; }
.td.idx {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding-right: 8px;
  font-size: 12px; color: #8a8a8a;
  position: relative;
}
.cf-row.playing .idx-num { color: var(--accent); font-weight: 700; }
.cover-cell {
  width: 40px; height: 40px; border-radius: 6px;
  position: relative; overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  display: flex; align-items: center; justify-content: center;
}
.row-cover { width: 100%; height: 100%; object-fit: cover; display: block; }
.cover-ph { color: rgba(255, 255, 255, 0.25); font-size: 16px; font-weight: 700; }
.cover-play {
  position: absolute; inset: 0;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: none;
  align-items: center; justify-content: center;
}
.cover-play.always { display: flex; background: rgba(0, 0, 0, 0.35); }
.cf-row:hover .cover-play:not(.always) { display: flex; }
.spinner {
  width: 14px; height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: var(--accent);
  animation: cf-spin 0.7s linear infinite;
}
@keyframes cf-spin { to { transform: rotate(360deg); } }

.title-col { min-width: 0; }
.t-line { display: flex; align-items: center; gap: 8px; min-width: 0; }
.t-name {
  color: #eee;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-weight: 500;
}
.vip-badge {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: linear-gradient(90deg, #ffc069, #ff9500);
  color: #4b2b00;
  font-weight: 800;
}
.switched-tag {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(var(--accent-rgb), 0.18);
  color: var(--accent);
  border: 1px solid rgba(var(--accent-rgb), 0.4);
}

.fav-col { display: flex; justify-content: center; }
.row-fav {
  background: transparent;
  border: none;
  color: #8a8a8a;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: all 0.12s;
}
.cf-row:hover .row-fav,
.row-fav.active,
.row-fav.busy { opacity: 1; }
.row-fav:hover { color: var(--accent); transform: scale(1.1); }
.row-fav.active { color: var(--accent); opacity: 1; }
.row-fav.busy { opacity: 0.4; }

.artist-col { color: #aaa; }
.album-col { color: #8a8a8a; }
.source-col { }
.src-pill {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: #bbb;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.src-pill.src-qq { color: #31c27c; border-color: rgba(49, 194, 124, 0.4); background: rgba(49, 194, 124, 0.08); }
.src-pill.src-netease { color: #ff4d4f; border-color: rgba(255, 77, 79, 0.4); background: rgba(255, 77, 79, 0.08); }
.src-pill.src-higequ,
.src-pill.src-xmwav,
.src-pill.src-gmmp3 { color: #3ddc84; border-color: rgba(61, 220, 132, 0.4); background: rgba(61, 220, 132, 0.08); }
.src-pill.src-gequbao { color: #ff4d4f; border-color: rgba(255, 77, 79, 0.4); background: rgba(255, 77, 79, 0.08); }
.src-pill.src-onemusic { color: #faad14; border-color: rgba(250, 173, 20, 0.4); background: rgba(250, 173, 20, 0.08); }

.dur-col { text-align: right; color: #8a8a8a; font-size: 12px; padding-right: 6px; }
</style>
