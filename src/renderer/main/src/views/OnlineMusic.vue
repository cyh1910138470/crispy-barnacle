<!-- 在线音乐：音源切换 + 在线搜索试听 -->
<template>
  <div class="online-page">
    <!-- 页面标题 -->
    <h1 class="page-title">在线音乐</h1>

    <!-- 音源切换栏（无需配置：QQ 源内置自动启动，网易云直连官方） -->
    <div class="source-bar">
      <div class="source-switch">
        <button class="type-pill sm" :class="{ active: sourceType === 'qq' }" @click="switchSource('qq')">
          QQ音乐
        </button>
        <button class="type-pill sm" :class="{ active: sourceType === 'netease' }" @click="switchSource('netease')">
          网易云音乐
        </button>
        <button class="type-pill sm" :class="{ active: sourceType === 'higequ' }" title="稳定可用" @click="switchSource('higequ')">
          <span class="pill-dot" :class="SOURCE_QUALITY.higequ"></span>{{ SOURCE_NAMES.higequ }}
        </button>
        <button class="type-pill sm" :class="{ active: sourceType === 'gequbao' }" title="风控较严，可能失败" @click="switchSource('gequbao')">
          <span class="pill-dot" :class="SOURCE_QUALITY.gequbao"></span>{{ SOURCE_NAMES.gequbao }}
        </button>
        <button class="type-pill sm" :class="{ active: sourceType === 'onemusic' }" title="能用但较慢" @click="switchSource('onemusic')">
          <span class="pill-dot" :class="SOURCE_QUALITY.onemusic"></span>{{ SOURCE_NAMES.onemusic }}
        </button>
        <button class="type-pill sm" :class="{ active: sourceType === 'xmwav' }" title="稳定可用" @click="switchSource('xmwav')">
          <span class="pill-dot" :class="SOURCE_QUALITY.xmwav"></span>{{ SOURCE_NAMES.xmwav }}
        </button>
        <button class="type-pill sm" :class="{ active: sourceType === 'gmmp3' }" title="稳定可用" @click="switchSource('gmmp3')">
          <span class="pill-dot" :class="SOURCE_QUALITY.gmmp3"></span>{{ SOURCE_NAMES.gmmp3 }}
        </button>
      </div>
      <span
        class="source-chip"
        :class="{ bad: sourceType === 'qq' && !configured }"
      >
        <svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M12 1a5 5 0 00-5 5v3H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2v-9a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm-3 8V6a3 3 0 016 0v3z"/></svg>
        {{ sourceType === 'netease' ? '免登录直连' : sourceType === 'higequ' || sourceType === 'gequbao' || sourceType === 'onemusic' || sourceType === 'xmwav' || sourceType === 'gmmp3' ? '免费直连' : configured ? '内置音源' : '音源未就绪' }}
      </span>
    </div>

    <!-- QQ 音源未就绪（内置服务启动失败的兜底提示） -->
    <div v-if="sourceType === 'qq' && !configured" class="setup-card">
      <div class="setup-icon">
        <svg viewBox="0 0 24 24" width="34" height="34"><path fill="currentColor" d="M12 3v9.28A4.39 4.39 0 0010 12a4 4 0 104 4V7h6V3z"/></svg>
      </div>
      <div class="setup-title">内置音源未就绪</div>
      <div class="setup-desc">
        QQ 音乐源随应用自动启动，当前不可用。<br />
        请完全退出应用后重新打开；若仍失败，检查是否有其他程序占用端口。
      </div>
    </div>

    <!-- 搜索区 -->
    <div v-else class="search-area">

      <!-- QQ 账号登录区（仅 QQ 源） -->
      <div v-if="sourceType === 'qq'" class="login-bar">
        <template v-if="loginInfo.loggedIn">
          <span class="login-ok">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
            已登录 QQ：{{ loginInfo.uin || '已授权账号' }}
          </span>
          <button class="logout-btn" @click="doLogout">退出登录</button>
        </template>
        <template v-else>
          <span class="login-hint">未登录 QQ 账号 · VIP 歌曲需要登录你自己的账号才能播放</span>
          <button class="login-btn" @click="openQrLogin">扫码登录</button>
        </template>
      </div>

      <!-- 网易账号登录区（免登录可用，登录后 VIP 歌可完整播放） -->
      <div v-if="sourceType === 'netease'" class="login-bar netease-tip">
        <template v-if="loginInfo.neteaseLoggedIn">
          <svg viewBox="0 0 24 24" width="14" height="14" class="ok"><path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20zm-2 15l-5-5 1.4-1.4L10 14.2l7.6-7.6L19 8l-9 9z"/></svg>
          <span>已登录：{{ loginInfo.neteaseNickname || '网易云用户' }} · VIP 歌曲可完整播放（128k）</span>
          <button class="ghost-btn" @click="doLogoutNetease">退出登录</button>
        </template>
        <template v-else>
          <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11h-5v-2h3V7h2v6z"/></svg>
          <span>免登录可用 · 扫码登录会员账号后，VIP 歌曲也能完整播放</span>
          <button class="login-btn" @click="openNeteaseLogin">扫码登录</button>
        </template>
      </div>

      <div class="search-row">
        <svg viewBox="0 0 24 24" width="16" height="16" class="search-ico"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        <input
          v-model="keyword"
          class="search-input"
          placeholder="搜索歌名 / 歌手，回车搜索"
          @keyup.enter="doSearch"
        />
        <button class="setup-btn" :disabled="searching || !keyword.trim()" @click="doSearch">
          {{ searching ? '搜索中...' : '搜索' }}
        </button>
      </div>

      <div v-if="rowMsg" class="row-error">{{ rowMsg }}</div>

      <div v-if="searchError" class="search-error">{{ searchError }}</div>

      <div class="filter-row" v-if="results.length">
        <label class="free-filter">
          <input type="checkbox" v-model="freeOnly" />
          只看能播的（隐藏 VIP）
        </label>
        <span v-if="freeOnly && shownResults.length === 0" class="dim">
          这一页全是 VIP 歌曲，换个关键词试试
        </span>
      </div>

      <!-- 结果列表 -->
      <div v-if="results.length" class="result-head">
        <span class="col-idx">#</span>
        <span class="col-title">歌曲 / 歌手</span>
        <span class="col-fav"></span>
        <span class="col-album">专辑</span>
        <span class="col-dur">时长</span>
      </div>
      <div v-if="results.length && shownResults.length" class="result-list">
        <div
          v-for="(item, idx) in shownResults"
          :key="item.sourceId"
          class="result-row"
          :class="{ loading: loadingId === item.sourceId }"
          :title="item.vip ? 'VIP 歌曲，可能需要音源登录账号才能播放' : '点击播放'"
          @click="playRow(item)"
        >
          <span class="col-idx cover-cell">
            <img
              v-if="(item.coverUrl || higequCovers[item.sourceId] || gequbaoCovers[item.sourceId] || gmmp3Covers[item.sourceId]) && !isBroken('om-' + (item.id || item.sourceId))"
              :src="item.coverUrl || higequCovers[item.sourceId] || gequbaoCovers[item.sourceId] || gmmp3Covers[item.sourceId]"
              class="row-cover"
              loading="lazy"
              referrerpolicy="no-referrer"
              alt=""
              @error="e => onCoverError(e, 'om-' + (item.id || item.sourceId), () => {
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
          <span class="col-title">
            <span class="r-name">
              {{ item.title }}
              <em v-if="item.vip" class="vip-chip">VIP</em>
              <em v-if="playedIds.has(item.sourceId)" class="cached-chip">已缓存</em>
            </span>
            <span class="r-artist clickable" title="查看歌手" @click.stop="goSinger(item)">{{ item.artist }}</span>
          </span>
          <button
            class="col-fav row-fav"
            :class="{ active: favSourceIds.has(item.sourceId) }"
            :title="favSourceIds.has(item.sourceId) ? '取消收藏' : '收藏'"
            @click.stop="toggleFav(item)"
          >
            <svg v-if="favSourceIds.has(item.sourceId)" viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"/></svg>
            <svg v-else viewBox="0 0 24 24" width="15" height="15"><path fill="none" stroke="currentColor" stroke-width="2" d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"/></svg>
          </button>
          <span class="col-album">{{ item.album }}</span>
          <span class="col-dur">{{ formatDur(item.duration) }}</span>
          <button class="row-play" title="播放" @click.stop="playRow(item)">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!searching" class="empty-tip">
        <div class="empty-ico">♪</div>
        <div>输入关键词，搜你想听的歌</div>
        <div class="dim">点击歌曲会自动缓存并加入播放队列，之后也能在「最近播放」中找到</div>
      </div>

      <div v-if="rowMsg" class="row-error">{{ rowMsg }}</div>
    </div>

    <!-- QQ 扫码登录弹窗 -->
    <div v-if="qrShow" class="qr-mask" @click.self="closeQrLogin">
      <div class="qr-card">
        <div class="qr-title">QQ 音乐扫码登录</div>
        <div class="qr-img-wrap">
          <img v-if="qrImg" :src="qrImg" class="qr-img" :class="{ dimmed: qrExpired }" />
          <div v-if="qrLoading" class="qr-tip">二维码加载中...</div>
          <div v-if="qrExpired" class="qr-expired">
            <span>二维码已失效</span>
            <button class="login-btn" @click="openQrLogin">刷新二维码</button>
          </div>
        </div>
        <div class="qr-status">{{ qrStatus }}</div>
        <div class="qr-tip">使用手机 QQ 扫一扫，登录你自己的 QQ 音乐账号</div>
        <button class="ghost-btn" @click="closeQrLogin">关闭</button>
      </div>
    </div>

    <!-- 网易扫码登录弹窗 -->
    <div v-if="nQrShow" class="qr-mask" @click.self="closeNeteaseQrLogin">
      <div class="qr-card">
        <div class="qr-title">网易云账号登录</div>
        <div class="qr-tip" style="margin: 14px 0">
          正在打开网易云官方登录页…<br />
          在弹出的窗口里扫码或输入账号登录，成功后本窗口自动关闭。
        </div>
        <div class="qr-status">{{ nQrStatus }}</div>
        <button class="ghost-btn" @click="closeNeteaseQrLogin">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useCover } from '../composables/useCover'
import { SOURCE_NAMES, SOURCE_QUALITY } from '../constants/sources'

const player = usePlayerStore()
const { isBroken, resetAllBroken, onCoverError } = useCover()
const emit = defineEmits(['openSinger'])

// 音源状态（configured 仅表示 QQ 内置源是否就绪；网易源免配置直连）
const configured = ref(false)
const sourceType = ref(localStorage.getItem('msc-source-type') || 'netease')
const typeLabel = computed(() => SOURCE_NAMES[sourceType.value] || sourceType.value)

// QQ / 网易 账号登录状态
const loginInfo = ref({ loggedIn: false, uin: '', neteaseLoggedIn: false, neteaseNickname: '' })
const qrShow = ref(false)
const qrImg = ref('')
const qrStatus = ref('')
const qrLoading = ref(false)
const qrExpired = ref(false)
let qrPollTimer = null
let qrToken = null

// 网易登录（官方登录页窗口）
const nQrShow = ref(false)
const nQrStatus = ref('')

// 搜索
const keyword = ref('')
const searching = ref(false)
const results = ref([])
const searchError = ref('')
const rowMsg = ref('')
const loadingId = ref(null)
const playedIds = ref(new Set())
const freeOnly = ref(false)

// 只看免费（非 VIP）结果
const shownResults = computed(() =>
  freeOnly.value ? results.value.filter((i) => !i.vip) : results.value
)

// Hi歌曲源封面懒补（源站搜索页无封面，逐首抓播放页 og:image）
const higequCovers = ref({})
let higequCoverToken = 0

watch(
  () => results.value.map((i) => i.sourceId).join(','),
  () => {
    if (sourceType.value !== 'higequ' || !results.value.length) return
    const token = ++higequCoverToken
    ;(async () => {
      for (const it of results.value) {
        if (token !== higequCoverToken) return
        if (it.coverUrl || higequCovers.value[it.sourceId]) continue
        try {
          const r = await window.mscAPI.getHigequCover(it.sourceId)
          if (token !== higequCoverToken) return
          if (r?.ok && r.coverUrl) higequCovers.value = { ...higequCovers.value, [it.sourceId]: r.coverUrl }
        } catch {}
      }
    })()
  }
)

// 歌曲宝源封面懒补（源站搜索页无封面，逐首抓播放页 appData.mp3_cover）
const gequbaoCovers = ref({})
let gequbaoCoverToken = 0

watch(
  () => results.value.map((i) => i.sourceId).join(','),
  () => {
    if (sourceType.value !== 'gequbao' || !results.value.length) return
    const token = ++gequbaoCoverToken
    ;(async () => {
      // 只补首屏前 12 首，减少对源站的播放页请求（抓多了会触发源站限流）
      for (const it of results.value.slice(0, 12)) {
        if (token !== gequbaoCoverToken) return
        if (it.coverUrl || gequbaoCovers.value[it.sourceId]) continue
        try {
          const r = await window.mscAPI.getGequbaoCover(it.sourceId)
          if (token !== gequbaoCoverToken) return
          if (r?.ok && r.coverUrl) gequbaoCovers.value = { ...gequbaoCovers.value, [it.sourceId]: r.coverUrl }
        } catch {}
      }
    })()
  }
)

// 闺蜜音乐源封面懒补（源站搜索页无封面，逐首抓歌曲页 og:image）
const gmmp3Covers = ref({})
let gmmp3CoverToken = 0

watch(
  () => results.value.map((i) => i.sourceId).join(','),
  () => {
    if (sourceType.value !== 'gmmp3' || !results.value.length) return
    const token = ++gmmp3CoverToken
    ;(async () => {
      // 只补首屏前 12 首，减少对源站的歌曲页请求
      for (const it of results.value.slice(0, 12)) {
        if (token !== gmmp3CoverToken) return
        if (it.coverUrl || gmmp3Covers.value[it.sourceId]) continue
        try {
          const r = await window.mscAPI.getGmmp3Cover(it.sourceId)
          if (token !== gmmp3CoverToken) return
          if (r?.ok && r.coverUrl) gmmp3Covers.value = { ...gmmp3Covers.value, [it.sourceId]: r.coverUrl }
        } catch {}
      }
    })()
  }
)

// 收藏状态（红心）
const favSourceIds = ref(new Set())
const favLoadingId = ref(null)

async function loadFavSourceIds() {
  try {
    const ids = await window.mscAPI.listFavoriteSourceIds()
    favSourceIds.value = new Set(ids)
  } catch {}
}

onMounted(async () => {
  // 网易登录窗口成功后自动刷新登录态并关弹窗
  window.mscAPI.onNeteaseLoginSuccess?.(() => {
    nQrShow.value = false
    refreshLoginInfo()
    window.dispatchEvent(new CustomEvent('app:netease-logged-in'))
  })
  // 账号面板切换音源后同步本页状态（IPC 已由 App.vue 调过，这里只同步 UI）
  window.addEventListener('app:source-changed', onSourceChangedExternally)
  try {
    const st = await window.mscAPI.getOnlineStatus()
    configured.value = !!st.configured
    sourceType.value = ['qq', 'netease', 'higequ', 'gequbao', 'onemusic', 'xmwav', 'gmmp3'].includes(st.type) ? st.type : 'netease'
    localStorage.setItem('msc-source-type', sourceType.value)
    refreshLoginInfo()
  } catch (e) {
    console.warn('[online] 读取音源状态失败:', e)
  }
  loadFavSourceIds()
})

async function refreshLoginInfo() {
  try {
    const info = await window.mscAPI.getLoginInfo()
    loginInfo.value = {
      loggedIn: !!info.loggedIn,
      uin: info.uin || '',
      neteaseLoggedIn: !!info.neteaseLoggedIn,
      neteaseNickname: info.neteaseNickname || ''
    }
  } catch {}
}

async function doLogout() {
  try {
    await window.mscAPI.logoutQQ()
  } catch {}
  loginInfo.value = { ...loginInfo.value, loggedIn: false, uin: '' }
}

async function doLogoutNetease() {
  try {
    await window.mscAPI.logoutNetease()
  } catch {}
  loginInfo.value = { ...loginInfo.value, neteaseLoggedIn: false, neteaseNickname: '' }
}

// ============ 网易登录（官方登录页窗口） ============
async function openNeteaseLogin() {
  nQrShow.value = true
  nQrStatus.value = '等待登录中…'
  try {
    await window.mscAPI.openNeteaseLogin()
  } catch (e) {
    nQrStatus.value = '打开登录窗口失败：' + e.message
  }
}

function closeNeteaseQrLogin() {
  nQrShow.value = false
}

// 切换音源（QQ/网易云/Hi歌曲），清空跨源不通用的搜索结果
async function switchSource(source) {
  if (sourceType.value === source) return
  try {
    const r = await window.mscAPI.setActiveSource(source)
    if (!r?.ok) {
      window.dispatchEvent(
        new CustomEvent('app:toast', {
          detail: { text: r?.message || '切换音源失败', type: 'error' }
        })
      )
      return
    }
    sourceType.value = source
    localStorage.setItem('msc-source-type', source)
    const st = await window.mscAPI.getOnlineStatus()
    configured.value = !!st.configured
    resetAllBroken()
    results.value = []
    higequCovers.value = {}
    gequbaoCovers.value = {}
    gmmp3Covers.value = {}
    searchError.value = ''
    rowMsg.value = ''
    refreshLoginInfo()
    window.dispatchEvent(
      new CustomEvent('app:toast', {
        detail: { text: `音源已切换：${typeLabel.value}`, type: 'success' }
      })
    )
  } catch (e) {
    console.warn('[online] 切换音源失败:', e)
    window.dispatchEvent(
      new CustomEvent('app:toast', { detail: { text: '切换音源失败：' + e.message, type: 'error' } })
    )
  }
}

// 账号面板切源后的同步（App.vue 已调过 IPC，这里只更新本页 UI 与结果列表）
function onSourceChangedExternally(e) {
  const source = e.detail?.source
  if (!source || sourceType.value === source) return
  sourceType.value = source
  localStorage.setItem('msc-source-type', source)
  window.mscAPI.getOnlineStatus?.().then((st) => {
    configured.value = !!st?.configured
  }).catch(() => {})
  resetAllBroken()
  results.value = []
  higequCovers.value = {}
  gequbaoCovers.value = {}
  gmmp3Covers.value = {}
  searchError.value = ''
  rowMsg.value = ''
  refreshLoginInfo()
}

onUnmounted(() => {
  window.removeEventListener('app:source-changed', onSourceChangedExternally)
})

// ============ QQ 扫码登录 ============

async function openQrLogin() {
  qrShow.value = true
  qrExpired.value = false
  qrLoading.value = true
  qrImg.value = ''
  qrStatus.value = '正在获取二维码...'
  const r = await window.mscAPI.getQQLoginQr()
  qrLoading.value = false
  if (!r.ok) {
    qrStatus.value = r.error || '获取二维码失败'
    return
  }
  qrImg.value = r.img
  qrToken = { ptqrtoken: r.ptqrtoken, qrsig: r.qrsig }
  qrStatus.value = '请用手机 QQ 扫描二维码'
  startPolling()
}

function startPolling() {
  stopPolling()
  qrPollTimer = setInterval(async () => {
    if (!qrToken) return
    const r = await window.mscAPI.checkQQLogin(qrToken.ptqrtoken, qrToken.qrsig)
    if (!r.ok) {
      qrStatus.value = r.error || '检查登录状态失败'
      return
    }
    if (r.expired) {
      stopPolling()
      qrExpired.value = true
      return
    }
    if (r.scanned) {
      stopPolling()
      qrStatus.value = '登录成功！'
      loginInfo.value = { loggedIn: true, uin: r.uin || '' }
      window.dispatchEvent(new CustomEvent('app:qq-logged-in'))
      setTimeout(() => {
        closeQrLogin()
      }, 900)
    } else {
      qrStatus.value = '等待扫码中...'
    }
  }, 2500)
}

function stopPolling() {
  if (qrPollTimer) {
    clearInterval(qrPollTimer)
    qrPollTimer = null
  }
}

function closeQrLogin() {
  stopPolling()
  qrShow.value = false
  qrToken = null
}

async function doSearch() {
  const kw = keyword.value.trim()
  if (!kw || searching.value) return
  searching.value = true
  searchError.value = ''
  resetAllBroken()
  results.value = []
  try {
    const r = await window.mscAPI.searchOnline(kw)
    if (r.ok) {
      results.value = r.list
      if (!r.list.length) searchError.value = '没有搜到相关歌曲'
    } else {
      searchError.value = r.error || '搜索失败'
    }
  } catch (e) {
    searchError.value = e.message
  } finally {
    searching.value = false
  }
}

// 点歌序号令牌：连点不同歌时旧请求的结果直接丢弃（后台仍会完成缓存），不再被上一首卡住
let playRowSeq = 0

async function playRow(item) {
  const seq = ++playRowSeq
  loadingId.value = item.sourceId
  rowMsg.value = ''
  try {
    // 关键：{ ...item } 展开成普通对象。Vue 的响应式 Proxy 无法通过 IPC 结构化克隆，
    // 直接传 item 会报 "An object could not be cloned."
    const r = await window.mscAPI.playOnline({ ...item })
    if (seq !== playRowSeq) return
    if (!r.ok) {
      const msg = `「${item.title}」播放失败：${r.error}`
      rowMsg.value = msg
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { text: msg, type: 'error' } }))
      return
    }
    playedIds.value = new Set([...playedIds.value, item.sourceId])
    // 解析后的歌替换列表对应项；其余按搜索顺序作为占位，
    // 点"下一曲/上一曲"轮到时由 player 自动解析入库，实现整列表连播
    // 注意：r.song 是数据库行（source_id 下划线命名），必须补上 sourceId，
    // 否则下面 findIndex 匹配不到 → 永远从第 0 首开始播（点 A 放出 B 的错位 bug）
    const resolved = { ...r.song, sourceId: item.sourceId }
    if (item.singerId) {
      resolved.singerId = item.singerId
      resolved.singerSource = sourceType.value
    }
    // 先在原始列表上定位点击行，再做替换（替换后的 resolved 已不携带占位的 sourceId 匹配语境）
    const idx = shownResults.value.findIndex((it) => it.sourceId === item.sourceId)
    const tracks = shownResults.value.map((it) => {
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

async function toggleFav(item) {
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
    favLoadingId.value = null
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

function formatDur(sec) {
  if (!sec || isNaN(sec)) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
</script>

<style scoped>
.online-page {
  padding: 24px 32px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  color: #e8e8e8;
}
.page-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 20px;
}
.dim {
  color: #7a7a7a;
  font-size: 12px;
}

/* ---- 音源未就绪提示卡片 ---- */
.setup-card {
  max-width: 560px;
  background: #1c1c1c;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 32px;
  text-align: center;
}
.setup-icon {
  color: var(--accent);
  margin-bottom: 10px;
}
.setup-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}
.setup-desc {
  font-size: 13px;
  color: #9a9a9a;
  line-height: 1.7;
  margin-bottom: 18px;
}

/* ---- 搜索区 ---- */
.source-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.source-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent);
  border-radius: 12px;
  padding: 4px 12px;
  font-size: 12px;
}
.source-chip.bad {
  background: rgba(224, 90, 90, 0.12);
  color: #e05a5a;
}
.ghost-btn {
  background: transparent;
  border: 1px solid #333;
  color: #9a9a9a;
  border-radius: 13px;
  height: 26px;
  padding: 0 12px;
  font-size: 12px;
  cursor: pointer;
}
.ghost-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.search-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  position: relative;
}
.search-ico {
  position: absolute;
  left: 16px;
  color: #666;
  pointer-events: none;
}
.search-input {
  flex: 1;
  height: 40px;
  border-radius: 20px;
  border: 1px solid #2a2a2a;
  background: #1c1c1c;
  color: #e8e8e8;
  padding: 0 16px 0 40px;
  font-size: 13px;
  outline: none;
}
.search-input:focus {
  border-color: var(--accent);
}
.search-error {
  color: #e05a5a;
  font-size: 13px;
  padding: 20px 0;
  text-align: center;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 10px;
}
.free-filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #9a9a9a;
  cursor: pointer;
  user-select: none;
}
.free-filter input {
  accent-color: var(--accent);
}
.type-pill {
  border: 1px solid #3a3a3a;
  background: #232323;
  color: #9a9a9a;
  border-radius: 20px;
  padding: 6px 18px;
  font-size: 13px;
  cursor: pointer;
}
.pill-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: 2px;
}
.pill-dot.good {
  background: #3ddc84;
}
.pill-dot.mid {
  background: #faad14;
}
.pill-dot.bad {
  background: #ff4d4f;
}
.type-pill.active {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(var(--accent-rgb), 0.08);
}
/* 音源切换：小号 pill + 分组容器 */
.source-switch {
  display: flex;
  gap: 6px;
}
.type-pill.sm {
  padding: 4px 14px;
  font-size: 12px;
}
/* 网易源提示条 */
.netease-tip {
  color: #9a9a9a;
  font-size: 12px;
}
.login-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 14px;
  background: #232323;
  border: 1px solid #333;
  border-radius: 10px;
}
.login-hint {
  font-size: 12px;
  color: #9a9a9a;
}
.login-ok {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--accent);
}
.login-btn {
  background: var(--accent);
  color: #06140c;
  border: none;
  border-radius: 16px;
  padding: 6px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.login-btn:hover {
  background: #3dd489;
}
.logout-btn {
  margin-left: auto;
  background: transparent;
  color: #9a9a9a;
  border: 1px solid #3a3a3a;
  border-radius: 16px;
  padding: 4px 14px;
  font-size: 12px;
  cursor: pointer;
}
.logout-btn:hover {
  color: #ff6b6b;
  border-color: #ff6b6b;
}
.qr-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}
.qr-card {
  width: 300px;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 14px;
  padding: 24px;
  text-align: center;
}
.qr-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
  color: #e8e8e8;
}
.qr-img-wrap {
  position: relative;
  width: 200px;
  height: 200px;
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr-img {
  width: 200px;
  height: 200px;
  border-radius: 8px;
  background: #fff;
}
.qr-img.dimmed {
  opacity: 0.15;
}
.qr-expired {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  color: #ddd;
  font-size: 13px;
}
.qr-status {
  font-size: 13px;
  color: var(--accent);
  margin-bottom: 6px;
  min-height: 18px;
}
.qr-tip {
  font-size: 12px;
  color: #8a8a8a;
  margin-bottom: 14px;
}

/* ---- 结果列表 ---- */
.result-head,
.result-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 36px minmax(0, 0.7fr) 70px 40px;
  align-items: center;
  gap: 12px;
}
.result-head {
  font-size: 12px;
  color: #7a7a7a;
  padding: 0 8px 8px;
  border-bottom: 1px solid #262626;
}
.result-row {
  padding: 9px 8px;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
}
.result-row:hover {
  background: #1f1f1f;
}
.result-row.loading {
  opacity: 0.6;
}
.col-idx {
  text-align: center;
  color: #7a7a7a;
  font-size: 12px;
  display: flex;
  justify-content: center;
}
.cover-cell {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  background: #242424;
  align-self: center;
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
.result-row:hover .cover-play,
.cover-play.always {
  display: flex;
}
.col-title {
  display: flex;
  flex-direction: column;
  min-width: 0;
  cursor: pointer;
}
.r-name {
  font-size: 13px;
  color: #e8e8e8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cached-chip {
  font-style: normal;
  font-size: 10px;
  color: var(--accent);
  border: 1px solid rgba(var(--accent-rgb), 0.5);
  border-radius: 8px;
  padding: 0 6px;
  margin-left: 6px;
}
.vip-chip {
  font-style: normal;
  font-size: 10px;
  color: #e8b34b;
  border: 1px solid rgba(232, 179, 75, 0.55);
  border-radius: 8px;
  padding: 0 6px;
  margin-left: 6px;
}
.r-artist {
  font-size: 11px;
  color: #7a7a7a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.r-artist.clickable {
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.15s;
}
.r-artist.clickable:hover {
  color: var(--accent);
}
/* 红心列 */
.col-fav.row-fav {
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
.col-fav.row-fav:hover {
  opacity: 1;
  color: var(--accent);
  transform: scale(1.15);
}
.col-fav.row-fav.active {
  color: #ec4141;
  opacity: 1;
}
.col-fav.row-fav.active:hover {
  color: #ff6b6b;
}
.col-album {
  font-size: 12px;
  color: #9a9a9a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.col-dur {
  font-size: 12px;
  color: #7a7a7a;
  text-align: right;
}
.row-play {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}
.result-row:hover .row-play {
  opacity: 1;
}
.spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(var(--accent-rgb), 0.25);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.row-error {
  margin-top: 14px;
  font-size: 12px;
  color: #e05a5a;
  background: rgba(224, 90, 90, 0.08);
  border: 1px solid rgba(224, 90, 90, 0.25);
  border-radius: 8px;
  padding: 8px 12px;
}

/* ---- 空状态 ---- */
.empty-tip {
  text-align: center;
  color: #7a7a7a;
  font-size: 13px;
  padding: 60px 0 0;
  line-height: 2;
}
.empty-ico {
  font-size: 40px;
  color: #333;
}
</style>
