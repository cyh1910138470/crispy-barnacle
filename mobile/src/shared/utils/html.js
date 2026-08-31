// 纯文本 HTML 实体解码 + 简单 DOM 选择
export function decodeHtmlEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

/**
 * 用浏览器原生 DOMParser 解析 HTML（替换 cheerio）
 * 返回一个带常用选择器的对象，接口类似 cheerio 简化版
 */
export function parseHtml(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html')
  return {
    doc,
    $(selector) {
      return Array.from(doc.querySelectorAll(selector))
    },
    text(selector) {
      const el = doc.querySelector(selector)
      return el ? decodeHtmlEntities(el.textContent || '') : ''
    },
    attr(selector, attrName) {
      const el = doc.querySelector(selector)
      return el ? decodeHtmlEntities(el.getAttribute(attrName) || '') : ''
    },
    meta(name) {
      const el = doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`)
      return el ? decodeHtmlEntities(el.getAttribute('content') || '') : ''
    }
  }
}

/**
 * 轻量 base64 → UTF-8 字符串（兼容中英文）
 * @param {string} b64
 */
export function base64Decode(b64) {
  try {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    try {
      return atob(b64)
    } catch {
      return ''
    }
  }
}
