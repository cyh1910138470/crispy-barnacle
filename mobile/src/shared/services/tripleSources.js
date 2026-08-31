/**
 * 三方源 1+4+5 在线音乐抓取服务（移动端适配版）
 * 源1: higequ.com     (Hi歌曲音乐网，服务端渲染HTML+正则解析)
 * 源4: xmwav.net      (熊猫无损音乐网，服务端渲染HTML解析试听直链)
 * 源5: gmmp3.com      (闺蜜音乐，JSON-LD + Cookie会话 + 302跳转直链)
 *
 * 完全复用桌面端 onlineSource.js 的解析逻辑，只替换：
 *   Node fetch → shared/http 适配层（自动切换 原生HTTP / 浏览器fetch+CORS代理）
 *   cheerio   → 原生 DOMParser + 正则（和原项目解析保持相同正则）
 */

import { httpGetText, httpGetRedirectLocation, MOBILE_UA, gmmp3Cookies } from '@shared/http'
import { decodeHtmlEntities, base64Decode } from '@shared/utils/html'
import { parseLRC } from '@shared/utils/lrc'

export const SOURCE_LABELS = {
  higequ: '三方源1 · Hi歌曲',
  xmwav: '三方源4 · 熊猫无损',
  gmmp3: '三方源5 · 闺蜜音乐'
}

export const SOURCE_LIST = ['higequ', 'xmwav', 'gmmp3']

const HIGEQU_BASE = 'https://higequ.com'
const XMWAV_BASE = 'https://www.xmwav.net'
const GMMP3_BASE = 'https://www.gmmp3.com'

const HIGEQU_HEADERS = { 'User-Agent': MOBILE_UA, Referer: 'https://higequ.com/' }
const XMWAV_HEADERS = { 'User-Agent': MOBILE_UA, Referer: 'https://www.xmwav.net/' }
const GMMP3_HEADERS = { 'User-Agent': MOBILE_UA, Referer: 'https://www.gmmp3.com/' }

const SEARCH_CACHE_TTL = 5 * 60 * 1000
const PAGE_CACHE_TTL = {
  higequ: 10 * 60 * 1000,
  xmwav: 30 * 60 * 1000,
  gmmp3: 30 * 60 * 1000
}

const searchCache = new Map()
const pageCache = new Map() // `${type}:${id}` → {t, data}

// ===================== 通用工具 =====================
function getPage(type, id) {
  const key = `${type}:${String(id)}`
  const hit = pageCache.get(key)
  if (hit && Date.now() - hit.t < (PAGE_CACHE_TTL[type] || 0)) return hit.data
  return null
}
function setPage(type, id, data) {
  pageCache.set(`${type}:${String(id)}`, { t: Date.now(), data })
  return data
}

// ===================== 源1: higequ =====================
// 搜索
async function searchHigequ(keyword, page = 1) {
  const kw = String(keyword).trim()
  if (!kw) return []
  const cacheKey = `higequ#${kw}#${page}`
  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.t < SEARCH_CACHE_TTL) return cached.list
  const kwPath =
    page > 1 ? `${encodeURIComponent(kw)}/${page}/` : `${encodeURIComponent(kw)}/`
  const { text: html } = await httpGetText(`${HIGEQU_BASE}/s/${kwPath}`, {
    headers: HIGEQU_HEADERS
  })
  const items = [...html.matchAll(/<div class="result-item" data-rid="(\d+)">([\s\S]*?)<div class="play-icon"/g)]
  const list = items
    .map(([, rid, block]) => {
      const tm = block.match(/<div class="result-title">([\s\S]*?)<\/div>/)
      if (!tm) return null
      const am = block.match(/<div class="result-artist">([\s\S]*?)<\/div>/)
      const abm = block.match(/<div class="result-album">(?:专辑[:：]\s*)?([\s\S]*?)<\/div>/)
      return {
        sourceId: rid,
        title: decodeHtmlEntities(tm[1]) || '未知歌曲',
        artist: decodeHtmlEntities(am?.[1]) || '未知艺人',
        album: decodeHtmlEntities(abm?.[1]) || '未知专辑',
        duration: 0,
        vip: false,
        coverUrl: '',
        onlineType: 'higequ'
      }
    })
    .filter(Boolean)
  searchCache.set(cacheKey, { t: Date.now(), list })
  return list
}

// 播放页 → 直链 + 封面 + 歌词
async function higequPage(rid) {
  const hit = getPage('higequ', rid)
  if (hit) return hit
  const { text: html } = await httpGetText(`${HIGEQU_BASE}/player/${encodeURIComponent(rid)}/`, {
    headers: HIGEQU_HEADERS
  })
  const m = html.match(/let\s+code\s*=\s*"([A-Za-z0-9+/=]+)"/)
  const playUrl = m ? base64Decode(m[1]) : ''
  const cov =
    html.match(/property="og:image"\s+content="([^"]+)"/) ||
    html.match(/id="album-cover"[^>]*\ssrc="([^"]+)"/)
  const lines = [
    ...html.matchAll(/<div class="lyric-line" data-time="([\d.]+)">([\s\S]*?)<\/div>/g)
  ]
  let lrcText = null
  if (lines.length) {
    lrcText = lines
      .map(([, t, text]) => {
        const sec = parseFloat(t) || 0
        const mm = String(Math.floor(sec / 60)).padStart(2, '0')
        const ss = String(Math.floor(sec % 60)).padStart(2, '0')
        const cs = String(Math.round((sec % 1) * 100)).padStart(2, '0')
        return `[${mm}:${ss}.${cs}]${decodeHtmlEntities(text)}`
      })
      .join('\n')
  }
  return setPage('higequ', rid, {
    playUrl: /^https?:\/\//.test(playUrl) ? playUrl : '',
    coverUrl: cov ? decodeHtmlEntities(cov[1]) : '',
    lrcText
  })
}

// ===================== 源4: xmwav =====================
async function searchXmwav(keyword, page = 1) {
  const kw = String(keyword).trim()
  if (!kw) return []
  const cacheKey = `xmwav#${kw}#${page}`
  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.t < SEARCH_CACHE_TTL) return cached.list
  const { text: html } = await httpGetText(
    `${XMWAV_BASE}/index/search/?hot=s&keyword=${encodeURIComponent(kw)}&page=${page}`,
    { headers: XMWAV_HEADERS }
  )
  const seen = new Set()
  const list = []
  const blocks = html.matchAll(
    /<a\s+href="\/song\/([a-z0-9-]+)\.html"[^>]*rel="bookmark"[^>]*>([\s\S]*?)<\/a>/g
  )
  for (const bk of blocks) {
    const slug = bk[1]
    if (seen.has(slug)) continue
    seen.add(slug)
    const inner = bk[2]
    const tm = inner.match(/<h3><img[^>]*>([^<]+)<\/h3>/)
    if (!tm) continue
    const raw = decodeHtmlEntities(tm[1]).trim()
    const cut = raw.lastIndexOf('-')
    if (cut <= 0) continue
    const title = raw.slice(0, cut).trim()
    const artist = raw.slice(cut + 1).trim()
    if (!title || !artist) continue
    const am = inner.match(/fa-quote-left">\s*([^<]+?)\s*<\/i>/)
    list.push({
      sourceId: slug,
      title,
      artist,
      album: am ? decodeHtmlEntities(am[1]).trim() : '',
      duration: 0,
      vip: false,
      coverUrl: '',
      onlineType: 'xmwav'
    })
  }
  searchCache.set(cacheKey, { t: Date.now(), list })
  return list
}

async function xmwavPage(slug) {
  const hit = getPage('xmwav', slug)
  if (hit) return hit
  const { text: html } = await httpGetText(`${XMWAV_BASE}/song/${encodeURIComponent(slug)}.html`, {
    headers: XMWAV_HEADERS
  })
  const pm = html.match(/mp3:"(https?:\/\/[^"]+)"/)
  const hm = html.match(/<h1 class="title">\s*([^<]+?)mp3歌曲免费下载\s*<\/h1>/)
  let title = '',
    artist = ''
  if (hm) {
    const raw = decodeHtmlEntities(hm[1]).trim()
    const cut = raw.lastIndexOf('-')
    if (cut > 0) {
      title = raw.slice(0, cut).trim()
      artist = raw.slice(cut + 1).trim()
    } else title = raw
  }
  const am = html.match(/fa-quote-left"><\/i>\s*([^<]+?)\s*<i class="fa fa-quote-right"/)
  const lm = html.match(
    /<div class="lrc"[^>]*>\s*<section\s*>\s*<article>\s*([\s\S]*?)<\/article>/i
  )
  const lrcText = lm
    ? decodeHtmlEntities(
        lm[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
      )
    : null
  return setPage('xmwav', slug, {
    playUrl: pm ? pm[1].trim() : '',
    title: title || '未知歌曲',
    artist: artist || '未知艺人',
    album: am ? decodeHtmlEntities(am[1]).trim() : '',
    lrcText
  })
}

// ===================== 源5: gmmp3（需要会话 Cookie） =====================
async function searchGmmp3(keyword) {
  const kw = String(keyword).trim()
  if (!kw) return []
  const cacheKey = `gmmp3#${kw}`
  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.t < SEARCH_CACHE_TTL) return cached.list

  // 先预热 Cookie（空 jar 先抓一次首页或搜索页）
  const { text: html } = await httpGetText(`${GMMP3_BASE}/s/${encodeURIComponent(kw)}`, {
    headers: { ...GMMP3_HEADERS, Cookie: gmmp3Cookies.header() }
  })
  const items = []
  const sm = html.match(/<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/i)
  if (sm) {
    let data
    try {
      data = JSON.parse(sm[1].trim())
    } catch {
      data = null
    }
    if (data) {
      const root = Array.isArray(data) ? data[0] : data
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
          album: '',
          duration: 0,
          vip: false,
          coverUrl: '',
          onlineType: 'gmmp3'
        })
      }
    }
  }
  searchCache.set(cacheKey, { t: Date.now(), list: items })
  return items
}

async function gmmp3Page(id) {
  const hit = getPage('gmmp3', id)
  if (hit) return hit
  const { text: html } = await httpGetText(`${GMMP3_BASE}/song/${encodeURIComponent(id)}`, {
    headers: { ...GMMP3_HEADERS, Cookie: gmmp3Cookies.header() }
  })
  const hm = html.match(/<h1>\s*([^<]+?)\s*<\/h1>/)
  let title = '',
    artist = ''
  if (hm) {
    const raw = decodeHtmlEntities(hm[1]).trim()
    const cut = raw.lastIndexOf('-')
    if (cut > 0) {
      title = raw.slice(0, cut).trim()
      artist = raw.slice(cut + 1).trim()
    } else title = raw
  }
  const cm = html.match(/property="og:image"\s+content="([^"]+)"/)
  const lm = html.match(/<div class="lyric"[^>]*>\s*([\s\S]*?)\s*<\/div>/)
  let lrcText = null
  if (lm) {
    const rows = [...lm[1].matchAll(/<p>([\s\S]*?)<\/p>/g)]
    const arr = rows.map((m) => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean)
    lrcText = arr.length ? decodeHtmlEntities(arr.join('\n')) : null
  }
  return setPage('gmmp3', id, {
    title: title || '未知歌曲',
    artist: artist || '未知艺人',
    coverUrl: cm ? cm[1].trim() : '',
    lrcText
  })
}

// gmmp3 获取播放直链（302 → CDN）带会话预热 + 403 重置
async function gmmp3PlayUrl(id) {
  const callOnce = async () => {
    const loc = await httpGetRedirectLocation(
      `${GMMP3_BASE}/api/playurl.php?id=${encodeURIComponent(id)}`,
      {
        headers: { ...GMMP3_HEADERS, Cookie: gmmp3Cookies.header() }
      }
    )
    if (!loc) return null
    // gmmp3 返回的location可能是相对路径
    if (/^\/\//.test(loc)) return 'https:' + loc
    if (/^https?:\/\//.test(loc)) return loc
    return null
  }
  if (!gmmp3Cookies.header()) await gmmp3Page(id).catch(() => {})
  let url = await callOnce().catch(() => null)
  if (!url) {
    gmmp3Cookies.clear()
    await gmmp3Page(id).catch(() => {})
    url = await callOnce().catch(() => null)
  }
  if (!url) throw new Error('闺蜜音乐源拿不到播放地址，请稍后重试')
  return url
}

// ===================== 统一对外接口 =====================
export async function search({ keyword, source = 'higequ', page = 1 }) {
  const t0 = Date.now()
  let list = []
  switch (source) {
    case 'higequ':
      list = await searchHigequ(keyword, page)
      break
    case 'xmwav':
      list = await searchXmwav(keyword, page)
      break
    case 'gmmp3':
      list = await searchGmmp3(keyword)
      break
    default:
      throw new Error('未知音源：' + source)
  }
  return { ok: true, list, source, tookMs: Date.now() - t0, page }
}

/**
 * 拿到一首歌曲的播放信息：直链 + 补全封面/歌手/歌词
 * @param {{sourceId:string, onlineType:'higequ'|'xmwav'|'gmmp3', title?:string, artist?:string, album?:string, coverUrl?:string}} meta
 */
export async function resolveSong(meta) {
  if (!meta?.sourceId || !meta?.onlineType) throw new Error('歌曲信息不完整：缺少 sourceId / onlineType')
  const type = meta.onlineType
  let playUrl = ''
  let title = meta.title || ''
  let artist = meta.artist || ''
  let album = meta.album || ''
  let coverUrl = meta.coverUrl || ''
  let lrcText = null

  if (type === 'higequ') {
    const p = await higequPage(meta.sourceId)
    playUrl = p.playUrl
    if (!title) title = p.title || title
    if (!coverUrl) coverUrl = p.coverUrl
    lrcText = p.lrcText
  } else if (type === 'xmwav') {
    const p = await xmwavPage(meta.sourceId)
    playUrl = p.playUrl
    if (!title) title = p.title
    if (!artist) artist = p.artist
    if (!album) album = p.album
    lrcText = p.lrcText
  } else if (type === 'gmmp3') {
    const p = await gmmp3Page(meta.sourceId)
    if (!title) title = p.title
    if (!artist) artist = p.artist
    if (!coverUrl) coverUrl = p.coverUrl
    lrcText = p.lrcText
    playUrl = await gmmp3PlayUrl(meta.sourceId)
  }

  if (!playUrl) throw new Error('暂时拿不到该歌曲的播放地址，请换一首试试')

  const lrc = parseLRC(lrcText || '')
  return {
    sourceId: meta.sourceId,
    onlineType: type,
    title,
    artist,
    album,
    coverUrl,
    playUrl,
    lyrics: lrc.lyrics,
    plainLyrics: lrc.plainText,
    lyricsSynced: lrc.synced
  }
}

// 首页热门关键词（随便给几个，快速体验搜索）
export const HOT_KEYWORDS = [
  '周杰伦',
  '林俊杰',
  '邓紫棋',
  '陈奕迅',
  '薛之谦',
  '毛不易',
  '李荣浩',
  'Taylor Swift'
]
