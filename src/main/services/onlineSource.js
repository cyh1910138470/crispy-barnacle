// 在线音源适配服务
// 应用不内置任何音源地址，由用户在设置中配置（如本地运行的开源音乐 API 服务）
// 支持两种源类型：
//   netease（网易云风格 API）：
//     GET {base}/search?keywords=xxx&limit=30  → { result: { songs: [...] } }
//     GET {base}/song/url?id=xxx               → { data: [{ url, type }] }
//     GET {base}/lyric?id=xxx                  → { lrc: { lyric } }
//   qq（QQ音乐风格 API，如 qq-music-api 项目）：
//     GET {base}/getSearchByKey?key=xxx&limit=30 → { data: { song: { list: [...] } } }
//     GET {base}/getMusicPlay?songmid=xxx        → 播放直链
//     GET {base}/getLyric?songmid=xxx            → 歌词
//     GET {base}/getQQLoginQr + POST {base}/checkQQLoginQr → 扫码登录
const fs = require('fs')
const path = require('path')
const { getDb } = require('../db/init')
const { loadConfig } = require('../utils/config')
const { getMusicCacheDir, getCoverCacheDir } = require('../utils/paths')
const { parseLRC } = require('../utils/lrc')
const { parseWordLyrics } = require('../utils/qrc')
const { saveLyrics } = require('./localScanner')
const { fetchSyncedLyricForSong, normTitle, artistTokens } = require('./wordLyrics')

const REQUEST_TIMEOUT = 8000
const SEARCH_CACHE_TTL = 5 * 60 * 1000

// 通用桌面浏览器 UA（网易云 / QQ 音乐接口共用，Chrome 126 Win10）
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

// 网易云公开 Web API（与逐字歌词服务 wordLyrics.js 同源接口，免登录直连）
// 仅使用官方公开的明文接口：搜索 / 歌词 / 专辑封面 / 免费歌曲播放外链
const NETEASE_BASE = 'https://music.163.com'
const NETEASE_HEADERS = {
  Referer: 'https://music.163.com',
  'User-Agent': DESKTOP_UA
}

// Hi歌曲音乐网（higequ.com）：无独立 XHR 接口，服务端渲染页面，直接抓网页解析
const HIGEQU_BASE = 'https://higequ.com'

// 歌曲宝（gequbao.com）：同为服务端渲染站，网页抓取解析
//   搜索   GET {base}/s/{关键词}/            → HTML 列表（/music/{rid} 链接）
//   播放页 GET {base}/music/{rid}/           → window.appData（含 play_id/封面/时长）+ #content-lrc 歌词
//   直链   POST {base}/member/common-play-url（body: id={play_id}）→ { data: { url } } 酷我 CDN 直链
const GEQUBAO_BASE = 'https://www.gequbao.com'

// 1Music（1music.cc）：YouTube 音源索引下载站（Next.js SPA + 独立 API 域）
//   搜索 GET   https://api.1music.cc/search?songs={kw}&token={cf-turnstile-token}
//     → 歌曲数组 [{title, artist, album, videoId, thumbnail, song_hash, exp}]（无时长，全免费）
//     token 是 Cloudflare Turnstile 一次性令牌：隐藏窗口加载源站页面自动过验证后提取
//   播放 POST  https://backend.1music.cc/preview/
//     body {title, album, artist, videoId, song_hash, exp, request_format:'webm', thumbnail}
//     → { download_url } webm 音频直链（oss CDN，无需 Referer）
//   站点无歌词接口；song_hash 带时效签名（约 24h），过期需重新搜索
const ONEMUSIC_SITE = 'https://1music.cc/zh-CN'
const ONEMUSIC_API = 'https://api.1music.cc'
const ONEMUSIC_BACKEND = 'https://backend.1music.cc'
const ONEMUSIC_HEADERS = {
  'User-Agent': NETEASE_HEADERS['User-Agent'],
  Referer: 'https://1music.cc/',
  Origin: 'https://1music.cc'
}

// 熊猫无损音乐网（xmwav.net）：服务端渲染站，网页抓取解析
//   搜索   GET {base}/index/search/?hot=s&keyword={kw}&page={n}
//     → HTML 列表（rel="bookmark" 的 /song/{slug}.html 链接，每页约 10 条，可翻页）
//   歌曲页 GET {base}/song/{slug}.html
//     → 内嵌试听播放器 var playlist = [{...,mp3:"https://...ogg",...}]（直链 hash 实测稳定，可缓存）
//     → h1.title "歌名-歌手mp3歌曲免费下载"；专辑在 fa-quote-left 的 h3；歌词在 div.lrc article（纯文本无时间戳）
//   完整无损下载走夸克网盘无法自动化，在线播放使用页面内嵌的试听直链（ogg，无需 Referer）
const XMWAV_BASE = 'https://www.xmwav.net'
const XMWAV_HEADERS = {
  'User-Agent': NETEASE_HEADERS['User-Agent'],
  Referer: 'https://www.xmwav.net/'
}

// 闺蜜音乐（gmmp3.com）：服务端渲染站，网页抓取解析
//   搜索   GET {base}/s/{kw}
//     → 页面内嵌 JSON-LD ItemList（MusicRecording: name/byArtist/url，20 条，无分页）
//   歌曲页 GET {base}/song/{id}
//     → h1 "歌名 - 歌手"、og:image 封面（img.gmmp3.com webp）、div.lyric 纯文本歌词
//   播放   GET {base}/api/playurl.php?id={id} → 302 酷我 CDN mp3 直链（带时效签名，即取即用）
//     注意：裸请求 403"不合规范请求！"，必须携带站点下发的会话 Cookie（PHPSESSID/visitor/secure_guest_token）
//     做法：任意页面响应收集 Set-Cookie 存 jar；jar 为空先抓一次歌曲页预热；403 则重置 jar 重新预热再试
//   无损下载走夸克网盘不可自动化；在线播放用 playurl 302 出的 mp3 试听流
const GMMP3_BASE = 'https://www.gmmp3.com'
const GMMP3_HEADERS = {
  'User-Agent': NETEASE_HEADERS['User-Agent'],
  Referer: 'https://www.gmmp3.com/'
}

// 搜索结果内存缓存（避免重复请求）
const searchCache = new Map()

// ============ 基础工具 ============

// 当前激活音源：'qq'（走 qq-music-api 服务） | 'netease'（直连网易公开接口） | 'higequ'（Hi歌曲音乐网，网页解析直连） | 'gequbao'（歌曲宝，网页解析直连） | 'onemusic'（1Music，Turnstile 验证搜索 + webm 直链） | 'xmwav'（熊猫无损音乐网，网页解析试听直链） | 'gmmp3'（闺蜜音乐，网页解析直链）
const ACTIVE_SOURCES = ['qq', 'netease', 'higequ', 'gequbao', 'onemusic', 'xmwav', 'gmmp3']

function getActiveSource() {
  const config = loadConfig()
  return ACTIVE_SOURCES.includes(config.activeSource) ? config.activeSource : 'qq'
}

// QQ 源服务地址（qq 分支专用）
function getQqBase() {
  const config = loadConfig()
  const base = (config.onlineSourceBase || '').trim()
  if (!base) return null
  // 只允许 http/https，防止其他协议
  if (!/^https?:\/\//i.test(base)) return null
  return base.replace(/\/+$/, '')
}

// 统一的源类型解析：fallbackType 未传则用全局激活源；未知字符串一律 fallback
function resolveType(type) {
  if (ACTIVE_SOURCES.includes(type)) return type
  return getActiveSource()
}

// 当前源的请求地址：netease / higequ / gequbao / onemusic / xmwav / gmmp3 恒可用（直连），qq 取决于配置
function getSourceBase(type) {
  const t = resolveType(type)
  if (t === 'netease') return NETEASE_BASE
  if (t === 'higequ') return HIGEQU_BASE
  if (t === 'gequbao') return GEQUBAO_BASE
  if (t === 'onemusic') return ONEMUSIC_API
  if (t === 'xmwav') return XMWAV_BASE
  if (t === 'gmmp3') return GMMP3_BASE
  return getQqBase()
}

// 当前源类型（传入覆盖时返回传入值，否则与 activeSource 一致）
function getSourceType(type) {
  return resolveType(type)
}

function isConfigured(type) {
  const t = resolveType(type)
  if (t === 'netease' || t === 'higequ' || t === 'gequbao' || t === 'onemusic' || t === 'xmwav' || t === 'gmmp3') return true
  return getQqBase() !== null
}

// 网易游客 cookie（NMTID 等，自动收集；无 cookie 的裸请求会被网易风控 405 限流）
let neteaseVisitorCookies = []
// 网易登录 cookie（扫码登录成功后写入配置，持久保存）
let neteaseMusicU = ''
let neteaseMusicULoaded = false

function ensureNeteaseMusicU() {
  if (!neteaseMusicULoaded) {
    try {
      neteaseMusicU = loadConfig().neteaseCookie || ''
    } catch {}
    neteaseMusicULoaded = true
  }
}

function getNeteaseCookieHeader() {
  ensureNeteaseMusicU()
  const parts = []
  if (neteaseMusicU) parts.push(`MUSIC_U=${neteaseMusicU}`)
  return parts.concat([...new Set(neteaseVisitorCookies)]).join('; ')
}

function collectNeteaseCookies(res) {
  try {
    const sc = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    for (const c of sc) {
      if (c.startsWith('MUSIC_U=')) continue // 登录 cookie 走单独存储
      neteaseVisitorCookies.push(c.split(';')[0])
    }
  } catch {}
}

// 预热游客 cookie（首次请求或被限流时）
async function warmNeteaseCookies() {
  try {
    const res = await fetch(NETEASE_BASE + '/', { headers: NETEASE_HEADERS })
    collectNeteaseCookies(res)
  } catch {}
}

// 网易明文接口 GET（带 cookie，405 限流自动重试一次）
async function neteaseGet(pathAndQuery, { timeout = REQUEST_TIMEOUT } = {}) {
  // 首次请求先预热游客 cookie：无 NMTID 的裸请求会被软风控（HTTP 200 但返回空结果）
  ensureNeteaseMusicU()
  if (!neteaseVisitorCookies.length && !neteaseMusicU) {
    await warmNeteaseCookies()
  }
  const doFetch = async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const res = await fetch(`${NETEASE_BASE}${pathAndQuery}`, {
        headers: { ...NETEASE_HEADERS, Cookie: getNeteaseCookieHeader() },
        signal: controller.signal
      })
      collectNeteaseCookies(res)
      return res
    } finally {
      clearTimeout(timer)
    }
  }

  let res = await doFetch()
  let text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('网易接口返回异常')
  }
  if (json.code === 405) {
    // 操作频繁：重置游客 cookie 预热后重试一次
    neteaseVisitorCookies = []
    await warmNeteaseCookies()
    res = await doFetch()
    text = await res.text()
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error('网易接口返回异常')
    }
  }
  return json
}

/**
 * 网易云 POST form（application/x-www-form-urlencoded）
 * 用于 /api/song/detail 这类 GET 易被风控的接口：POST 参数放 body 里，Query 长度短，风控更宽松
 * code=405 时同样 reset cookie + retry 1 次
 */
async function neteasePostForm(path, bodyObj, { timeout = REQUEST_TIMEOUT } = {}) {
  ensureNeteaseMusicU()
  if (!neteaseVisitorCookies.length && !neteaseMusicU) await warmNeteaseCookies()
  const formBody = Object.entries(bodyObj || {})
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v ?? ''))}`)
    .join('&')
  const doFetch = async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const res = await fetch(`${NETEASE_BASE}${path}`, {
        method: 'POST',
        headers: {
          ...NETEASE_HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          Cookie: getNeteaseCookieHeader()
        },
        body: formBody,
        signal: controller.signal
      })
      collectNeteaseCookies(res)
      return res
    } finally {
      clearTimeout(timer)
    }
  }
  let res = await doFetch()
  let text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { throw new Error('网易 POST 返回异常') }
  if (json.code === 405) {
    neteaseVisitorCookies = []
    await warmNeteaseCookies()
    res = await doFetch()
    text = await res.text()
    try { json = JSON.parse(text) } catch { throw new Error('网易 POST 返回异常') }
  }
  return json
}

/**
 * 按 id[] 批量取网易云歌曲详情（风控 code=405 的终极封装版）
 *  ① prefill: 若传入 contextPlaylistTracks（来自 /api/v6/playlist/detail 的 playlist.tracks[] raw 原生数组）
 *     → 直接从里面按 id 匹配，0 请求命中（当前用户账号常用："我喜欢的音乐"歌单本身就有完整 tracks）
 *  ② 没命中的 → 每批 ≤10 首 POST /api/song/detail（body 传 ids/c，比 GET 风控宽松）
 *  ③ 单批 POST 仍 code!=200 → 逐首 POST 单首 → 逐首 GET 单首三重兜底
 * 最终按入参 ids 顺序返回归一化后的歌曲对象数组
 */
async function fetchNeteaseSongDetailsBatched(idsIn, { batchSize = 10, logTag = 'fetchNetDetail', contextPlaylistTracks = null } = {}) {
  const ids = (idsIn || []).map(String).filter(Boolean)
  if (!ids.length) return []
  const resultMap = new Map() // id → song(raw)

  // —— Phase 0: playlist detail prefill（最优先，0 次网络请求，对「我喜欢的音乐」场景 100% 命中）——
  let prefills = 0
  if (Array.isArray(contextPlaylistTracks) && contextPlaylistTracks.length) {
    const pm = new Map()
    for (const t of contextPlaylistTracks) {
      const tid = String(t?.id ?? t?.songId ?? '')
      if (tid) pm.set(tid, t)
    }
    for (const id of ids) {
      const raw = pm.get(id)
      if (raw) { resultMap.set(id, raw); prefills++ }
    }
    if (prefills) console.log(`[${logTag}] prefill(歌单tracks) 直接命中 ${prefills}/${ids.length} 首`)
  }

  // —— Phase 1+2: 对还没命中的 id，小批 POST + 逐首降级 ——
  const remainIds = ids.filter((id) => !resultMap.has(id))
  if (remainIds.length) {
    for (let i = 0; i < remainIds.length; i += batchSize) {
      const slice = remainIds.slice(i, i + batchSize)
      const idsCsv = slice.join(',')
      const c = JSON.stringify(slice.map((id) => ({ id })))
      let data = null
      try {
        data = await neteasePostForm('/api/song/detail', { ids: idsCsv, c })
      } catch { data = null }
      const raw = data?.songs || []
      if (raw.length && data?.code === 200) {
        for (const s of raw) {
          const id = String(s?.id ?? s?.songId ?? '')
          if (id && !resultMap.has(id)) resultMap.set(id, s)
        }
        console.log(`[${logTag}] batch#${Math.floor(i / batchSize) + 1} POST → ${raw.length}/${slice.length} songs`)
        continue
      }
      console.log(`[${logTag}] batch#${Math.floor(i / batchSize) + 1} POST code=${data?.code}，降级逐首单查 ${slice.length} 首`)
      for (const id of slice) {
        if (resultMap.has(id)) continue
        // ① 逐首 POST detail
        let singleData = null
        try { singleData = await neteasePostForm('/api/song/detail', { ids: id, c: JSON.stringify([{ id }]) }) } catch {}
        const s = singleData?.songs?.[0] || null
        if (s) { resultMap.set(id, s); continue }
        // ② 逐首 GET detail（Query 极短，风控基本不触发）
        try {
          const gd = await neteaseGet(`/api/song/detail?ids=${id}&c=${encodeURIComponent(JSON.stringify([{ id }]))}`)
          const gs = gd?.songs?.[0] || null
          if (gs) resultMap.set(id, gs)
        } catch {}
      }
    }
  }

  return ids.map((id) => {
    const raw = resultMap.get(id)
    if (!raw) return null
    const n = normalizeSong(raw)
    return n ? { ...n, onlineType: 'netease' } : null
  }).filter(Boolean)
}

// ============ Hi歌曲音乐网（higequ.com） ============
// 接口形式（抓包分析结论）：站点为服务端渲染，无独立 XHR API
//   搜索   GET {base}/s/{关键词}/     → HTML 里 .result-item[data-rid] 列表
//   播放页 GET {base}/player/{rid}/   → let code="base64" 即音频直链（酷我 CDN，
//                                       带时效签名，必须即取即用），同页内嵌
//                                       .lyric-line[data-time] 歌词与 og:image 封面
const HIGEQU_HEADERS = {
  'User-Agent': NETEASE_HEADERS['User-Agent'],
  Referer: 'https://higequ.com/'
}

// 播放页解析缓存：同一 rid 的直链/歌词/封面共用一次抓取（直链有签名时效，TTL 不宜过长）
const higequPageCache = new Map()
const HIGEQU_PAGE_TTL = 5 * 60 * 1000

function higequDecodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

async function higequFetchText(url, { timeout = REQUEST_TIMEOUT } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { headers: HIGEQU_HEADERS, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

// higequ 抓取限速：3 路并发 + 任务间 250ms 节流，兼顾速度与防封站
const HIGEQU_CONCURRENCY = 3
let higequActive = 0
const higequWaiting = []

function higequEnqueue(task) {
  return new Promise((resolve, reject) => {
    higequWaiting.push({ task, resolve, reject })
    higequPump()
  })
}

function higequPump() {
  while (higequActive < HIGEQU_CONCURRENCY && higequWaiting.length) {
    const { task, resolve, reject } = higequWaiting.shift()
    higequActive++
    task().then(resolve, reject).finally(() => {
      higequActive--
      setTimeout(higequPump, 250)
    })
  }
}

/**
 * Hi歌曲单曲封面补齐：抓播放页取 og:image（结果随 higequPlayerPage 缓存，
 * 之后点这首歌播放时直接命中缓存，播放地址/歌词一并就绪）
 */
async function getHigequCover(rid) {
  if (!rid) return { ok: false, error: '缺少歌曲 ID' }
  try {
    const page = await higequEnqueue(() => higequPlayerPage(String(rid)))
    return { ok: true, coverUrl: page?.coverUrl || '' }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// 抓取并解析播放页（音频直链 + 封面 + 歌词），带短 TTL 缓存
async function higequPlayerPage(rid) {
  const cached = higequPageCache.get(rid)
  if (cached && Date.now() - cached.t < HIGEQU_PAGE_TTL) return cached

  const html = await higequFetchText(`${HIGEQU_BASE}/player/${encodeURIComponent(rid)}/`)

  // 音频直链：页面内 let code = "base64..."，atob 解码即真实 URL
  const m = html.match(/let\s+code\s*=\s*"([A-Za-z0-9+/=]+)"/)
  const playUrl = m ? Buffer.from(m[1], 'base64').toString('utf-8') : ''

  // 封面：优先 og:image，退化到 #album-cover 的 src
  const cov =
    html.match(/property="og:image"\s+content="([^"]+)"/) ||
    html.match(/id="album-cover"[^>]*\ssrc="([^"]+)"/)

  // 歌词：.lyric-line[data-time="秒"] → 拼成标准 LRC 文本
  let lrcText = null
  const lines = [
    ...html.matchAll(/<div class="lyric-line" data-time="([\d.]+)">([\s\S]*?)<\/div>/g)
  ]
  if (lines.length) {
    lrcText = lines
      .map(([, t, text]) => {
        const sec = parseFloat(t) || 0
        const mm = String(Math.floor(sec / 60)).padStart(2, '0')
        const ss = String(Math.floor(sec % 60)).padStart(2, '0')
        const cs = String(Math.round((sec % 1) * 100)).padStart(2, '0')
        return `[${mm}:${ss}.${cs}]${higequDecodeEntities(text)}`
      })
      .join('\n')
  }

  const page = {
    t: Date.now(),
    playUrl,
    coverUrl: cov ? higequDecodeEntities(cov[1]) : '',
    lrcText
  }
  higequPageCache.set(rid, page)
  return page
}

// 搜索页解析：.result-item[data-rid] 块 → 归一化歌曲列表
function parseHigequSearch(html) {
  const items = [
    ...html.matchAll(
      /<div class="result-item" data-rid="(\d+)">([\s\S]*?)<div class="play-icon"/g
    )
  ]
  return items
    .map(([, rid, block]) => {
      const title = block.match(/<div class="result-title">([\s\S]*?)<\/div>/)
      if (!title) return null
      const artist = block.match(/<div class="result-artist">([\s\S]*?)<\/div>/)
      const album = block.match(/<div class="result-album">(?:专辑[:：]\s*)?([\s\S]*?)<\/div>/)
      return {
        sourceId: rid,
        title: higequDecodeEntities(title[1]) || '未知歌曲',
        artist: higequDecodeEntities(artist?.[1]) || '未知艺人',
        album: higequDecodeEntities(album?.[1]) || '未知专辑',
        duration: 0,
        // Hi歌曲源的歌曲均可直接试听/下载，无 VIP 限制
        vip: false,
        coverUrl: ''
      }
    })
    .filter(Boolean)
}

// ============ 歌曲宝（gequbao.com） ============
// 与 higequ 同类：服务端渲染页面 + 网页解析。播放直链需要两步：
//   1) 播放页 window.appData 里取加密 play_id
//   2) POST /member/common-play-url（form: id=play_id）→ 酷我 CDN 直链（带时效签名，即取即用）
//
// Cloudflare 对抗策略（关键）：
//   Node fetch（undici）的 TLS/JA3 指纹一眼被识别为脚本流量，即使低频请求也会被封 IP（全站 520）。
//   因此所有 gequbao 请求必须走 Chromium 网络栈（Electron net.fetch，真 Chrome TLS/HTTP2 指纹），
//   并用独立持久会话（persist:gequbao）保存 cf_clearance；遇到人机验证页时用隐藏窗口自动过验，
//   过不了再弹出窗口让用户手动点一下。
const GEQUBAO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const GEQUBAO_PARTITION = 'persist:gequbao'

let gequbaoSes = null
function ensureGequbaoSession() {
  if (!gequbaoSes) {
    const { session } = require('electron')
    gequbaoSes = session.fromPartition(GEQUBAO_PARTITION)
    // 会话级 UA 与 net.fetch 请求头保持完全一致（cf_clearance 与 UA 绑定，不一致会被再次拦下）
    gequbaoSes.setUserAgent(GEQUBAO_UA)
  }
  return gequbaoSes
}

// 走 Chromium 网络栈的请求（自动携带/回存会话 cookie，含 cf_clearance）
function gequbaoNetFetch(url, { method = 'GET', headers = {}, body = null, signal = null } = {}) {
  const { net } = require('electron')
  return net.fetch(url, {
    method,
    headers: { 'User-Agent': GEQUBAO_UA, Referer: 'https://www.gequbao.com/', ...headers },
    body,
    signal,
    session: ensureGequbaoSession(),
    useSessionCookies: true
  })
}

// 播放页解析缓存（直链有签名时效，TTL 不宜过长）
const gequbaoPageCache = new Map()
const GEQUBAO_PAGE_TTL = 5 * 60 * 1000

// gequbao 全局请求节流：所有请求串行化并保证最小间隔（加随机抖动更像人）
let gequbaoQueue = Promise.resolve()
let gequbaoLastAt = 0
const GEQUBAO_MIN_INTERVAL = 500

function gequbaoThrottle(task) {
  const run = gequbaoQueue.then(async () => {
    const jitter = Math.floor(Math.random() * 400)
    const wait = gequbaoLastAt + GEQUBAO_MIN_INTERVAL + jitter - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    try {
      return await task()
    } finally {
      gequbaoLastAt = Date.now()
    }
  })
  // 错误继续向调用方传递，但不阻塞后续排队
  gequbaoQueue = run.catch(() => {})
  return run
}

// 520 冷却：被封期间继续请求只会延长封禁，冷却期内直接快速失败
let gequbaoCooldownUntil = 0

function gequbaoCheckCooldown() {
  if (Date.now() < gequbaoCooldownUntil) {
    const leftSec = Math.ceil((gequbaoCooldownUntil - Date.now()) / 1000)
    throw new Error(`三方源2 限流冷却中，约 ${leftSec} 秒后再试（期间请求会被快速拒绝以免加重封禁）`)
  }
}

// 是否 Cloudflare 人机验证页（ managed challenge 返回 403/503，且带 cf-mitigated 头或验证页特征）
function gequbaoIsChallenge(res) {
  if (res.headers.get('cf-mitigated')) return true
  return res.status === 403 || res.status === 503
}

// 过 Cloudflare 人机验证：隐藏窗口加载源站，验证自动跑（无感约 3~8 秒）；
// 超过 8 秒还没拿到 cf_clearance（疑似要点勾选框）→ 显示窗口请用户手动完成，再等最多 60 秒
let gequbaoUnblocking = null

function gequbaoUnblock() {
  if (gequbaoUnblocking) return gequbaoUnblocking
  const { BrowserWindow } = require('electron')
  gequbaoUnblocking = (async () => {
    const ses = ensureGequbaoSession()
    const win = new BrowserWindow({
      show: false,
      width: 460,
      height: 660,
      title: '歌曲宝 · 人机验证（通过后自动关闭）',
      webPreferences: { partition: GEQUBAO_PARTITION, backgroundThrottling: false }
    })
    try {
      await win.loadURL(`${GEQUBAO_BASE}/?cfbust=${Date.now()}`).catch(() => {})
      const hasClearance = async () =>
        (await ses.cookies.get({ url: GEQUBAO_BASE })).some((c) => c.name === 'cf_clearance')
      // 阶段一：静默等无感验证（8 秒）
      for (let i = 0; i < 16 && !win.isDestroyed(); i++) {
        if (await hasClearance()) return true
        await new Promise((r) => setTimeout(r, 500))
      }
      if (win.isDestroyed()) return false
      // 阶段二：需要交互 → 显示窗口请用户点一下
      win.show()
      for (let i = 0; i < 120 && !win.isDestroyed(); i++) {
        if (await hasClearance()) return true
        await new Promise((r) => setTimeout(r, 500))
      }
      return false
    } finally {
      if (!win.isDestroyed()) win.destroy()
    }
  })()
    .catch(() => false)
    .finally(() => {
      gequbaoUnblocking = null
    })
  return gequbaoUnblocking
}

// gequbao 统一请求入口：冷却检查 → 节流排队 → Chromium 请求 → 验证页自动过验重试一次 → 520 冷却
async function gequbaoRespond(url, opts = {}) {
  gequbaoCheckCooldown()
  return gequbaoThrottle(async () => {
    const send = () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), opts.timeout || REQUEST_TIMEOUT)
      const p = gequbaoNetFetch(url, { ...opts, signal: controller.signal }).finally(() =>
        clearTimeout(timer)
      )
      return p
    }
    let res = await send()
    if (gequbaoIsChallenge(res)) {
      await res.arrayBuffer().catch(() => {}) // 丢弃验证页 body，复用连接
      const ok = await gequbaoUnblock()
      if (!ok) throw new Error('三方源2 人机验证未通过，请稍后重试（若弹出验证窗口请手动完成）')
      res = await send()
      if (gequbaoIsChallenge(res)) {
        await res.arrayBuffer().catch(() => {})
        throw new Error('三方源2 仍拦截本机访问（IP 可能被临时封禁），请等 10~30 分钟后再试')
      }
    }
    if (res.status === 520) {
      gequbaoCooldownUntil = Date.now() + 3 * 60 * 1000
      throw new Error('源站限流中（HTTP 520），已自动冷却 3 分钟，请稍后再试')
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res
  })
}

async function gequbaoFetchText(url, { timeout = REQUEST_TIMEOUT } = {}) {
  const res = await gequbaoRespond(url, { timeout })
  return res.text()
}

// 解码 JS 单引号字符串字面量（appData 里 \u0022→引号、\\uXXXX 保留为字面量供 JSON.parse 解码）
function gequbaoJsUnescape(s) {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') {
      const n = s[i + 1]
      if (n === 'u' && /^[0-9a-fA-F]{4}$/.test(s.slice(i + 2, i + 6))) {
        out += String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16))
        i += 5
      } else if (n === '\\') {
        out += '\\'
        i++
      } else {
        out += n || ''
        i++
      }
    } else {
      out += s[i]
    }
  }
  return out
}

// 抓取并解析播放页（play_id + 封面 + 时长 + 歌词），带短 TTL 缓存
async function gequbaoMusicPage(rid) {
  const cached = gequbaoPageCache.get(rid)
  if (cached && Date.now() - cached.t < GEQUBAO_PAGE_TTL) return cached

  const html = await gequbaoFetchText(`${GEQUBAO_BASE}/music/${encodeURIComponent(rid)}/`)

  // window.appData = JSON.parse('{...}')：play_id / mp3_cover / mp3_duration 等
  const m = html.match(/window\.appData\s*=\s*JSON\.parse\('([\s\S]*?)'\);/)
  let playId = ''
  let coverUrl = ''
  let title = ''
  let artist = ''
  let duration = 0
  if (m) {
    try {
      const app = JSON.parse(gequbaoJsUnescape(m[1]))
      playId = String(app.play_id || '')
      coverUrl = String(app.mp3_cover || '')
      title = String(app.mp3_title || '')
      artist = String(app.mp3_author || '')
      // mp3_duration 是 "04:00" 文本
      const dm = String(app.mp3_duration || '').match(/^(\d{1,2}):(\d{2})$/)
      if (dm) duration = parseInt(dm[1], 10) * 60 + parseInt(dm[2], 10)
    } catch {}
  }

  // 封面兜底：播放器图片
  if (!coverUrl) {
    const cov = html.match(/class="player-cover-img"[^>]*\ssrc="([^"]+)"/)
    if (cov) coverUrl = higequDecodeEntities(cov[1])
  }

  // 歌词：#content-lrc 内 LRC 文本（<br /> 分行）
  let lrcText = null
  const lrc = html.match(/id="content-lrc"[^>]*>([\s\S]*?)<\/div>/)
  if (lrc) {
    const text = lrc[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
    const cleaned = higequDecodeEntities(text).split('\n').map((l) => l.trim()).filter(Boolean)
    // 含时间标签才算有效歌词
    if (cleaned.some((l) => /^\[\d{1,2}:\d{2}/.test(l))) lrcText = cleaned.join('\n')
  }

  const page = { t: Date.now(), playId, coverUrl, title, artist, duration, lrcText }
  gequbaoPageCache.set(rid, page)
  return page
}

// 用 play_id 换取音频直链（酷我 CDN，带时效签名）
async function gequbaoResolvePlayUrl(rid) {
  const page = await gequbaoMusicPage(rid)
  if (!page.playId) {
    throw new Error('这首歌曲暂时拿不到播放地址（源站未提供音频直链），换一首试试')
  }
  const res = await gequbaoRespond(`${GEQUBAO_BASE}/member/common-play-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `${GEQUBAO_BASE}/music/${encodeURIComponent(rid)}/`
    },
    body: `id=${encodeURIComponent(page.playId)}`
  })
  const data = await res.json()
  const url = String(data?.data?.url || '')
  if (!url) throw new Error('源站未返回音频直链')
  return url
}

/**
 * 歌曲宝单曲封面补齐：抓播放页取 appData.mp3_cover（结果随 gequbaoMusicPage 缓存，
 * 之后点这首歌播放时直接命中缓存，直链/歌词一并就绪）
 */
async function getGequbaoCover(rid) {
  if (!rid) return { ok: false, error: '缺少歌曲 ID' }
  try {
    const page = await gequbaoMusicPage(String(rid))
    return { ok: true, coverUrl: page?.coverUrl || '' }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// 搜索页解析：/music/{rid} 链接块 → 归一化歌曲列表（每页 20 条）
function parseGequbaoSearch(html) {
  const items = [
    ...html.matchAll(
      /<a\s+href="\/music\/(\d+)"[^>]*class="hover-zoom[^"]*"[^>]*title="([^"]*)"[\s\S]*?text-primary[^>]*>\s*([\s\S]*?)\s*<\/span>[\s\S]*?text-jade[^>]*>\s*([\s\S]*?)\s*<\/small>/g
    )
  ]
  return items
    .map(([, rid, fullTitle, title, artist]) => {
      if (!rid) return null
      return {
        sourceId: rid,
        title: higequDecodeEntities(title) || higequDecodeEntities(fullTitle) || '未知歌曲',
        artist: higequDecodeEntities(artist) || '未知艺人',
        album: '未知专辑',
        duration: 0,
        // 歌曲宝所有歌曲均可直接试听/下载，无 VIP 限制
        vip: false,
        coverUrl: ''
      }
    })
    .filter(Boolean)
}

// ============ 1Music（1music.cc） ============

// 搜索结果的签名数据缓存：videoId → { title, artist, album, thumbnail, song_hash, exp }
// song_hash 是带时效的签名（约 24h），播放直链必须携带；占位队列轮播解析时从这兜底
const oneMusicSongCache = new Map()

// api.1music.cc 的会话 cookie（自动收集，withCredentials 语义）
let oneMusicCookies = []

function collectOneMusicCookies(res) {
  try {
    const sc = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    for (const c of sc) {
      if (c) oneMusicCookies = [...new Set([...oneMusicCookies, c.split(';')[0]])]
    }
  } catch {}
}

function oneMusicCookieHeader() {
  return oneMusicCookies.join('; ')
}

// 隐藏窗口：加载源站页面，借助页面自身的 Turnstile 组件过人机验证（无感模式，约 3~5 秒）
let oneMusicWin = null

async function ensureOneMusicWindow() {
  if (oneMusicWin && !oneMusicWin.isDestroyed()) return oneMusicWin
  const { BrowserWindow } = require('electron')
  oneMusicWin = new BrowserWindow({
    show: false,
    width: 480,
    height: 720,
    webPreferences: {
      partition: 'persist:onemusic',
      backgroundThrottling: false
    }
  })
  oneMusicWin.on('closed', () => {
    oneMusicWin = null
  })
  await oneMusicWin.loadURL(ONEMUSIC_SITE)
  return oneMusicWin
}

/**
 * 获取一次性 Turnstile 令牌（每次搜索都要新的：旧令牌被服务端消费后即失效）
 * 优先消费后台预热的令牌（搜索免等验证）；没有才现场过验证（约 3~5 秒）
 */
async function getOneMusicTurnstileToken() {
  if (oneMusicPrewarmed && Date.now() - oneMusicPrewarmed.t < 4 * 60 * 1000) {
    const v = oneMusicPrewarmed.value
    oneMusicPrewarmed = null
    return v
  }
  return acquireOneMusicTurnstileToken()
}

// 预热的下一个令牌（Turnstile 令牌单次有效、约 5 分钟过期，只预热 1 个且 4 分钟内视为新鲜）
let oneMusicPrewarmed = null

async function acquireOneMusicTurnstileToken() {
  const win = await ensureOneMusicWindow()
  const js = `(async () => {
    const sel = 'input[name="cf-turnstile-response"]'
    const prev = document.querySelector(sel)?.value || ''
    try { window.turnstile && window.turnstile.reset() } catch {}
    for (let i = 0; i < 30; i++) {
      const inputs = document.querySelectorAll(sel)
      for (const el of inputs) {
        const t = el.value || ''
        if (t && t !== prev) return t
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    return ''
  })()`
  const token = await win.webContents.executeJavaScript(js).catch(() => '')
  if (!token) throw new Error('三方源3 人机验证未通过，请稍后重试')
  return token
}

// 搜索动完令牌后，后台预热下一次的（fire-and-forget，失败静默——下次搜索再现场拿）
function prewarmOneMusicToken() {
  if (oneMusicPrewarmed) return
  acquireOneMusicTurnstileToken()
    .then((token) => {
      oneMusicPrewarmed = { value: token, t: Date.now() }
    })
    .catch(() => {})
}

// 1Music 搜索：token → 歌曲数组归一化（同时把签名数据放进 oneMusicSongCache）
async function searchOneMusic(kw, token) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const url = `${ONEMUSIC_API}/search?songs=${encodeURIComponent(kw)}&token=${encodeURIComponent(token)}`
    const res = await fetch(url, { headers: { ...ONEMUSIC_HEADERS, Cookie: oneMusicCookieHeader() }, signal: controller.signal })
    collectOneMusicCookies(res)
    if (!res.ok) {
      if (res.status === 400 || res.status === 403) throw new Error('搜索被源站拒绝（验证令牌失效），请再试一次')
      throw new Error(`HTTP ${res.status}`)
    }
    const arr = await res.json()
    if (!Array.isArray(arr)) throw new Error('搜索响应格式异常')
    return arr
      .map((v) => {
        const vid = String(v?.videoId || '')
        if (!vid || !v?.title) return null
        // 签名数据缓存（播放直链要用）；同 videoId 保留 exp 更新的那份
        const cached = oneMusicSongCache.get(vid)
        if (!cached || Number(v.exp || 0) > Number(cached.exp || 0)) {
          oneMusicSongCache.set(vid, {
            title: String(v.title || ''),
            artist: String(v.artist || ''),
            album: String(v.album || ''),
            thumbnail: String(v.thumbnail || ''),
            song_hash: String(v.song_hash || ''),
            exp: Number(v.exp || 0)
          })
        }
        return {
          sourceId: vid,
          title: String(v.title),
          artist: String(v.artist || '') || '未知艺人',
          album: String(v.album || '') || '未知专辑',
          duration: 0, // 源站不提供时长
          vip: false, // 全站免费
          coverUrl: String(v.thumbnail || '')
        }
      })
      .filter(Boolean)
  } finally {
    clearTimeout(timer)
  }
}

// 1Music 播放直链：搜索结果的 song_hash 签名 → POST /preview/ → webm 直链
// song_hash 带 exp 时效（约 24h），缓存缺失/过期时报错引导重新搜索
// 注意：/preview/ 是源站服务端现场提取 YouTube 音频，常见 5~15 秒，超时必须放宽到 25 秒
const ONEMUSIC_PREVIEW_TIMEOUT = 25000

async function postOneMusicPreview(body) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ONEMUSIC_PREVIEW_TIMEOUT)
  try {
    const res = await fetch(`${ONEMUSIC_BACKEND}/preview/`, {
      method: 'POST',
      headers: { ...ONEMUSIC_HEADERS, 'Content-Type': 'application/json', Cookie: oneMusicCookieHeader() },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    collectOneMusicCookies(res)
    if (!res.ok) throw new Error(`拿不到播放地址（HTTP ${res.status}）`)
    const data = await res.json()
    const url = String(data?.download_url || '')
    if (!url) throw new Error('源站未返回音频直链')
    return url
  } finally {
    clearTimeout(timer)
  }
}

async function oneMusicResolvePlayUrl(sourceId, meta = {}) {
  const cached = oneMusicSongCache.get(String(sourceId)) || null
  const songHash = meta.songHash || cached?.song_hash || ''
  const exp = Number(meta.exp || cached?.exp || 0)
  if (!songHash) {
    throw new Error('链接已过期，请重新搜索后再试（三方源3 的歌曲链接带时效签名）')
  }
  if (exp && exp * 1000 < Date.now()) {
    throw new Error('链接已过期，请重新搜索后再试（三方源3 的歌曲链接带时效签名）')
  }
  const body = {
    title: meta.title || cached?.title || '',
    album: meta.album || cached?.album || '',
    artist: meta.artist || cached?.artist || '',
    videoId: String(sourceId),
    song_hash: songHash,
    exp,
    request_format: 'webm',
    thumbnail: meta.coverUrl || cached?.thumbnail || ''
  }
  // 服务端提取偶发抖动/超时：失败后等 1.5 秒重试一次
  try {
    return await postOneMusicPreview(body)
  } catch (e) {
    console.warn('[onemusic] 首次解析失败，重试一次:', e.message)
    await new Promise((r) => setTimeout(r, 1500))
    return postOneMusicPreview(body)
  }
}

// ============ 熊猫无损音乐网（xmwav.net） ============

// 歌曲页解析缓存（试听直链 hash 实测稳定，TTL 放宽到 30 分钟）
const xmwavPageCache = new Map()
const XMWAV_PAGE_TTL = 30 * 60 * 1000

async function xmwavFetchText(url, { timeout = REQUEST_TIMEOUT } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { headers: XMWAV_HEADERS, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

// 歌曲页解析：试听直链 + 标题/歌手/专辑/纯文本歌词
async function xmwavMusicPage(slug) {
  const key = String(slug)
  const hit = xmwavPageCache.get(key)
  if (hit && Date.now() - hit.t < XMWAV_PAGE_TTL) return hit.data
  const html = await xmwavFetchText(`${XMWAV_BASE}/song/${encodeURIComponent(key)}.html`)
  // 试听直链：内嵌播放器 playlist 变量里的 mp3 字段（ogg 流）
  const pm = html.match(/mp3:"(https?:\/\/[^"]+)"/)
  // h1 标题："夜曲-周杰伦mp3歌曲免费下载" → 去掉后缀 → 最后一个 '-' 前是歌名、后是歌手
  const hm = html.match(/<h1 class="title">\s*([^<]+?)mp3歌曲免费下载\s*<\/h1>/)
  let title = ''
  let artist = ''
  if (hm) {
    const raw = higequDecodeEntities(hm[1]).trim()
    const cut = raw.lastIndexOf('-')
    if (cut > 0) {
      title = raw.slice(0, cut).trim()
      artist = raw.slice(cut + 1).trim()
    } else {
      title = raw
    }
  }
  // 专辑：<i class="fa fa-quote-left"></i> 专辑名<i class="fa fa-quote-right"></i>
  const am = html.match(/fa-quote-left"><\/i>\s*([^<]+?)\s*<i class="fa fa-quote-right"/)
  // 歌词：div.lrc → article 内 <br/> 分隔的纯文本行（无时间戳）
  const lm = html.match(/<div class="lrc"[^>]*>\s*<section\s*>\s*<article>\s*([\s\S]*?)<\/article>/i)
  const lrcText = lm
    ? higequDecodeEntities(
        lm[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .trim()
      )
    : null
  const data = {
    playUrl: pm ? pm[1].trim() : '',
    title: title || '未知歌曲',
    artist: artist || '未知艺人',
    album: am ? higequDecodeEntities(am[1]).trim() : '',
    lrcText
  }
  xmwavPageCache.set(key, { t: Date.now(), data })
  return data
}

// 搜索页解析：rel="bookmark" 的 /song/{slug}.html 链接块
// （侧栏"刚刚下载了歌曲"滚动条里也有 /song/ 链接，但没有 rel="bookmark"，不会误收）
function parseXmwavSearch(html) {
  const items = []
  const seen = new Set()
  const blocks = html.matchAll(
    /<a\s+href="\/song\/([a-z0-9-]+)\.html"[^>]*rel="bookmark"[^>]*>([\s\S]*?)<\/a>/g
  )
  for (const blk of blocks) {
    const slug = blk[1]
    if (seen.has(slug)) continue
    seen.add(slug)
    const inner = blk[2]
    // 标题行：<h3><img ...>夜曲-周杰伦</h3> → 最后一个 '-' 前是歌名、后是歌手
    const tm = inner.match(/<h3><img[^>]*>([^<]+)<\/h3>/)
    if (!tm) continue
    const raw = higequDecodeEntities(tm[1]).trim()
    const cut = raw.lastIndexOf('-')
    if (cut <= 0) continue
    const title = raw.slice(0, cut).trim()
    const artist = raw.slice(cut + 1).trim()
    if (!title || !artist) continue
    // 专辑：<i class="fa fa-quote-left"> 专辑名 </i>
    const am = inner.match(/fa-quote-left">\s*([^<]+?)\s*<\/i>/)
    items.push({
      sourceId: slug,
      title,
      artist,
      album: am ? higequDecodeEntities(am[1]).trim() : '',
      duration: 0, // 源站不提供时长
      vip: false, // 全站免费
      coverUrl: '' // 无封面，交给 useCover 的 ♪ 占位
    })
  }
  return items
}

// ============ 闺蜜音乐（gmmp3.com） ============

// 游客会话 Cookie（playurl.php 必带；任意页面响应下发 PHPSESSID/visitor/secure_guest_token）
let gmmp3Cookies = []

function collectGmmp3Cookies(res) {
  try {
    const sc = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    const incoming = sc.map((c) => c.split(';')[0]).filter(Boolean)
    if (incoming.length) {
      const map = new Map(gmmp3Cookies.map((c) => [c.split('=')[0], c]))
      for (const c of incoming) map.set(c.split('=')[0], c)
      gmmp3Cookies = [...map.values()]
    }
  } catch {}
}

function gmmp3CookieHeader() {
  return gmmp3Cookies.join('; ')
}

async function gmmp3FetchText(url, { timeout = REQUEST_TIMEOUT } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, {
      headers: { ...GMMP3_HEADERS, Cookie: gmmp3CookieHeader() },
      signal: controller.signal
    })
    collectGmmp3Cookies(res)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

// 歌曲页解析缓存（标题/封面/歌词稳定，可长缓存；播放直链不在此缓存，每次现取）
const gmmp3PageCache = new Map()
const GMMP3_PAGE_TTL = 30 * 60 * 1000

async function gmmp3MusicPage(id) {
  const key = String(id)
  const hit = gmmp3PageCache.get(key)
  if (hit && Date.now() - hit.t < GMMP3_PAGE_TTL) return hit.data
  const html = await gmmp3FetchText(`${GMMP3_BASE}/song/${encodeURIComponent(key)}`)
  // h1 "歌名 - 歌手"（最后一个 '-' 前是歌名）
  const hm = html.match(/<h1>\s*([^<]+?)\s*<\/h1>/)
  let title = ''
  let artist = ''
  if (hm) {
    const raw = higequDecodeEntities(hm[1]).trim()
    const cut = raw.lastIndexOf('-')
    if (cut > 0) {
      title = raw.slice(0, cut).trim()
      artist = raw.slice(cut + 1).trim()
    } else {
      title = raw
    }
  }
  // 封面 og:image
  const cm = html.match(/property="og:image"\s+content="([^"]+)"/)
  // 歌词 div.lyric 里的 <p> 行（纯文本，无时间戳）
  const lm = html.match(/<div class="lyric"[^>]*>\s*([\s\S]*?)\s*<\/div>/)
  const lrcText = lm
    ? higequDecodeEntities(
        [...lm[1].matchAll(/<p>([\s\S]*?)<\/p>/g)]
          .map((m) => m[1].replace(/<[^>]+>/g, '').trim())
          .filter(Boolean)
          .join('\n')
      )
    : null
  const data = {
    title: title || '未知歌曲',
    artist: artist || '未知艺人',
    coverUrl: cm ? cm[1].trim() : '',
    lrcText: lrcText || null
  }
  gmmp3PageCache.set(key, { t: Date.now(), data })
  return data
}

// 播放直链：playurl.php 带 Cookie → 302 酷我 CDN mp3（带时效签名，即取即用）
// 裸请求 403"不合规范请求"：jar 为空先抓歌曲页预热；403 重置 jar 重新预热再试一次
async function gmmp3ResolvePlayUrl(id) {
  const call = async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
    try {
      const res = await fetch(`${GMMP3_BASE}/api/playurl.php?id=${encodeURIComponent(id)}`, {
        headers: {
          ...GMMP3_HEADERS,
          Cookie: gmmp3CookieHeader()
        },
        redirect: 'manual',
        signal: controller.signal
      })
      collectGmmp3Cookies(res)
      if (res.status === 403) return null // 触发 jar 重预热
      if (!res.ok && res.status !== 302 && res.status !== 301 && res.status !== 307) {
        throw new Error(`拿不到播放地址（HTTP ${res.status}）`)
      }
      const loc = res.headers.get('location') || ''
      if (!loc) throw new Error('源站未返回音频直链')
      await res.arrayBuffer().catch(() => {})
      return loc
    } finally {
      clearTimeout(timer)
    }
  }
  if (!gmmp3CookieHeader()) {
    await gmmp3MusicPage(id).catch(() => {}) // 预热会话 Cookie
  }
  let loc = await call()
  if (!loc) {
    gmmp3Cookies = []
    await gmmp3MusicPage(id).catch(() => {})
    loc = await call()
  }
  if (!loc) throw new Error('拿不到播放地址（源站要求有效的会话，请稍后重试）')
  return loc
}

// 搜索页解析：页面内嵌的 JSON-LD ItemList（MusicRecording）
function parseGmmp3Search(html) {
  const items = []
  const sm = html.match(
    /<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/i
  )
  if (!sm) return items
  let data
  try {
    data = JSON.parse(sm[1].trim())
  } catch {
    return items
  }
  const root = Array.isArray(data) ? data[0] : data
  // 搜索页结构：SearchResultsPage.mainEntity.itemListElement；裸 ItemList 时取自身
  const list = root?.itemListElement ? root : root?.mainEntity
  for (const el of list?.itemListElement || []) {
    const it = el?.item
    if (!it?.url) continue
    const sid = String(it.url).split('/song/')[1] || ''
    if (!sid) continue
    items.push({
      sourceId: sid,
      title: String(it.name || '未知歌曲'),
      artist: String(it.byArtist?.name || '') || '未知艺人',
      album: '', // JSON-LD 不含专辑
      duration: 0, // 源站不提供时长
      vip: false, // 全站免费（isAccessibleForFree: true）
      coverUrl: '' // 搜索结果无封面，懒补 og:image
    })
  }
  return items
}

/**
 * 闺蜜音乐单曲封面补齐：抓歌曲页取 og:image（结果随 gmmp3MusicPage 缓存，
 * 之后点这首歌播放时直接命中缓存，直链/歌词一并就绪）
 */
async function getGmmp3Cover(id) {
  if (!id) return { ok: false, error: '缺少歌曲 ID' }
  try {
    const page = await gmmp3MusicPage(String(id))
    return { ok: true, coverUrl: page?.coverUrl || '' }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// ============ QQ 音乐登录态（cookie 存在应用配置里） ============
// qq-music-api 的设计：扫码登录成功后 cookie 通过响应返回给客户端，
// 由客户端保存，并在后续请求中通过 ?cookie= 参数带回（fallbackMode）。

function getStoredQqCookie() {
  const config = loadConfig()
  return (config.qqMusicCookie || '').trim()
}

function setStoredQqCookie(cookie) {
  loadConfig()
  const { saveConfig } = require('../utils/config')
  saveConfig({ qqMusicCookie: (cookie || '').trim() })
}

function getQqUinFromCookie(cookie) {
  const m = (cookie || '').match(/(?:^|;\s*)uin=([^;]+)/)
  return m ? m[1].replace(/^o/i, '') : ''
}

// 构造 QQ 源请求地址，自动附带登录 cookie（若有）
function qqUrl(base, pathname, params = {}) {
  const qs = new URLSearchParams(params)
  const cookie = getStoredQqCookie()
  if (cookie) qs.set('cookie', cookie)
  return `${base}${pathname}?${qs.toString()}`
}

// 带超时的 JSON 请求
async function fetchJson(url, { timeout = REQUEST_TIMEOUT, headers } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { signal: controller.signal, headers })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

// ============ 结果归一化 ============
// 兼容不同开源 API 的字段差异（artists/ar、album/al、duration/dt 等）

function normalizeArtist(raw) {
  if (Array.isArray(raw)) {
    return raw.map((a) => (typeof a === 'string' ? a : a?.name)).filter(Boolean).join(' / ')
  }
  if (typeof raw === 'string') return raw
  return raw?.name || ''
}

function normalizeSong(raw) {
  if (!raw || (raw.id == null && raw.songId == null)) return null
  const durationMs = raw.duration || raw.dt || 0
  const firstArtist = Array.isArray(raw.artists) ? raw.artists[0] : Array.isArray(raw.ar) ? raw.ar[0] : null
  return {
    sourceId: String(raw.id ?? raw.songId),
    title: String(raw.name || raw.title || raw.songName || '未知歌曲'),
    artist: normalizeArtist(raw.artists || raw.ar || raw.artist) || '未知艺人',
    singerId: String(firstArtist?.id ?? ''),
    album: (raw.album?.name ?? raw.al?.name ?? (typeof raw.album === 'string' ? raw.album : '')) || '未知专辑',
    duration: durationMs > 10000 ? Math.round(durationMs / 1000) : Math.round(durationMs || 0),
    vip: [1, 4, 8, 16].includes(raw.fee),
    coverUrl: raw.al?.picUrl || raw.album?.picUrl || ''
  }
}

// QQ音乐搜索结果的归一化（songmid/songname/singer[]/albumname/interval/.pay.payplay）
function normalizeQqSong(raw) {
  if (!raw?.songmid) return null
  return {
    sourceId: String(raw.songmid),
    title: String(raw.songname || raw.songtitle || '未知歌曲'),
    artist: normalizeArtist(raw.singer) || '未知艺人',
    singerId: String(raw.singer?.[0]?.mid || ''),
    album: raw.albumname || '未知专辑',
    duration: Math.round(raw.interval || 0),
    vip: raw.pay?.payplay === 1 || raw.pay?.pay_trackprice === 1,
    // QQ 专辑封面 CDN 直链，albummid 缺失时置空
    coverUrl: raw.albummid
      ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${raw.albummid}.jpg`
      : ''
  }
}

function normalizeList(data) {
  const songs =
    data?.result?.songs || data?.songs || (Array.isArray(data?.result) ? data.result : []) || []
  return songs.map(normalizeSong).filter(Boolean)
}

function normalizeQqList(data) {
  // 实测响应：{ code, response: { data: { song: { list: [...] } } } }
  const songs =
    data?.response?.data?.song?.list || data?.data?.song?.list || data?.song?.list || []
  return songs.map(normalizeQqSong).filter(Boolean)
}

// ============ 对外接口 ============

/**
 * 在线搜索（支持分页，前端滚动加载下一页）
 * @param {string} keyword 搜索关键词
 * @param {number} page 页码（从 1 开始）
 * @returns {{ ok: boolean, list?: Array, page?: number, hasMore?: boolean, fromCache?: boolean, error?: string }}
 */
async function searchSongs(keyword, page = 1) {
  const base = getSourceBase()
  if (!base) return { ok: false, error: '尚未配置音源地址' }
  const kw = (keyword || '').trim()
  if (!kw) return { ok: true, list: [] }
  page = Math.max(1, parseInt(page, 10) || 1)
  const type = getSourceType()

  const cacheKey = `${type}#${kw}#${page}`
  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.t < SEARCH_CACHE_TTL) {
    const stamped = cached.list.map((it) => ({ ...it, onlineType: type }))
    return { ok: true, list: stamped, page, hasMore: cached.hasMore, fromCache: true }
  }

  try {
    let list
    let hasMore = false
    if (type === 'qq') {
      // QQ 网页搜索每页固定约 10 条（limit 参数被服务端忽略）
      const data = await fetchJson(qqUrl(base, '/getSearchByKey', { key: kw, limit: 30, page }))
      list = normalizeQqList(data)
      hasMore = list.length >= 10
    } else if (type === 'higequ') {
      // Hi歌曲：抓搜索结果页 HTML 解析（每页 10 条）
      // 实测分页：/s/{关键词}/{页码}/，超页不报错但内容逐渐不相关，限制最多 10 页（约 100 首）
      const kwPath = page > 1 ? `${encodeURIComponent(kw)}/${page}/` : `${encodeURIComponent(kw)}/`
      const html = await higequFetchText(`${HIGEQU_BASE}/s/${kwPath}`)
      list = parseHigequSearch(html)
      hasMore = list.length >= 10 && page < 10
    } else if (type === 'gequbao') {
      // 歌曲宝：抓搜索结果页 HTML 解析（每页 20 条，暂只取第一页）
      const html = await gequbaoFetchText(`${GEQUBAO_BASE}/s/${encodeURIComponent(kw)}/`)
      list = parseGequbaoSearch(html)
      hasMore = false
    } else if (type === 'onemusic') {
      // 1Music：Turnstile 一次性令牌 → 官方搜索接口（单次返回约 40 条，无分页）
      const token = await getOneMusicTurnstileToken()
      list = await searchOneMusic(kw, token)
      hasMore = false
      // 本次令牌已被消费：后台立刻预热下一次的，下次搜索免等 3~5 秒验证
      prewarmOneMusicToken()
    } else if (type === 'xmwav') {
      // 熊猫无损：搜索结果页 HTML 解析（每页约 10 条，可翻页）
      const html = await xmwavFetchText(
        `${XMWAV_BASE}/index/search/?hot=s&keyword=${encodeURIComponent(kw)}&page=${page}`
      )
      list = parseXmwavSearch(html)
      hasMore = list.length >= 10 && page < 10
    } else if (type === 'gmmp3') {
      // 闺蜜音乐：搜索页内嵌 JSON-LD ItemList（单次约 20 条，无分页）
      const html = await gmmp3FetchText(`${GMMP3_BASE}/s/${encodeURIComponent(kw)}`)
      list = parseGmmp3Search(html)
      hasMore = false
    } else {
      // 网易公开搜索接口（返回 artists[]/album/duration/fee，normalizeSong 已兼容）
      const offset = (page - 1) * 30
      const data = await neteaseGet(`/api/search/get/web?s=${encodeURIComponent(kw)}&type=1&limit=30&offset=${offset}`)
      list = normalizeList(data)
      hasMore = list.length >= 30
      if (!list.length && page === 1) {
        console.log('[netease] search/get/web 空结果 code:', data?.code, '，尝试 suggest 接口')
        // 回退：联想搜索接口（风控更宽松，最多返回约 8 条）
        const sug = await neteaseGet(`/api/search/suggest/web?s=${encodeURIComponent(kw)}&type=1&limit=8`)
        list = normalizeList({ result: { songs: sug?.result?.songs } })
      }
      // 公开搜索接口不带封面 URL，批量补一次歌曲详情
      await attachNeteaseCovers(list)
    }
    searchCache.set(cacheKey, { t: Date.now(), list, hasMore })
    // 给每个列表项打上源类型，renderer playOnline/toggleBySource 展开后自动带到 meta.onlineType，
    // 后续缓存回退时按这个源而非"当前激活源"取播放直链，避免跨源 songmid 互斥抓不到
    const stamped = list.map((it) => ({ ...it, onlineType: type }))
    return { ok: true, list: stamped, sourceType: type, page, hasMore }
  } catch (e) {
    console.error('[online] 搜索失败:', e.message)
    return { ok: false, error: `搜索失败：${e.message}（请检查音源服务是否在运行）` }
  }
}

// 批量补齐网易搜索结果的专辑封面 URL（分 10 首小批 + POST + 单首三重降级，code=405 风控对抗版）
async function attachNeteaseCovers(list) {
  if (!list.length) return
  try {
    const ids = list.map((s) => s.sourceId).filter(Boolean)
    if (!ids.length) return
    const detailed = await fetchNeteaseSongDetailsBatched(ids, { batchSize: 10, logTag: 'attachCovers' })
    const byId = new Map(detailed.map((s) => [s.sourceId, s.coverUrl || '']))
    for (const s of list) {
      if (!s.coverUrl) s.coverUrl = byId.get(s.sourceId) || ''
    }
  } catch {
    // 封面补齐失败不阻塞搜索结果
  }
}

/**
 * 歌手热门歌曲（歌手页）
 * @param {string} source 音源类型（歌手 ID 所属的源，与搜索结果来源一致）
 * @param {string} singerId 歌手 ID（QQ 为 singermid，网易为数字 id）
 * @returns {{ ok: boolean, singer?: { name, avatar }, list?: Array, error?: string }}
 */
async function getSingerSongs(source, singerId) {
  if (!singerId) return { ok: false, error: '缺少歌手 ID' }

  try {
    if (source === 'qq') {
      const base = getQqBase()
      if (!base) return { ok: false, error: '尚未配置音源地址' }
      const data = await fetchJson(qqUrl(base, '/getSingerHotsong', { singermid: singerId, limit: 50, page: 1 }))
      // 实测响应：{ response: { singer: { data: { songlist: [原始格式歌曲], singer_info } } } }
      // 歌曲为 QQ 网页 API 原始结构：mid/name/singer[]/album{name,mid}/interval/pay.payplay
      const sd = data?.response?.singer?.data
      const rawList = sd?.songlist || []
      const list = rawList
        .map((raw) =>
          raw?.mid
            ? {
                sourceId: String(raw.mid),
                title: String(raw.name || '未知歌曲'),
                artist: normalizeArtist(raw.singer) || '未知艺人',
                singerId: String(raw.singer?.[0]?.mid || ''),
                album: raw.album?.name || '未知专辑',
                duration: Math.round(raw.interval || 0),
                vip: raw.pay?.payplay === 1,
                coverUrl: raw.album?.mid
                  ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${raw.album.mid}.jpg`
                  : ''
              }
            : null
        )
        .filter(Boolean)
      const info = sd?.singer_info
      const singer = {
        name: info?.name || '',
        // 歌手头像 CDN 直链（T001 为歌手封面规格）
        avatar: info?.mid ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${info.mid}.jpg` : ''
      }
      const qqList = list.map((it) => ({ ...it, onlineType: 'qq' }))
      return { ok: true, singer, list: qqList, sourceType: 'qq' }
    }

    if (source === 'netease') {
      // 明文接口：/api/artist/{id} → { artist: { name, img1v1Url }, hotSongs: [...] }
      const data = await neteaseGet(`/api/artist/${encodeURIComponent(String(singerId))}`, { timeout: 12000 })
      const hot = Array.isArray(data?.hotSongs) ? data.hotSongs : []
      let list = hot.map(normalizeSong).filter(Boolean)
      await attachNeteaseCovers(list)
      list = list.map((it) => ({ ...it, onlineType: 'netease' }))
      const artist = data?.artist
      return {
        ok: true,
        singer: { name: artist?.name || '', avatar: artist?.img1v1Url || artist?.cover || '' },
        list,
        sourceType: 'netease'
      }
    }

    if (source === 'higequ' || source === 'gequbao' || source === 'xmwav' || source === 'gmmp3') {
      // Hi歌曲 / 歌曲宝 / 熊猫无损 / 闺蜜音乐：主站均无可自动跳转的歌手页接口，暂不支持 → 后面有需要再加
    }

    return { ok: false, error: '该音源暂不支持歌手页' }
  } catch (e) {
    console.error('[online] 歌手歌曲获取失败:', e.message)
    return { ok: false, error: `获取歌手歌曲失败：${e.message}` }
  }
}

/**
 * 获取在线歌曲的播放直链
 * @param {Object} [meta] 搜索结果附带的元数据（1Music 源需要 songHash/exp 换取签名直链）
 */
async function getPlayUrl(sourceId, type, meta = {}) {
  const srcType = resolveType(type)
  const base = getSourceBase(srcType)
  if (!base) throw new Error('尚未配置音源地址')

  // Hi歌曲源：解析播放页里的 base64 直链（酷我 CDN，带时效签名）
  if (srcType === 'higequ') {
    const page = await higequPlayerPage(sourceId)
    if (!page.playUrl) {
      throw new Error('这首歌曲暂时拿不到播放地址（源站未提供音频直链），换一首试试')
    }
    return page.playUrl
  }

  // 歌曲宝源：播放页 play_id → POST 换酷我 CDN 直链（带时效签名）
  if (srcType === 'gequbao') {
    return gequbaoResolvePlayUrl(sourceId)
  }

  // 1Music 源：搜索结果的 song_hash 签名 → POST /preview/ → webm 直链
  if (srcType === 'onemusic') {
    return oneMusicResolvePlayUrl(sourceId, meta)
  }

  // 熊猫无损源：歌曲页内嵌试听直链（ogg，hash 稳定，页面解析结果有 30 分钟缓存）
  if (srcType === 'xmwav') {
    const page = await xmwavMusicPage(sourceId)
    if (!page.playUrl) {
      throw new Error('这首歌曲暂时拿不到试听直链（源站未提供音频流），换一首试试')
    }
    return page.playUrl
  }

  // 闺蜜音乐源：playurl.php 带 Cookie → 302 酷我 CDN mp3（会话失效自动重预热）
  if (srcType === 'gmmp3') {
    return gmmp3ResolvePlayUrl(sourceId)
  }

  if (srcType === 'qq') {
    const data = await fetchJson(qqUrl(base, '/getMusicPlay', { songmid: sourceId, quality: 320 }))
    // 实测响应：{ data: { playUrl: { [songmid]: { url, error } } } }
    const entry = data?.data?.playUrl?.[sourceId] ?? data?.playUrl?.[sourceId]
    const url = entry?.url || ''
    if (!url) {
      // 源服务返回的登录态报错很技术化（cookie/X-Custom-Cookie 等），转成用户能懂的话
      const raw = String(entry?.error || '')
      const needLogin = /登录|cookie|权限|开通/i.test(raw)
      throw new Error(
        needLogin
          ? '这首是 VIP 歌曲，需要登录你的 QQ 音乐账号才能播放，请在「在线音乐」页扫码登录'
          : `拿不到播放地址：${raw || '请先在「在线音乐」页扫码登录你的 QQ 音乐账号'}`
      )
    }
    return String(url)
  }

  // 网易源：公开播放外链（免费歌曲 302 到真实音频；登录后 VIP 歌也能拿到完整曲目）
  if (srcType === 'netease') {
    const outer = `${NETEASE_BASE}/song/media/outer/url?id=${encodeURIComponent(sourceId)}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
    try {
      const res = await fetch(outer, {
        redirect: 'manual',
        headers: { ...NETEASE_HEADERS, Cookie: getNeteaseCookieHeader() },
        signal: controller.signal
      })
      const loc = res.headers.get('location')
      if (loc && /^https?:/i.test(loc) && !/\/null(?:[?#]|$)/i.test(loc)) return loc
      // 少数情况直接 200 返回音频流
      const ct = res.headers.get('content-type') || ''
      if (res.status === 200 && ct.includes('audio')) return outer
      throw new Error('VIP 歌曲拿不到播放地址，可在网易云源扫码登录会员账号后试听')
    } finally {
      clearTimeout(timer)
    }
  }

  const data = await fetchJson(`${base}/song/url?id=${encodeURIComponent(sourceId)}`)
  const url =
    data?.data?.[0]?.url || data?.data?.url || data?.url || (typeof data === 'string' ? data : '')
  if (!url) {
    throw new Error('这首是 VIP / 版权歌曲，未登录音源账号拿不到播放地址，换一首免费的试试')
  }
  return url
}

// QQ 源歌词匹配（网易被限流/无结果时的备胎：走内置 qq-music-api 本地服务，无网易风控问题）
// 匹配规则与 wordLyrics.pickBest 一致：歌名相等 +2 / 包含 +1（否则淘汰），歌手命中 +2，总分 >= 3 才可信
async function qqSyncedLyricFallback(song) {
  try {
    const base = getSourceBase('qq')
    if (!base || !song?.title) return null
    const kw = [song.title, song.artist].filter(Boolean).join(' ').trim()
    const data = await fetchJson(qqUrl(base, '/getSearchByKey', { key: kw, limit: 8 }))
    const list = data?.data?.song?.list || []
    const t = normTitle(song.title)
    if (!t) return null
    const aTokens = artistTokens(song.artist)
    let best = null
    let bestScore = 0
    for (const c of list) {
      const ct = normTitle(c?.name)
      if (!ct) continue
      let score = 0
      if (ct === t) score += 2
      else if (ct.includes(t) || t.includes(ct)) score += 1
      else continue
      const cArtists = (c.singer || []).map((s) => s?.name || '').join('/')
      if (aTokens.some((a) => cArtists.toLowerCase().includes(a))) score += 2
      if (score > bestScore) {
        bestScore = score
        best = c
      }
    }
    if (!best || bestScore < 3) return null
    const ly = await fetchJson(qqUrl(base, '/getLyric', { songmid: best.songmid, isFormat: 'true' }))
    const lrc = ly?.response?.lyric?.lyric || ly?.lyric?.lyric || ly?.data?.lyric || null
    // 必须真的带时间戳才算同步歌词
    if (!lrc || !/\[\d{1,2}:\d{1,2}(?:[.:]\d{1,3})?\]/.test(lrc)) return null
    return { lrcText: lrc, wordLrcText: null }
  } catch {
    return null
  }
}

// 网页源（Hi歌曲/歌曲宝）歌词备胎：它们的播放页自带同步 LRC，网页直连无平台风控
// 匹配规则同上：歌名相等 +2 / 包含 +1（否则淘汰），歌手命中 +2，总分 >= 3 才可信
async function webSourceSyncedLyricFallback(song, type) {
  try {
    const kw = [song.title, song.artist].filter(Boolean).join(' ').trim()
    if (!kw) return null
    const isHigequ = type === 'higequ'
    const html = isHigequ
      ? await higequFetchText(`${HIGEQU_BASE}/s/${encodeURIComponent(kw)}/`)
      : await gequbaoFetchText(`${GEQUBAO_BASE}/s/${encodeURIComponent(kw)}/`)
    const list = isHigequ ? parseHigequSearch(html) : parseGequbaoSearch(html)
    const t = normTitle(song.title)
    if (!t) return null
    const aTokens = artistTokens(song.artist)
    let best = null
    let bestScore = 0
    for (const c of list) {
      const ct = normTitle(c?.title)
      if (!ct) continue
      let score = 0
      if (ct === t) score += 2
      else if (ct.includes(t) || t.includes(ct)) score += 1
      else continue
      const cArtists = String(c?.artist || '')
      if (aTokens.some((a) => cArtists.toLowerCase().includes(a))) score += 2
      if (score > bestScore) {
        bestScore = score
        best = c
      }
    }
    if (!best || bestScore < 3) return null
    const page = isHigequ
      ? await higequPlayerPage(best.sourceId).catch(() => null)
      : await gequbaoMusicPage(best.sourceId).catch(() => null)
    const lrc = page?.lrcText || null
    // 必须真的带时间戳才算同步歌词
    if (!lrc || !/\[\d{1,2}:\d{1,2}(?:[.:]\d{1,3})?\]/.test(lrc)) return null
    return { lrcText: lrc, wordLrcText: null }
  } catch {
    return null
  }
}

// 跨源同步歌词匹配：网易（更准 + 可能带逐字歌词）→ Hi歌曲（直连稳定）→ 歌曲宝 → QQ 本地服务
async function fetchSyncedLyricCrossSource(song) {
  const ne = await fetchSyncedLyricForSong(song).catch(() => null)
  if (ne) return ne
  const hi = await webSourceSyncedLyricFallback(song, 'higequ').catch(() => null)
  if (hi) return hi
  const gb = await webSourceSyncedLyricFallback(song, 'gequbao').catch(() => null)
  if (gb) return gb
  return qqSyncedLyricFallback(song)
}

/**
 * 获取在线歌曲的歌词（普通 LRC + 逐字歌词 QRC/YRC）
 * @param {Object} [meta] 搜索结果元数据（无时间戳歌词的源跨源匹配网易同步歌词时用作歌名/歌手）
 * @returns {{ lrcText: string|null, wordLrcText: string|null }}
 */
async function getLyricData(sourceId, type, meta = {}) {
  const srcType = resolveType(type)
  const base = getSourceBase(srcType)
  if (!base) return { lrcText: null, wordLrcText: null }
  try {
    // 1Music 源：站点无歌词接口 → 跨源匹配同步歌词（网易 → QQ 备胎）
    if (srcType === 'onemusic') {
      const matched = await fetchSyncedLyricCrossSource({ title: meta.title, artist: meta.artist, duration: meta.duration })
      return matched || { lrcText: null, wordLrcText: null }
    }
    // Hi歌曲源：播放页内嵌的逐行歌词拼成 LRC（无逐字歌词）
    if (srcType === 'higequ') {
      const page = await higequPlayerPage(sourceId).catch(() => null)
      return { lrcText: page?.lrcText || null, wordLrcText: null }
    }
    // 歌曲宝源：播放页 #content-lrc 的 LRC 文本（无逐字歌词）
    if (srcType === 'gequbao') {
      const page = await gequbaoMusicPage(sourceId).catch(() => null)
      return { lrcText: page?.lrcText || null, wordLrcText: null }
    }
    // 熊猫无损 / 闺蜜音乐源：歌曲页歌词是纯文本（无时间戳，不会滚动）
    // → 先跨源匹配同步歌词（网易 → QQ 备胎）；匹配不到再退回页面纯文本（落库为 plainText）
    if (srcType === 'xmwav' || srcType === 'gmmp3') {
      const page = await (srcType === 'xmwav' ? xmwavMusicPage : gmmp3MusicPage)(sourceId).catch(() => null)
      const plain = page?.lrcText || null
      const matched = await fetchSyncedLyricCrossSource({
        title: meta.title && meta.title !== '未知歌曲' ? meta.title : page?.title,
        artist: meta.artist && meta.artist !== '未知艺人' ? meta.artist : page?.artist,
        duration: meta.duration || 0
      })
      if (matched) return matched
      return { lrcText: plain, wordLrcText: null }
    }
    if (srcType === 'qq') {
      const data = await fetchJson(qqUrl(base, '/getLyric', { songmid: sourceId, isFormat: 'true' }))
      // isFormat=true 时响应里 lyric 是解析对象 { lyric, tags, lines }，取 .lyric 得原始 LRC 文本
      const lrcText =
        data?.response?.lyric?.lyric || data?.lyric?.lyric || data?.data?.lyric || null
      // QQ 的加密 QRC 逐字歌词已不可获取（接口限制），只返回普通 LRC
      return { lrcText, wordLrcText: null }
    }
    // 网易公开接口：一次拿到普通 LRC + YRC 逐字歌词（与 wordLyrics.js 同一接口）
    const data = await neteaseGet(
      `/api/song/lyric/v1?id=${encodeURIComponent(sourceId)}&_nmclfl=1&yv=-1&lv=-1`
    ).catch(() => null)
    const lrcText = data?.lrc?.lyric || null
    // 网易 yrc 逐字歌词（明文，无需 base64 解码）
    const rawYrc = data?.yrc?.lyric || null
    let wordLrcText = null
    if (rawYrc && parseWordLyrics(String(rawYrc)).length > 0) wordLrcText = String(rawYrc)
    return { lrcText, wordLrcText }
  } catch {
    return { lrcText: null, wordLrcText: null }
  }
}

function findOnlineSong(sourceId) {
  const db = getDb()
  return db
    .prepare("SELECT * FROM songs WHERE source = 'online' AND source_id = ?")
    .get(String(sourceId))
}

function upsertOnlineSong(entry, sourceId, onlineType) {
  const db = getDb()
  const existing = findOnlineSong(sourceId)
  if (existing) {
    // 如果传入了源类型且记录里没有，补上；每次更新都刷新 filepath + filesize
    const sql = onlineType && !existing.online_type
      ? 'UPDATE songs SET filepath = ?, filesize = ?, online_type = ? WHERE id = ?'
      : 'UPDATE songs SET filepath = ?, filesize = ? WHERE id = ?'
    const params = onlineType && !existing.online_type
      ? [entry.filepath, entry.filesize, onlineType, existing.id]
      : [entry.filepath, entry.filesize, existing.id]
    db.prepare(sql).run(...params)
    return getSongById(db, existing.id)
  }
  const info = db
    .prepare(`
      INSERT INTO songs
        (title, artist, album, genre, duration, filepath, filesize, format, source, source_id, online_type)
      VALUES
        (@title, @artist, @album, @genre, @duration, @filepath, @filesize, @format, 'online', @source_id, @online_type)
    `)
    .run({ ...entry, online_type: onlineType || null })
  return getSongById(db, info.lastInsertRowid)
}

function getSongById(db, id) {
  return db.prepare('SELECT * FROM songs WHERE id = ?').get(id)
}

// 从 URL 推断音频扩展名
function extFromUrl(url) {
  try {
    const u = new URL(url)
    const m = u.pathname.match(/\.(mp3|flac|m4a|aac|ogg|wav|webm|opus)$/i)
    return m ? m[1].toLowerCase() : 'mp3'
  } catch {
    return 'mp3'
  }
}

// 升级尝试失败的歌曲负缓存（songId → 时间戳，10 分钟内不重试；网易限流解除后下次播放自动成功）
const plainLrcUpgradeTried = new Map()
const PLAIN_LRC_RETRY_MS = 10 * 60 * 1000

// 存量在线歌词是无时间戳纯文本（synced=0，网页抓取源旧数据）时，跨源升级为同步滚动歌词
async function tryUpgradePlainLyrics(song) {
  try {
    const row = getDb().prepare('SELECT synced FROM lyrics WHERE song_id = ?').get(song.id)
    if (row && row.synced) return // 已是同步歌词，无需升级
    const triedAt = plainLrcUpgradeTried.get(song.id)
    if (triedAt && Date.now() - triedAt < PLAIN_LRC_RETRY_MS) return
    plainLrcUpgradeTried.set(song.id, Date.now())
    const matched = await fetchSyncedLyricCrossSource({ title: song.title, artist: song.artist, duration: song.duration })
    if (!matched) return
    const { lyrics, plainText } = parseLRC(matched.lrcText)
    if (!lyrics.length) return
    // synced 从 0 升 1（saveLyrics 的 MAX 语义），原纯文本保留为 plainText
    saveLyrics(song.id, matched.lrcText, plainText || matched.lrcText, true, matched.wordLrcText)
    console.log('[online] 已升级同步歌词:', song.title)
  } catch {}
}

// 限时等待升级完成：正常匹配 1~3 秒内完成，首播即滚动；网易被限流时最多等 6 秒就放行播放（升级转后台继续，下次播放生效）
function tryUpgradePlainLyricsBounded(song, ms = 6000) {
  return Promise.race([
    tryUpgradePlainLyrics(song).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, ms))
  ])
}

/**
 * 准备在线歌曲：有缓存直接返回，否则下载到本地曲库缓存并入库
 * 入库后即为普通本地歌曲，播放/歌词/桌面歌词等全部复用现有链路
 * @param {Object} meta
 * @param {string} [meta.onlineType] - 强制按哪个源解析播放/歌词/封面；不传则用全局 activeSource
 */
async function prepareOnlineSong(meta) {
  if (!meta?.sourceId) throw new Error('参数不完整')
  const onlineType = resolveType(meta.onlineType)

  // 1. 已缓存且文件存在 → 直接用（顺手补拉缺失的封面；如果存量记录 online_type 空也同步补）
  const existing = findOnlineSong(meta.sourceId)
  if (existing && existing.filepath && fs.existsSync(existing.filepath)) {
    if (!existing.online_type && onlineType) {
      try {
        getDb().prepare('UPDATE songs SET online_type = ? WHERE id = ?').run(onlineType, existing.id)
        existing.online_type = onlineType
      } catch {}
    }
    if (!existing.cover_path && meta.coverUrl) {
      await fetchOnlineCover(existing.id, meta.sourceId, meta.coverUrl)
      await tryUpgradePlainLyricsBounded(existing)
      return { song: findOnlineSong(meta.sourceId), cached: true }
    }
    await tryUpgradePlainLyricsBounded(existing)
    return { song: existing, cached: true }
  }

  // 2. 取播放直链（优先 meta.onlineType，避免切激活源后旧缓存 songmid 跨源解析失败）
  const url = await getPlayUrl(meta.sourceId, onlineType, meta)

  // 3. 下载到音乐缓存目录（酷我等 CDN 会校验 UA/Referer，统一带浏览器头）
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60000)
  let buf
  let contentTypeFetched = null
  try {
    const dlHeaders = { 'User-Agent': NETEASE_HEADERS['User-Agent'] }
    if (/kuwo\.cn/i.test(url)) {
      // 酷我 CDN：按歌曲归属源带对应站点的 Referer
      dlHeaders.Referer =
        onlineType === 'gequbao'
          ? 'https://www.gequbao.com/'
          : onlineType === 'gmmp3'
            ? 'https://www.gmmp3.com/'
            : 'https://higequ.com/'
    }
    const res = await fetch(url, { signal: controller.signal, headers: dlHeaders })
    if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`)
    contentTypeFetched = res.headers.get('content-type') || null
    buf = Buffer.from(await res.arrayBuffer())
  } finally {
    clearTimeout(timer)
  }
  if (buf.length < 1024) throw new Error('下载的文件无效（过小）')

  // 扩展名三重判断（100% 避免 onemusic 这种 URL 无扩展名 + 默认给 mp3 导致 Howler 解码失败）：
  //   ① 先看 URL 路径有没有扩展名
  //   ② 没有 → 读 HTTP 响应头 Content-Type（audio/webm → webm，audio/ogg → ogg）
  //   ③ 还是拿不准 → 直接嗅探文件前 4~16 字节的 magic bytes（最准确）
  let ext = extFromUrl(url)
  const urlM = url.match(/\.(mp3|flac|m4a|aac|ogg|wav|webm|opus)(\?|$)/i)
  const extProbablyWrong = !urlM || ext === 'mp3' && !urlM
  if (extProbablyWrong) {
    // ② Content-Type 推断
    const ct = (contentTypeFetched || '').toLowerCase()
    if (ct.includes('webm')) ext = 'webm'
    else if (ct.includes('ogg')) ext = 'ogg'
    else if (ct.includes('opus')) ext = 'opus'
    else if (ct.includes('mp4') || ct.includes('m4a')) ext = 'm4a'
    else if (ct.includes('wav')) ext = 'wav'
    else if (ct.includes('flac')) ext = 'flac'
    else if (ct.includes('aac')) ext = 'aac'
    else if (!urlM) {
      // ③ 文件头 magic bytes 嗅探（终极兜底，字节级别判断）
      const head = buf.slice(0, 16)
      // fLaC 标识 = fLAC (4 字节 "fLaC")
      if (head[0] === 0x66 && head[1] === 0x4c && head[2] === 0x61 && head[3] === 0x43) ext = 'flac'
      // RIFF....WAVE = WAV
      else if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
               head[8] === 0x57 && head[9] === 0x41 && head[10] === 0x56 && head[11] === 0x45) ext = 'wav'
      // ID3 = mp3 开头 3 字节；或 mp3 sync word 0xFFFB/0xFFF3
      else if ((head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) ||
               (head[0] === 0xFF && (head[1] & 0xFE) === 0xFA)) ext = 'mp3'
      // ftyp mp4/isom = m4a/mp4/aac
      else if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) ext = 'm4a'
      // OggS = ogg/opus（前 4 字节）
      else if (head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53) ext = 'ogg'
      // 1A 45 DF A3 = Matroska / WebM 开头 magic
      else if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) ext = 'webm'
    }
  }
  const filepath = path.join(getMusicCacheDir(), `online_${meta.sourceId}.${ext}`)
  fs.writeFileSync(filepath, buf)

  // 4. 入库（source='online'，同时写入 online_type 记录该条目的源归属）
  let song = upsertOnlineSong(
    {
      title: meta.title || '未知歌曲',
      artist: meta.artist || '未知艺人',
      album: meta.album || '未知专辑',
      genre: '',
      duration: meta.duration || 0,
      filepath,
      filesize: buf.length,
      format: ext,
      source_id: String(meta.sourceId)
    },
    meta.sourceId,
    onlineType
  )

  // 5. 尝试拉取歌词（普通 LRC + 逐字）并缓存（失败不影响播放）
  if (!(await hasLyrics(song.id))) {
    const { lrcText, wordLrcText } = await getLyricData(meta.sourceId, onlineType, meta)
    if (lrcText) {
      const { lyrics, plainText } = parseLRC(lrcText)
      const synced = lyrics.length > 0
      saveLyrics(song.id, synced ? lrcText : null, plainText || lrcText, synced, wordLrcText)
    }
  }

  // 6. 下载专辑封面（失败不影响播放）
  // Hi歌曲/歌曲宝/闺蜜音乐源搜索结果不带封面，从歌曲页（已缓存）取封面 URL
  if (!meta.coverUrl && (onlineType === 'higequ' || onlineType === 'gequbao' || onlineType === 'gmmp3')) {
    if (onlineType === 'higequ') {
      const page = await higequPlayerPage(meta.sourceId).catch(() => null)
      if (page?.coverUrl) meta = { ...meta, coverUrl: page.coverUrl }
    } else if (onlineType === 'gmmp3') {
      const page = await gmmp3MusicPage(meta.sourceId).catch(() => null)
      if (page?.coverUrl) meta = { ...meta, coverUrl: page.coverUrl }
    } else {
      const page = await gequbaoMusicPage(meta.sourceId).catch(() => null)
      if (page?.coverUrl) meta = { ...meta, coverUrl: page.coverUrl }
      // 播放页里解析到的歌名/歌手/时长比搜索页更准，入库信息一并修正
      if (page?.title && meta.title === '未知歌曲') meta = { ...meta, title: page.title }
      if (page?.duration && !meta.duration) meta = { ...meta, duration: page.duration }
    }
  }
  if (meta.coverUrl) {
    await fetchOnlineCover(song.id, meta.sourceId, meta.coverUrl)
    song = findOnlineSong(meta.sourceId) || song
  }

  return { song, cached: false }
}

async function hasLyrics(songId) {
  const db = getDb()
  const row = db.prepare('SELECT 1 FROM lyrics WHERE song_id = ?').get(songId)
  return !!row
}

/**
 * 下载在线歌曲的专辑封面到封面缓存目录，并更新歌曲记录
 * 失败不影响播放（返回 false）
 */
async function fetchOnlineCover(songId, sourceId, coverUrl) {
  if (!coverUrl || !/^https?:\/\//i.test(coverUrl)) return false
  try {
    const db = getDb()
    const row = db.prepare('SELECT cover_path FROM songs WHERE id = ?').get(songId)
    if (row?.cover_path && fs.existsSync(row.cover_path)) return true // 已有封面

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    let buf
    try {
      const res = await fetch(coverUrl, { signal: controller.signal })
      if (!res.ok) return false
      buf = Buffer.from(await res.arrayBuffer())
    } finally {
      clearTimeout(timer)
    }
    if (!buf || buf.length < 1024) return false

    fs.mkdirSync(getCoverCacheDir(), { recursive: true })
    const coverPath = path.join(getCoverCacheDir(), `online_${sourceId}.jpg`)
    fs.writeFileSync(coverPath, buf)
    db.prepare('UPDATE songs SET cover_path = ? WHERE id = ?').run(coverPath, songId)
    return true
  } catch (e) {
    console.warn('[online] 封面下载失败（忽略）:', e.message)
    return false
  }
}

/**
 * 测试音源连通性
 */
async function testSource(base, type = 'netease') {
  const target = (base || '').trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(target)) {
    return { ok: false, message: '地址需以 http:// 或 https:// 开头' }
  }
  try {
    const data =
      type === 'qq'
        ? await fetchJson(`${target}/getSearchByKey?key=${encodeURIComponent('爱')}&limit=5`, {
            timeout: 5000
          })
        : await fetchJson(`${target}/search?keywords=${encodeURIComponent('爱')}&limit=5`, {
            timeout: 5000
          })
    const list = type === 'qq' ? normalizeQqList(data) : normalizeList(data)
    if (list.length === 0) {
      return { ok: false, message: '连接成功，但搜索没有返回歌曲，请确认是兼容的音乐 API' }
    }
    return { ok: true, message: `连接成功，测试搜索到 ${list.length} 首歌曲` }
  } catch (e) {
    return { ok: false, message: `连接失败：${e.message}` }
  }
}

function getSourceStatus() {
  return {
    configured: isConfigured(),
    base: getSourceBase() || '',
    type: getSourceType(),
    activeSource: getActiveSource(),
    qqConfigured: getQqBase() !== null
  }
}

/**
 * 切换激活音源（'qq' | 'netease' | 'higequ'），清空搜索缓存
 */
function setActiveSource(source) {
  if (!ACTIVE_SOURCES.includes(source)) {
    return { ok: false, message: '未知音源' }
  }
  loadConfig() // 确保 configCache 已加载
  const { saveConfig } = require('../utils/config')
  saveConfig({ activeSource: source })
  searchCache.clear()
  console.log(`[online] 音源已切换: ${source}`)
  return { ok: true }
}

function setSearchBase(base, type = 'netease') {
  loadConfig() // 确保 configCache 已加载
  const { saveConfig } = require('../utils/config')
  const target = (base || '').trim().replace(/\/+$/, '')
  if (target && !/^https?:\/\//i.test(target)) {
    return { ok: false, message: '地址需以 http:// 或 https:// 开头' }
  }
  saveConfig({
    onlineSourceBase: target,
    onlineSourceType: type === 'qq' ? 'qq' : 'netease'
  })
  searchCache.clear()
  return { ok: true }
}

// ============ QQ音乐扫码登录 ============

/**
 * 获取 QQ 登录二维码
 * @returns {{ ok: boolean, img?: string, ptqrtoken?: string, qrsig?: string, error?: string }}
 */
async function getQQLoginQr() {
  const base = getQqBase()
  if (!base) return { ok: false, error: 'QQ 音源服务未就绪，请稍后重试' }
  try {
    const data = await fetchJson(`${base}/getQQLoginQr`, { timeout: 10000 })
    // 服务端直接返回 { img, ptqrtoken, qrsig }
    const d = data?.data ?? data
    if (!d?.img || !d?.qrsig) {
      return { ok: false, error: '获取二维码失败，请确认音源服务正常' }
    }
    return {
      ok: true,
      img: d.img,
      ptqrtoken: d.ptqrtoken,
      qrsig: d.qrsig
    }
  } catch (e) {
    return { ok: false, error: `获取二维码失败：${e.message}` }
  }
}

/**
 * 检查扫码状态（轮询）
 * @returns {{ ok: boolean, scanned?: boolean, expired?: boolean, uin?: string, error?: string }}
 */
async function checkQQLogin(ptqrtoken, qrsig) {
  const base = getQqBase()
  if (!base || !ptqrtoken || !qrsig) return { ok: false, error: '参数不完整' }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    let data
    try {
      const res = await fetch(`${base}/checkQQLoginQr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ptqrtoken, qrsig }),
        signal: controller.signal
      })
      data = await res.json()
    } finally {
      clearTimeout(timer)
    }
    // 服务端返回：{ isOk, refresh, message }，成功时带 session: { loginUin, uin, cookie }
    const d = data?.data ?? data
    if (d?.isOk) {
      // 登录成功：把 cookie 保存进应用配置，之后的请求自动带回
      const session = d.session || {}
      const cookie = (session.cookie || '').trim()
      if (cookie) setStoredQqCookie(cookie)
      const uin = String(session.uin || session.loginUin || getQqUinFromCookie(cookie) || '')
      return { ok: true, scanned: true, uin }
    }
    if (d?.refresh) return { ok: true, expired: true }
    return { ok: true, scanned: false }
  } catch (e) {
    return { ok: false, error: `检查登录状态失败：${e.message}` }
  }
}

/**
 * 退出 QQ 登录（清除本地保存的 cookie）
 */
function logoutQQ() {
  setStoredQqCookie('')
  return { ok: true }
}

/**
 * 查询当前登录状态（QQ + 网易）
 */
async function getLoginInfo() {
  const info = { loggedIn: false, uin: '', neteaseLoggedIn: false, neteaseNickname: '' }
  // ★ 无论当前活跃音源是不是 QQ，只要主进程存了 QQ cookie 都算 QQ 已登录
  //   （之前误与「活跃音源」绑定导致启动显示未登录，必须手动切到 QQ 源才显示在线）
  const qqCookie = getStoredQqCookie()
  if (qqCookie) {
    info.loggedIn = true
    info.uin = getQqUinFromCookie(qqCookie)
  }
  // 网易登录态
  ensureNeteaseMusicU()
  if (neteaseMusicU) {
    info.neteaseLoggedIn = true
    try {
      const data = await neteaseGet('/api/nuser/account/get')
      if (data?.code === 200 && data?.profile?.nickname) {
        info.neteaseNickname = data.profile.nickname
      } else if (data?.code !== 200) {
        // cookie 已失效
        info.neteaseLoggedIn = false
        neteaseMusicU = ''
        const { saveConfig } = require('../utils/config')
        saveConfig({ neteaseCookie: '' })
      }
    } catch {}
  }
  return info
}

/**
 * 退出网易登录
 */
function logoutNetease() {
  neteaseMusicU = ''
  neteaseMusicULoaded = true
  const { saveConfig } = require('../utils/config')
  saveConfig({ neteaseCookie: '' })
  return { ok: true }
}

/**
 * 供登录窗口写回凭证（同步内存 + 配置文件，本会话立即生效）
 */
function setNeteaseCookie(value) {
  neteaseMusicU = value || ''
  neteaseMusicULoaded = true
  const { saveConfig } = require('../utils/config')
  saveConfig({ neteaseCookie: neteaseMusicU })
}

/**
 * 单首在线歌曲封面重建：按 title/artist 搜索找回封面 URL 并下载
 * 用于封面缓存文件丢失后的按需补拉
 */
async function refetchOnlineCoverForRow(row) {
  if (!row?.source_id) return false
  // 优先按记录本身的 online_type 选源；空则 fallback 到当前激活源（可能不对，但比不抓好）
  const type = resolveType(row.online_type)
  const base = getSourceBase(type)
  try {
    let coverUrl = ''
    if (type === 'qq') {
      if (!base) return false
      // 通过关键词搜索找回 albummid → 拼 CDN 直链
      const data = await fetchJson(
        qqUrl(base, '/getSearchByKey', {
          key: `${row.title} ${row.artist}`.trim(),
          limit: 10,
          page: 1
        })
      )
      const list = data?.response?.data?.song?.list || data?.data?.song?.list || []
      const hit = list.find((x) => x.songmid === row.source_id) || list.find((x) => x.songname === row.title)
      if (hit?.albummid) {
        coverUrl = `https://y.gtimg.cn/music/photo_new/T002R500x500M000${hit.albummid}.jpg`
      }
    } else if (type === 'higequ') {
      // Hi歌曲：播放页 og:image 即封面
      const page = await higequPlayerPage(row.source_id).catch(() => null)
      coverUrl = page?.coverUrl || ''
    } else if (type === 'gequbao') {
      // 歌曲宝：播放页 appData.mp3_cover 即封面
      const page = await gequbaoMusicPage(row.source_id).catch(() => null)
      coverUrl = page?.coverUrl || ''
    } else if (type === 'gmmp3') {
      // 闺蜜音乐：歌曲页 og:image 即封面
      const page = await gmmp3MusicPage(row.source_id).catch(() => null)
      coverUrl = page?.coverUrl || ''
    } else {
      // 网易公开详情接口，拿 al.picUrl
      const idsParam = encodeURIComponent(JSON.stringify([row.source_id]))
      const data = await neteaseGet(`/api/song/detail?id=${idsParam}&ids=${idsParam}`)
      coverUrl = data?.songs?.[0]?.al?.picUrl || ''
    }
    if (!coverUrl) return false
    return await fetchOnlineCover(row.id, row.source_id, coverUrl)
  } catch {
    return false
  }
}

/**
 * 为封面缺失的在线缓存歌曲补拉专辑封面（应用启动后后台执行）
 * 每轮最多处理 50 首，多次启动逐步补完
 */
async function backfillOnlineCovers() {
  try {
    const db = getDb()
    const rows = db
      .prepare(
        "SELECT id, title, artist, source_id FROM songs WHERE source = 'online' AND (cover_path IS NULL OR cover_path = '') LIMIT 50"
      )
      .all()
    if (!rows.length) return { updated: 0, remaining: 0 }

    const base = getSourceBase()
    if (!base) return { updated: 0, remaining: rows.length, reason: '未配置音源' }

    let updated = 0
    for (const row of rows) {
      if (await refetchOnlineCoverForRow(row)) updated++
    }

    const remaining = db
      .prepare("SELECT COUNT(*) AS c FROM songs WHERE source = 'online' AND (cover_path IS NULL OR cover_path = '')")
      .get()?.c || 0
    if (updated > 0) console.log(`[online] 封面补齐：本轮更新 ${updated} 首，剩余 ${remaining} 首`)
    return { updated, remaining }
  } catch (e) {
    return { updated: 0, error: e.message }
  }
}

// ============ 云端收藏（QQ / 网易 我喜欢） ============

/**
 * QQ 音乐：拉取当前登录账号的「我喜欢」歌单
 * 实现：主进程直接用已登录的 StoredQqCookie 请求 QQ 官方接口（不走 qq-music-api 的 HTTP 代理，因为内部 cookie store 与主进程不同步）
 *   - 接口①：个人主页 c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg → 拿到我喜欢歌单的 disstid + 总数
 *   - 接口②：歌单详情 c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg → 分页取列表
 */
async function getQqLikedSongs(page = 1, pageSize = 30) {
  const cookie = getStoredQqCookie()
  if (!cookie) return { ok: false, error: '未登录 QQ 音乐账号，请先扫码登录' }
  try {
    page = Math.max(1, parseInt(page, 10) || 1)
    pageSize = Math.min(100, Math.max(5, parseInt(pageSize, 10) || 30))
    const offset = (page - 1) * pageSize
    const uin = getQqUinFromCookie(cookie)

    // Step 1: 取我喜欢歌单的 disstid（10 分钟缓存）
    if (!qqLikedPlaylistCache.id || Date.now() - qqLikedPlaylistCache.ts > 10 * 60 * 1000) {
      const profileUrl =
        'https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?' +
        new URLSearchParams({
          _: String(Date.now()),
          cv: '4747474',
          ct: '24',
          format: 'json',
          inCharset: 'utf-8',
          outCharset: 'utf-8',
          notice: '0',
          platform: 'yqq.json',
          needNewCode: '0',
          uin: String(uin),
          g_tk_new_20200303: '0',
          g_tk: '0',
          cid: '205360838',
          userid: String(uin),
          reqfrom: '1',
          reqtype: '0',
          hostUin: '0',
          loginUin: String(uin)
        }).toString()
      const profile = await fetchJson(profileUrl, {
        headers: {
          Referer: `https://y.qq.com/portal/profile.html?uin=${uin}`,
          Cookie: cookie,
          'User-Agent': DESKTOP_UA
        }
      })
      const mymusic = profile?.data?.mymusic
      let liked = null
      if (Array.isArray(mymusic)) {
        liked = mymusic.find((it) => it?.title && (it.title.includes('喜欢') || it.type === 1))
      }
      // mymusic 没命中时：也尝试 fcg_get_profile_homepage 的 data.mylove / data.track_ids 兜底
      if (!liked) {
        const maybe = profile?.data?.mylove || profile?.data?.favorite
        if (maybe?.dirid) liked = { id: maybe.dirid, title: maybe.title || '我喜欢', num0: maybe.total || 0 }
      }
      const disstid = String(liked?.id || liked?.tid || liked?.disstid || '')
      if (!disstid) {
        return { ok: false, error: '未能找到 QQ 音乐「我喜欢」歌单（返回码 ' + (profile?.code || '?') + '，账号可能暂无收藏）' }
      }
      qqLikedPlaylistCache = {
        id: disstid,
        title: liked?.title || '我喜欢',
        total: Number(liked?.num0 || liked?.total || profile?.data?.mymusic?.[0]?.num0 || 0),
        ts: Date.now()
      }
    }

    // Step 2: 歌单详情（分页取 songlist）
    // 接口参数 format/json/utf8/type/onlysong/new_format 与 qq-music-api songListDetail 内一致
    const detailUrl =
      'https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?' +
      new URLSearchParams({
        format: 'json',
        outCharset: 'utf-8',
        type: '1',
        json: '1',
        utf8: '1',
        onlysong: '0',
        new_format: '1',
        disstid: qqLikedPlaylistCache.id,
        loginUin: String(uin),
        g_tk: '0',
        hostUin: '0',
        notice: '0',
        platform: 'yqq.json',
        needNewCode: '0',
        ct: '24',
        cv: '0',
        // song_begin / song_num：精确控制分页
        song_begin: String(offset),
        song_num: String(pageSize)
      }).toString()
    const detail = await fetchJson(detailUrl, {
      headers: {
        Referer: `https://y.qq.com/n/ryqq/playlist/${qqLikedPlaylistCache.id}`,
        Cookie: cookie,
        'User-Agent': DESKTOP_UA,
        Host: 'c.y.qq.com'
      }
    })
    // 兼容两种常见格式：detail.cdlist[0].songlist 或 detail.cdlist
    const cd = Array.isArray(detail?.cdlist) ? detail.cdlist[0] : (detail?.cdlist || null)
    const songList = cd?.songlist || cd?.songList || []
    const list = songList
      .map((raw) => {
        // 直接把 QQ 接口返回的原始歌曲对象，映射到 normalizeQqSong 兼容的字段
        const normalized = normalizeQqSong({
          songmid: raw?.songmid ?? raw?.songMid ?? raw?.mid,
          songname: raw?.songname ?? raw?.songName ?? raw?.name,
          singer: Array.isArray(raw?.singer) ? raw.singer : (raw?.singerList || raw?.singers || []),
          singerId: raw?.singer?.[0]?.mid ?? raw?.singerList?.[0]?.mid,
          albumname: raw?.albumname ?? raw?.albumName ?? raw?.album?.name,
          albummid: raw?.albummid ?? raw?.albumMid ?? raw?.album?.mid ?? raw?.album?.pmid,
          interval: raw?.interval ?? raw?.songInterval ?? raw?.duration ?? 0,
          pay: {
            payplay: raw?.pay?.payplay ?? raw?.payPlay ?? raw?.pay_play ?? raw?.payplay_status ?? (raw?.pay ?? null)
          }
        })
        return normalized ? { ...normalized, onlineType: 'qq' } : null
      })
      .filter(Boolean)

    // 总数：歌单详情返回的更准，优先用 cdlist.total_song
    const total = Number(cd?.total_song ?? cd?.totalSong ?? cd?.songnum ?? qqLikedPlaylistCache.total ?? 0)
    if (total) qqLikedPlaylistCache.total = total
    const hasMore = offset + list.length < total && list.length > 0

    return {
      ok: true,
      list,
      total,
      page,
      pageSize,
      hasMore,
      playlist: { id: qqLikedPlaylistCache.id, title: qqLikedPlaylistCache.title }
    }
  } catch (e) {
    return { ok: false, error: `获取 QQ 音乐收藏失败：${e.message}` }
  }
}
let qqLikedPlaylistCache = { id: '', title: '', total: 0, ts: 0 }

/**
 * 网易云：拉取当前登录账号的「我喜欢的音乐」
 * 流程：先 user_account 拿 uid → likelist 拿所有 songId → song/detail 分页取详情
 */
async function getNeteaseLikedSongs(page = 1, pageSize = 30) {
  ensureNeteaseMusicU()
  if (!neteaseMusicU) return { ok: false, error: '未登录网易云账号，请先扫码登录' }
  try {
    page = Math.max(1, parseInt(page, 10) || 1)
    pageSize = Math.min(100, Math.max(5, parseInt(pageSize, 10) || 30))

    // Step 1: 取 uid（短期缓存）
    if (!neteaseLikedCache.uid || Date.now() - neteaseLikedCache.ts > 30 * 60 * 1000) {
      const acc = await neteaseGet('/api/nuser/account/get')
      const uid = String(acc?.profile?.userId || acc?.account?.id || '')
      if (!uid) return { ok: false, error: '未能获取网易云账号信息，请重新登录' }
      neteaseLikedCache.uid = uid
      neteaseLikedCache.ts = Date.now()
      console.log(`[CloudFav-Netease] Step1 uid=${neteaseLikedCache.uid}`)
    }

    // Step 2: 拿喜欢的歌曲 ID 列表（约 10 分钟缓存）
    if (!neteaseLikedCache.ids.length || Date.now() - neteaseLikedCache.idsTs > 10 * 60 * 1000) {
      const likeData = await neteaseGet(`/api/song/like/get?uid=${neteaseLikedCache.uid}`)
      const ids = likeData?.ids || []
      console.log(`[CloudFav-Netease] Step2 /api/song/like/get → ${ids.length} 首`, (likeData && typeof likeData.code !== 'undefined') ? `code=${likeData.code}` : '')
      neteaseLikedCache.ids = ids.map(String)
      neteaseLikedCache.idsTs = Date.now()
      // 顺手缓存"我喜欢的音乐"playlistId → Step3 兜底用（/api/v6/playlist/detail 详情接口）
      if (likeData?.playlistId) neteaseLikedCache.playlistId = String(likeData.playlistId)
      else if (!neteaseLikedCache.playlistId) {
        // likelist 没返回的话，去用户歌单列表里把第一个"我喜欢的音乐"拿出来（code==200 && playlist 第一项通常就是）
        try {
          const ul = await neteasePostForm('/api/user/playlist', { uid: neteaseLikedCache.uid, limit: 30, offset: 0 })
          const first = (ul?.playlist || []).find((p) => p?.specialType === 5 || /^(我喜欢的音乐|我最喜爱的音乐|My Favorite|I love this music)$/.test(p?.name || ''))
            || (ul?.playlist || [])[0]
          if (first?.id) neteaseLikedCache.playlistId = String(first.id)
        } catch {}
      }
      if (neteaseLikedCache.playlistId) console.log(`[CloudFav-Netease] Step2 cache playlistId=${neteaseLikedCache.playlistId}（playlist detail 兜底已就绪）`)
    }

    const total = neteaseLikedCache.ids.length
    const start = (page - 1) * pageSize
    const pageIds = neteaseLikedCache.ids.slice(start, start + pageSize)
    const hasMore = start + pageIds.length < total

    // Step 3: 分页批量查歌曲详情（风控 code=405 对抗版 + playlist.tracks prefill 终极版）
    //   ① 若已缓存 "我喜欢的音乐" playlistId → 先查 /api/v6/playlist.detail → tracks[] 直接按 id 回填（0 请求/0 风控，100% 命中 id 对应的 raw song 结构）
    //   ② 有任何没命中的（例如歌单 tracks[] 只返回前 N 首，或 playlistId 未缓存）→ 小批量 POST + 逐首 POST/GET 三重兜底
    let list = []
    if (pageIds.length) {
      let contextTracks = null
      if (neteaseLikedCache.playlistId) {
        try {
          const pd = await neteasePostForm('/api/v6/playlist/detail', { id: neteaseLikedCache.playlistId, n: 100000, s: 8 })
          contextTracks = pd?.playlist?.tracks || null
          if (contextTracks?.length) console.log(`[CloudFav-Netease] Step3 预加载歌单 detail tracks=${contextTracks.length} 首，作为 prefill`)
        } catch (e) { console.warn('[CloudFav-Netease] Step3 playlist.detail 加载失败：', e.message) }
      }
      list = await fetchNeteaseSongDetailsBatched(pageIds, {
        batchSize: 10,
        logTag: `CloudFav-Netease/p${page}`,
        contextPlaylistTracks: contextTracks
      })
      console.log(`[CloudFav-Netease] Step3 page#${page} ids=${pageIds.length} → 归一化输出 ${list.length} 首`)
    }

    return {
      ok: true,
      list,
      total,
      page,
      pageSize,
      hasMore,
      playlist: { id: 'liked', title: '我喜欢的音乐' }
    }
  } catch (e) {
    console.error('[CloudFav-Netease] getNeteaseLikedSongs 失败：', e)
    return { ok: false, error: `获取网易云收藏失败：${e.message}` }
  }
}
const neteaseLikedCache = { uid: '', playlistId: '', ids: [], ts: 0, idsTs: 0 }

/**
 * VIP 过期 / 原源拿不到地址时：跨源兜底搜索+播放
 * 优先级：higequ(稳定) > xmwav > gmmp3 > gequbao > onemusic（质量点高的先试）
 * 每源按「歌名 + 歌手」搜索，取命中最高分（与 wordLyrics.pickBest 规则一致）
 * @param {object} meta  歌曲元信息 { title, artist, sourceId, onlineType }
 * @returns {Promise<{ok: boolean, song?: object, switchedFrom?: string, switchedTo?: string}>}
 */
async function resolveCloudFavoritesPlay(meta) {
  if (!meta?.title) return { ok: false, error: '缺少歌曲信息' }
  const originalType = resolveType(meta.onlineType)

  // 第一优先：先用记录的 online_type 源直接拿
  try {
    const r = await prepareOnlineSong({ ...meta, onlineType: originalType })
    return { ok: true, ...r, switchedFrom: null, switchedTo: null }
  } catch (primaryErr) {
    // 判断是否属于「源内问题」：VIP、登录失效、无地址（不是网络错误）才需要换源
    const msg = (primaryErr.message || '').toString()
    const needFallback =
      /VIP|登录|cookie|权限|开通|拿不到播放|版权|拿不到|无播放|付费|独家|not found|404|音频|http/i.test(msg) ||
      originalType === 'qq' || originalType === 'netease'
    if (!needFallback) return { ok: false, error: msg }

    // 第二：跨源轮询
    //   ⭐ 终极排序策略（最稳最快放前面）：
    //     FREE1. higequ    — 中文流行最稳，直接 HTTP scrap，无 CF 无 Turnstile
    //     FREE2. onemusic  — 英文/日文/冷门 YouTube 索引非常全，VIP 概率为 0（全免费），排第 2
    //     FREE3. gmmp3     — 闺蜜音乐，QQ音乐镜像，中文流行免费全
    //     FREE4. xmwav     — 熊猫无损，预览流直接 ogg，hash 稳
    //     FREE5. gequbao   — 歌曲宝，CF 风控风险大（放最后免费位）
    //     LAST. 另一官方源 — 只有当「QQ 收藏的歌在网易云免费/你有双VIP」才有用，否则俩都是VIP空耗，放最后才试
    const FREE = ['higequ', 'onemusic', 'gmmp3', 'xmwav', 'gequbao']
    const OTHER_OFFICIAL = originalType === 'netease' ? ['qq'] : originalType === 'qq' ? ['netease'] : ['qq', 'netease']
    const FALLBACK_ORDER = [...FREE.filter((t) => t !== originalType), ...OTHER_OFFICIAL]
    const candidates = FALLBACK_ORDER.filter((t) => t !== originalType)

    // 构造多个关键词变体（提升日文/英文歌 / 括号版本标记歌曲的命中率）：
    //   ① 标题【去版本标记】（最强！优先级最高！解决 (Live)/(Remix)/(DJ版)/-Radio Edit/原版 导致搜索不到）
    //   ② 标题 + 艺术家【去版本标记】
    //   ③ 标题 + 艺术家【原版】
    //   ④ 仅标题【原版】
    //   ⑤ 标题 + 艺术家首段（去掉 from/feat 等分隔符）
    //   ⑥ 艺术家首段 + 标题
    //   ⑦ 仅艺术家
    const title = (meta.title || '').trim()
    const artist = (meta.artist || '').trim()
    const stripParenMarkers = (text) => String(text || '')
      .replace(/[（(\[【][^）)\]】]*(?:live|remix|acoustic|dj.*版|instrumental|inst|伴奏|纯音乐|demo|radio.*edit|original.*mix|vip.*mix|tv.*size|version|重制版|翻奏|翻唱|live版|现场|cut|bonus|extende?d|club.*mix|edit|mix)[^）)\]】]*[）)\]】]/gi, ' ')
      // 还支持结尾「 - Live」「-Remix」这种格式
      .replace(/[\s\-_]+(?:live|remix|acoustic|radio.*edit|original.*mix|vip.*mix|tv.*size|version|instrumental|inst|伴奏|纯音乐|demo|现场|dj.*版)$/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
    const cleanTitle = stripParenMarkers(title)
    const cleanArtist = stripParenMarkers(artist)
    const artistHead = cleanArtist
      .replace(/\s+(from|feat\.?|ft\.?|featuring|×|and|&|vs\.?)\s+.*/gi, '')
      .split(/[ /,，、\\()（）]/)[0] || ''
    const kwVariants = Array.from(new Set(
      [
        cleanTitle,
        cleanTitle ? (cleanTitle + ' ' + cleanArtist).trim() : '',
        `${title} ${artist}`,
        title,
        cleanTitle ? (cleanTitle + ' ' + artistHead).trim() : '',
        artistHead && cleanTitle ? (artistHead + ' ' + cleanTitle).trim() : '',
        artist
      ].filter(Boolean).map((s) => s.trim()).filter(Boolean)
    ))

    const tTitle = normTitle(title)
    const aTokens = artistTokens(artist)
    // 额外用 artistHead 作为 token（日文/英文艺人最关键的一段）
    const extraTokens = artistHead ? [artistHead.toLowerCase()] : []

    let lastError = msg
    for (const type of candidates) {
      try {
        // 最多尝试 3 种关键词变体，收集所有命中结果（合并关键词变体返回 + 去重）
        let best = null
        let bestScore = 0
        let searchHits = []
        const seenIds = new Set()
        for (let i = 0; i < kwVariants.length && bestScore < 4; i++) {
          const kw = kwVariants[i]
          console.log(`[CloudFav] 🔎 fallback[${type}] 关键词变体#${i + 1}: "${kw}" (bestScore=${bestScore}/4)`)
          const searchResult = await searchSongsInSource(type, kw, i === 0 ? 20 : 10)
          if (!searchResult.length) continue
          for (const c of searchResult) {
            const uid = `${type}:${String(c.sourceId || '').trim()}`
            if (uid && seenIds.has(uid)) continue
            if (uid) seenIds.add(uid)
            searchHits.push(c)
            const ct = normTitle(c.title)
            if (!ct) continue
            let score = 0
            if (ct === tTitle) score += 3 // 歌名完全匹配（+3 比原来强，更优先）
            else if (ct.includes(tTitle) || tTitle.includes(ct)) score += 1
            else continue
            const cArtist = String(c.artist || '').toLowerCase()
            if (!aTokens.length && !extraTokens.length) score += 1 // 无艺术家信息时给点分
            else {
              const allTokens = [...aTokens, ...extraTokens]
              let matchAny = false
              for (const tk of allTokens) {
                if (!tk) continue
                if (cArtist.includes(tk)) { matchAny = true; break }
              }
              if (matchAny) score += 3
              else if (cArtist) {
                // Fuzzy：去掉所有空格/符号后判断包含
                const aStripped = String(artist).toLowerCase().replace(/[\s\-_/\\,，、()（）.。"'`~!@#$%^&*+=|[\]{}:;<>?]+/g, '')
                const cStripped = cArtist.replace(/[\s\-_/\\,，、()（）.。"'`~!@#$%^&*+=|[\]{}:;<>?]+/g, '')
                if (aStripped && cStripped && (aStripped.includes(cStripped) || cStripped.includes(aStripped))) {
                  score += 2
                }
              }
            }
            const d1 = Number(meta.duration) || 0
            const d2 = Number(c.duration) || 0
            if (d1 > 30 && d2 > 30 && Math.abs(d1 - d2) < 12) score += 1
            if (cleanTitle) {
              const cStripped = stripParenMarkers(c.title || '')
              if (cStripped && normTitle(cStripped) === normTitle(cleanTitle)) {
                // ⭐ 标题去版本标记后和用户原标题「完全一致」 → 这就是原版（Live/Remix 带括号的都会被 strip 掉导致不完全一致）
                // 给 +4 分暴击，让原版直接秒杀 Technoposse Remix Edit / DJ版 / 伴奏版 这类非原版候选
                score += 4
                // 额外再看：如果候选标题**本身就不含版本标记**（没有括号、没有 ' - Remix' / '_Mix' 等尾巴）→ 再加 +1，代表「纯原版」
                if (cStripped === String(c.title || '').trim()) {
                  score += 1
                }
              } else if (cStripped === String(c.title || '').trim()) {
                // 候选「本身没有版本标记」但不完全匹配 → +1 鼓励
                score += 1
              }
            } else {
              // cleanTitle 为空（原标题没标记），候选标题如果本身也没有标记 → +1
              const cStripped = stripParenMarkers(c.title || '')
              if (cStripped === String(c.title || '').trim()) score += 1
            }
            // 🚩 负向扣分：候选标题「含常见 Remix/Edit/DJ 非原版标记」直接 -2 分，让它们被排在原版后面
            {
              const cTitle = String(c.title || '').toLowerCase()
              const badMarkers = [
                '(remix', 'remix)', 'remix',
                '(edit', 'edit)', 'edit',
                '(mix', 'mix)', ' mix',
                '(live', 'live)', 'live',
                '(dj ', 'dj版', 'dj mix',
                '(instrumental', 'instrumental)', '(伴奏',
                '(cover', 'cover)', '翻唱',
                '(cut', 'cut)', ' cut',
                '(radio', 'radio edit',
                '(acoustic', 'acoustic)',
                '(extended', 'extended mix',
                '(vip', 'vip mix',
                '(bootleg', '(flip', '(rework'
              ]
              for (const m of badMarkers) {
                if (cTitle.includes(m)) { score -= 2; break }
              }
              // 艺术家里带 "Dirty Sound System / Technoposse / Remixer 名字" 这种非原作 feat 也再 -1
              const badArtists = ['dirty sound', 'technoposse', 'remix', 'edit by', 'cover by']
              const cArtist = String(c.artist || '').toLowerCase()
              for (const ba of badArtists) {
                if (cArtist.includes(ba)) { score -= 1; break }
              }
            }
            c.__favScore = score
            if (score > bestScore) { bestScore = score; best = c }
          }
        }
        console.log(`[CloudFav] 📊 fallback[${type}] 汇总：searchHits=${searchHits.length} 条，bestScore=${bestScore}${best ? ` best="${best.title} - ${best.artist}"` : ''}`)
        // 放宽门槛：bestScore >= 2 即可用（歌名完全匹配就是 3，歌名包含 + artist fuzz = 1+2 = 3）
        //   最差情况：只有「歌名完全匹配」但 artist 完全对不上 → 3 分也通过；「歌名包含 + 艺术家完全命中 Fuzzy」 → 1+2 = 3
        if (!best || bestScore < 2) continue

        // 命中后尝试解析播放（允许每个源试最多 3 个高分候选，避免第一个命中刚好是 VIP 但自己没权限的情况）
        const candidatesByScore = searchHits
          .map((c) => ({ c, s: c.__favScore || 0 }))
          .filter((x) => x.s >= 2)
          .sort((a, b) => b.s - a.s)
          .slice(0, 3) // 每个源最多尝试 top-3 高分候选

        if (!candidatesByScore.length) continue

        let lastPrepareError = null
        for (let k = 0; k < candidatesByScore.length; k++) {
          const c2 = candidatesByScore[k].c
          try {
            console.log(`[CloudFav] 🎯 fallback[${type}] 尝试候选 #${k + 1}: "${c2.title} - ${c2.artist}" score=${candidatesByScore[k].s} id=${c2.sourceId}`)
            const r = await prepareOnlineSong({
              ...meta,
              sourceId: c2.sourceId,
              title: c2.title || meta.title,
              artist: c2.artist || meta.artist,
              album: c2.album || meta.album,
              duration: c2.duration || meta.duration,
              coverUrl: c2.coverUrl || meta.coverUrl,
              singerId: c2.singerId || meta.singerId,
              onlineType: type
            })
            // 🚫 终极防御：
            //   1) song.id 必须存在（播放器靠 id 调 getAudioDataUrl）
            //   2) 本地缓存文件 filepath 必须真的存在，且文件大小 > 10KB
            //      （0 字节、HTML 错误页、403 空白文件、下载半截都会被直接踢掉 continue 下一个候选）
            if (!r || !r.song || !r.song.id) {
              lastPrepareError = new Error('该候选入库后没有 id，播放器无法取音频数据')
              console.log(`[CloudFav] ⚠️ 候选 #${k + 1} 解析成功但 song.id 为空，跳过`)
              continue
            }
            const fp = r.song.filepath
            try {
              if (!fp) throw new Error('filepath 为空')
              const stat = fs.statSync(fp)
              if (!stat.isFile()) throw new Error('filepath 不是文件')
              if (stat.size < 10 * 1024) throw new Error(`文件太小（${stat.size} 字节），疑似空文件/错误页`)
              console.log(`[CloudFav] ✅ fallback[${type}] 候选 #${k + 1} 通过校验：size=${stat.size} bytes format=${r.song.format || '?'} filepath="${fp}"`)
            } catch (fileErr) {
              lastPrepareError = new Error(`音频文件无效：${fileErr.message}`)
              console.log(`[CloudFav] ⛔ fallback[${type}] 候选 #${k + 1} 文件无效：${fileErr.message}，跳过`)
              continue
            }
            return { ok: true, ...r, switchedFrom: originalType, switchedTo: type }
          } catch (e) {
            lastPrepareError = e
            console.log(`[CloudFav] ❌ fallback[${type}] 候选 #${k + 1} 失败: ${e.message}`)
          }
        }
        if (lastPrepareError) {
          lastError = lastPrepareError.message
        }
        // 当前源 top-3 都失败，继续试下一个源
      } catch (e) {
        lastError = e.message
        console.log(`[CloudFav] 💥 fallback[${type}] 搜索/解析级异常: ${e.message}`)
        // 继续试下一个源
      }
    } // ← 关闭 for (const type of candidates) 循环（之前漏掉的，导致 { } 差 1 个）
    return {
      ok: false,
      // 友好提示：告诉用户我们已经尽力试过了所有源
      error: fallbackRenderMessage(originalType, msg)
    }
  }
}

/**
 * 跨源 fallback 全部失败后的友好提示文案
 * 去掉 HTTP xxx / lastError 这种技术细节，给用户看得懂的解释
 */
function fallbackRenderMessage(originalType, firstError) {
  const srcName = ({ qq: 'QQ音乐', netease: '网易云音乐', higequ: '三方源1', gequbao: '三方源2', onemusic: '三方源3', xmwav: '三方源4', gmmp3: '三方源5' })[originalType] || '该音源'
  const m = (firstError || '').toString()
  let reason = '可能是版权或会员限制'
  if (/VIP|付费|会员/i.test(m)) reason = '因为是 VIP/会员歌曲'
  else if (/版权|独家|区域/i.test(m)) reason = '因为版权限制'
  else if (/登录|cookie|未登录/i.test(m)) reason = '该账号登录状态失效了'
  else if (/404|not found|拿不到播放|无播放|url/i.test(m)) reason = '拿不到播放地址'

  return (
    `🎵 抱歉，这首歌在「${srcName}」${reason}。` +
    `我们已经自动去其他 5 个免费音源（三方源1~5 + 另一个官方源）挨个搜过了，暂时没找到匹配的可播放版本。` +
    `你可以：① 换一首类似的歌试试；② 或者稍后再试（音源资源可能会更新）～`
  )
}

// 简化版：在指定源里搜关键词，不走缓存，直接返回规范化列表
async function searchSongsInSource(type, keyword, limit = 10) {
  try {
    const kw = (keyword || '').trim()
    if (!kw) return []
    if (type === 'qq') {
      const base = getQqBase()
      if (!base) return []
      const l = Math.min(40, Math.max(5, limit))
      const data = await fetchJson(qqUrl(base, '/getSearchByKey', { key: kw, limit: l, page: 1 }))
      return normalizeQqList(data)
    }
    if (type === 'higequ') {
      const html = await higequFetchText(`${HIGEQU_BASE}/s/${encodeURIComponent(kw)}/`)
      return parseHigequSearch(html)
    }
    if (type === 'gequbao') {
      const html = await gequbaoFetchText(`${GEQUBAO_BASE}/s/${encodeURIComponent(kw)}/`)
      return parseGequbaoSearch(html)
    }
    if (type === 'onemusic') {
      const token = await getOneMusicTurnstileToken()
      return searchOneMusic(kw, token).then((r) => r.slice(0, Math.min(40, Math.max(5, limit))))
    }
    if (type === 'xmwav') {
      const html = await xmwavFetchText(`${XMWAV_BASE}/index/search/?hot=s&keyword=${encodeURIComponent(kw)}&page=1`)
      return parseXmwavSearch(html).slice(0, Math.min(30, Math.max(5, limit)))
    }
    if (type === 'gmmp3') {
      const html = await gmmp3FetchText(`${GMMP3_BASE}/s/${encodeURIComponent(kw)}`)
      return parseGmmp3Search(html).slice(0, Math.min(30, Math.max(5, limit)))
    }
    // netease
    const l = Math.min(40, Math.max(5, limit))
    const data = await neteaseGet(`/api/search/get/web?s=${encodeURIComponent(kw)}&type=1&limit=${l}`)
    return normalizeList(data)
  } catch {
    return []
  }
}

module.exports = {
  isConfigured,
  getSourceStatus,
  getSourceType,
  setActiveSource,
  setSearchBase,
  testSource,
  logoutNetease,
  setNeteaseCookie,
  searchSongs,
  getSingerSongs,
  getHigequCover,
  getGequbaoCover,
  getGmmp3Cover,
  getPlayUrl,
  getLyricData,
  neteaseGet,
  prepareOnlineSong,
  refetchOnlineCoverForRow,
  backfillOnlineCovers,
  getQQLoginQr,
  checkQQLogin,
  logoutQQ,
  getLoginInfo,
  getQqLikedSongs,
  getNeteaseLikedSongs,
  resolveCloudFavoritesPlay
}
