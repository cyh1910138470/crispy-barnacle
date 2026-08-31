/**
 * 跨平台 HTTP 适配层
 * 运行环境自动选择：
 *   1) Capacitor App（原生壳） → @capacitor-community/http 原生请求，绕开 CORS + 自动 CookieJar
 *   2) 浏览器（dev 调试）    → 优先直接 fetch；被 CORS 拦时走公共代理兜底
 */

import { Capacitor } from '@capacitor/core'

// ========== 环境判断 ==========
const isNativeApp = typeof window !== 'undefined' && Capacitor.isNativePlatform()

// ========== CORS 公共代理兜底（浏览器dev用）==========
// 多个备选，一个挂了自动试下一个（生产 App 里永远走不到这里）
const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
]

// ========== Capacitor HTTP 插件懒加载 ==========
let _Http = null
async function getCapHttp() {
  if (_Http) return _Http
  try {
    const m = await import('@capacitor-community/http')
    _Http = m.Http
    return _Http
  } catch (e) {
    console.warn('[http] @capacitor-community/http 加载失败，降级到 fetch：', e.message)
    return null
  }
}

// ========== 公共 UA ==========
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'

// ========== gmmp3 专用 Cookie 存储（浏览器端用，原生端插件自带Jar）==========
const gmmp3CookieStore = {
  map: new Map(),
  setFromSetCookie(setCookieArr = []) {
    for (const raw of setCookieArr) {
      const [pair] = String(raw).split(';')
      const idx = pair.indexOf('=')
      if (idx <= 0) continue
      const k = pair.slice(0, idx).trim()
      const v = pair.slice(idx + 1).trim()
      if (k) this.map.set(k, v)
    }
  },
  header() {
    return [...this.map.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  },
  clear() {
    this.map.clear()
  }
}

export const gmmp3Cookies = gmmp3CookieStore

// ========== 通用 GET TEXT =============
/**
 * 发 GET 请求，返回 HTML/TEXT 原文
 * @param {string} url 目标URL
 * @param {object} opts
 * @param {Record<string,string>} [opts.headers]
 * @param {number} [opts.timeout] ms
 * @param {'auto'|'browser'|'native'} [opts.mode] 强制走某种方式
 * @returns {Promise<{text:string, headers:Record<string,string>, setCookie?:string[], status:number}>}
 */
export async function httpGetText(url, opts = {}) {
  const mode = opts.mode || (isNativeApp ? 'native' : 'browser')
  const headers = Object.assign({}, opts.headers || {})
  const timeout = opts.timeout || 15000

  // JS 层 Promise.race 强制超时兜底：防止原生插件请求 DNS 挂掉时永远 pending
  const race = (p) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`请求超时（${timeout}ms）：${url}`)), timeout)
      p.then(
        (v) => {
          clearTimeout(timer)
          resolve(v)
        },
        (e) => {
          clearTimeout(timer)
          reject(e)
        }
      )
    })

  if (mode === 'native') {
    const Http = await getCapHttp()
    if (Http) {
      try {
        return await race(
          Http.get({
            url,
            headers,
            webFetchExtra: { credentials: 'include' }
          })
        ).then((resp) => ({
          text: typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data ?? ''),
          headers: resp.headers || {},
          status: resp.status || 200
        }))
      } catch (nativeErr) {
        // 原生层抛错（DNS/SSL/连接失败）——降级到 fetch
        console.warn('[http] native Http.get 失败，降级 fetch：', nativeErr.message, url)
      }
    } else {
      console.warn('[http] 原生插件未加载，降级 fetch')
    }
    // 没装上插件或原生失败 → 降级浏览器模式
  }

  // ===== 浏览器 fetch =====
  const tryOnce = async (fetchUrl) => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeout)
    try {
      const resp = await fetch(fetchUrl, {
        method: 'GET',
        headers,
        signal: ctrl.signal,
        credentials: 'omit'
      })
      // gmmp3 需要在浏览器模式手动维护Cookie（抓Set-Cookie）
      const sc =
        typeof resp.headers.getSetCookie === 'function' ? resp.headers.getSetCookie() : []
      if (sc.length) gmmp3CookieStore.setFromSetCookie(sc)
      const text = await resp.text()
      return { text, headers: Object.fromEntries(resp.headers.entries()), setCookie: sc, status: resp.status }
    } finally {
      clearTimeout(t)
    }
  }

  // ===== 开发模式：优先走 Vite 本地代理（零 CORS 问题、无编码 bug）=====
  const devProxy = rewriteToDevProxy(url)
  if (devProxy) {
    try {
      console.log('[http] 使用 Vite dev proxy：', url, '→', devProxy)
      return await tryOnce(devProxy)
    } catch (e) {
      console.warn('[http] Vite dev proxy 失败，继续尝试其它方式：', e.message)
    }
  }

  // ===== 生产/通用：先直连 =====
  try {
    return await tryOnce(url)
  } catch (e) {
    // CORS 或网络失败 → 依次试公共代理
    let lastErr = e
    for (const proxyFn of CORS_PROXIES) {
      try {
        return await tryOnce(proxyFn(url))
      } catch (err) {
        lastErr = err
      }
    }
    throw lastErr
  }
}

// ========== URL → Vite dev proxy 映射 ==========
// 只在浏览器开发模式（localhost / 127.0.0.1）生效；生产 App 不走这里
function rewriteToDevProxy(originalUrl) {
  if (isNativeApp) return null
  // 💡 不依赖 import.meta.env.DEV（可选链写法 Vite 不会替换），改用 location.hostname 判定
  const loc = typeof location !== 'undefined' ? location : null
  const isBrowserDev = loc && (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1' || loc.hostname.endsWith('.local'))
  if (!isBrowserDev) return null

  try {
    const u = new URL(originalUrl)
    const mappings = [
      { host: /^(www\.)?higequ\.com$/i, prefix: '/__p_higequ' },
      { host: /^(www\.)?xmwav\.net$/i, prefix: '/__p_xmwav' },
      { host: /^(www\.)?gmmp3\.com$/i, prefix: '/__p_gmmp3' },
      { host: /^corsproxy\.io$/i, prefix: '/__p_corsproxy' }
    ]
    for (const m of mappings) {
      if (m.host.test(u.hostname)) {
        const proxied = m.prefix + u.pathname + u.search
        console.log('[http] ✅ Vite dev proxy 命中', u.hostname, '→', proxied)
        return proxied
      }
    }
    // 不匹配任何已知 host 的 URL，不走代理
    console.log('[http] ⚠️ Vite dev proxy 未命中 host：', u.hostname)
  } catch (e) {
    console.warn('[http] rewriteToDevProxy URL 解析失败：', e.message)
  }
  return null
}

// ========== 获取 302 重定向 Location（gmmp3 专用）============
export async function httpGetRedirectLocation(url, opts = {}) {
  const headers = Object.assign({}, opts.headers || {})
  const timeout = opts.timeout || 10000
  const mode = opts.mode || (isNativeApp ? 'native' : 'browser')

  if (mode === 'native') {
    const Http = await getCapHttp()
    if (Http) {
      // 原生默认自动跟随重定向，但我们要的是最终URL——直接请求再拿data.url或者直接请求（跟随完后最终地址）
      // 更简单：用 redirect: 'manual' 是 fetch 的特性，原生HTTP插件可能不支持。
      // 策略：直接用 Http.get 拿到最终响应，把 resp.url 作为最终直链（原生跟随完就到真正的mp3地址了）
      // 注：@capacitor-community/http 的 resp.data.url 不一定存在；稳妥做法：
      // 如果能拿到mp3内容就用blob URL？不——gmmp3返回302到酷我CDN，酷我URL是可直接给Howler播的。
      // 所以这里改用：两阶段原生请求，手动设置不跟随？插件没这参数。
      // 替代方案（更简单）：直接用原生请求取playurl.php，虽然跟随了但我们最终其实是要播放——直接把Http.get的结果如何转成可播放URL？
      // 最稳做法：用原生HEAD或看接口——先Http请求最终拿到完整URL的办法。
      // 简化：App里我们就用 Http.request({ method: 'GET', redirects: 0 }) 试下
      try {
        const resp = await Http.request({
          method: 'GET',
          url,
          headers,
          connectTimeout: timeout,
          readTimeout: timeout,
          redirects: 0 // 不跟随重定向（Http插件支持的话，拿location）
        })
        const loc = resp.headers?.Location || resp.headers?.location || resp.url
        if (loc && /^https?:\/\//.test(loc)) return loc
        if (resp.url && /\.(mp3|flac|ogg|wav|m4a|aac)/i.test(resp.url)) return resp.url
      } catch (_) {
        // 插件旧版不支持 redirects:0 → 直接跟随拿最终 URL
        const resp2 = await Http.get({
          url,
          headers,
          connectTimeout: timeout,
          readTimeout: timeout
        })
        if (resp2.url && /^https?:\/\//.test(resp2.url)) return resp2.url
        if (resp2.headers?.Location) return resp2.headers.Location
      }
      throw new Error('原生插件未获取到重定向地址')
    }
  }

  // 浏览器模式：redirect: manual 拿location，失败走公共代理拿最终url
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'manual',
      signal: ctrl.signal,
      credentials: 'omit'
    })
    const sc =
      typeof resp.headers.getSetCookie === 'function' ? resp.headers.getSetCookie() : []
    if (sc.length) gmmp3CookieStore.setFromSetCookie(sc)
    const loc = resp.headers.get('location')
    if (loc) return loc
    // 303/307/302 代理没给location的情况：直接follow拿响应url
    if (resp.type === 'opaqueredirect' || !loc) {
      // 走 CORS 代理跟随完，取 url
      for (const proxyFn of CORS_PROXIES) {
        try {
          const r2 = await fetch(proxyFn(url), { signal: ctrl.signal, redirect: 'follow' })
          if (r2.url && /\.(mp3|flac|ogg|wav|m4a|aac)(\?|#|$)/i.test(r2.url)) return r2.url
          // 有的代理把内容返回了——那就只能拿最终响应里的嗅探（一般酷我URL特征很明显）
          // 找不到就放弃，让上层报错
        } catch (_) {}
      }
    }
    throw new Error('未获取到重定向地址（可能CORS拦截）')
  } finally {
    clearTimeout(t)
  }
}

export { MOBILE_UA, isNativeApp }
