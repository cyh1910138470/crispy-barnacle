// 全局主题（皮肤）：支持"跟随专辑封面取色"与"固定主题色"两种模式
// 通过 CSS 变量 --accent / --accent-rgb / --accent-deep 供全项目样式引用
import { ref } from 'vue'

export const DEFAULT_ACCENT = '#31c27c'

export const THEME_PRESETS = [
  { name: '经典绿', color: '#31c27c' },
  { name: '天空蓝', color: '#4a9eff' },
  { name: '活力橙', color: '#ff7a45' },
  { name: '樱花粉', color: '#f5578e' },
  { name: '葡萄紫', color: '#a06bff' },
  { name: '落日金', color: '#f0a020' }
]

// 主题状态（模块级单例，跨组件共享）
export const themeMode = ref(localStorage.getItem('msc_theme_mode') || 'auto') // 'auto' | 'fixed'
export const themeColor = ref(localStorage.getItem('msc_theme_color') || DEFAULT_ACCENT)

function hexToRgb(hex) {
  const m = hex.replace('#', '')
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16)
  }
}

function rgbToHex(r, g, b) {
  const s = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')
  return `#${s(r)}${s(g)}${s(b)}`
}

// 亮度归一：太暗提亮、太亮压暗，保证界面文字可读
function normalize(hex) {
  let { r, g, b } = hexToRgb(hex)
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  if (lum < 70) {
    const k = 1 + (70 - lum) / 110
    r *= k; g *= k; b *= k
  } else if (lum > 190) {
    const k = 190 / lum
    r *= k; g *= k; b *= k
  }
  return rgbToHex(r, g, b)
}

function darken(hex, k = 0.72) {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex(r * k, g * k, b * k)
}

// 把主题色写入 CSS 变量（全项目生效）
export function applyAccent(hex) {
  const c = normalize(hex)
  const root = document.documentElement.style
  const { r, g, b } = hexToRgb(c)
  root.setProperty('--accent', c)
  root.setProperty('--accent-rgb', `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`)
  root.setProperty('--accent-deep', darken(c))
}

// 从封面 dataURL 提取主色（canvas 色桶统计，带饱和度加权）
export function extractCoverColor(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) return resolve(null)
    const img = new Image()
    img.onload = () => {
      try {
        const S = 48
        const canvas = document.createElement('canvas')
        canvas.width = S
        canvas.height = S
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, S, S)
        const { data } = ctx.getImageData(0, 0, S, S)
        const buckets = new Map()
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
          if (a < 125) continue
          const max = Math.max(r, g, b), min = Math.min(r, g, b)
          if (max < 40) continue          // 跳过近黑
          if (max - min < 28) continue    // 跳过灰白
          const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
          let bk = buckets.get(key)
          if (!bk) {
            bk = { r: 0, g: 0, b: 0, n: 0, sat: 0 }
            buckets.set(key, bk)
          }
          bk.r += r; bk.g += g; bk.b += b; bk.n++; bk.sat += max - min
        }
        let best = null, bestScore = 0
        buckets.forEach((bk) => {
          const avgSat = bk.sat / bk.n
          const score = bk.n * (0.25 + avgSat / 255)
          if (score > bestScore) { bestScore = score; best = bk }
        })
        if (!best) return resolve(null)
        resolve(normalize(rgbToHex(best.r / best.n, best.g / best.n, best.b / best.n)))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

// auto 模式下根据封面应用主题；无封面则回默认色
export async function applyCoverTheme(coverDataUrl) {
  if (!coverDataUrl) {
    applyAccent(DEFAULT_ACCENT)
    return
  }
  const c = await extractCoverColor(coverDataUrl)
  applyAccent(c || DEFAULT_ACCENT)
}

// 切换主题模式（皮肤面板调用）
export function selectTheme(mode, color) {
  themeMode.value = mode
  if (color) themeColor.value = color
  localStorage.setItem('msc_theme_mode', mode)
  localStorage.setItem('msc_theme_color', themeColor.value)
  if (mode === 'fixed') {
    applyAccent(themeColor.value)
  }
}

// 应用启动时恢复持久化的主题（auto 模式先注入默认色，封面就绪后再覆盖）
export function initTheme() {
  applyAccent(themeMode.value === 'fixed' ? themeColor.value : DEFAULT_ACCENT)
}
