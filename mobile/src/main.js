import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { Capacitor } from '@capacitor/core'

// Varlet UI（移动端组件库）
import Varlet, { StyleProvider, Themes } from '@varlet/ui'
import '@varlet/ui/es/style'
import '@varlet/touch-emulator'

// 全局样式（深色主题 + QQ绿）
import './style.css'

// ========================================
// 🛠️ 启动时自诊断：打印原生环境 + HTTP 插件状态
// 用 chrome://inspect 或 App 内 Dialog 都能看到
// ========================================
const isNative = Capacitor.isNativePlatform()
console.log('=== MSC-TT 启动诊断 ===')
console.log('Capacitor isNativePlatform =', isNative)
console.log('Capacitor.platform =', Capacitor.getPlatform())
console.log('UserAgent =', navigator.userAgent)

if (isNative) {
  // 原生 App：试加载 @capacitor-community/http
  import('@capacitor-community/http')
    .then((m) => {
      console.log('[DIAG] @capacitor-community/http 加载成功', m)
      if (m.Http) {
        console.log('[DIAG] Http 对象 =', m.Http)
        // 试发一个简单的原生请求验证插件确实工作
        m.Http.get({ url: 'https://www.higequ.com/s/%E6%99%B4%E5%A4%A9/' })
          .then((resp) => {
            console.log('[DIAG] 原生 Http.get 测试成功！status=', resp.status, 'len=', String(resp.data || '').length)
          })
          .catch((e) => {
            console.error('[DIAG] 原生 Http.get 测试失败 ❌', e)
          })
      } else {
        console.error('[DIAG] @capacitor-community/http 里没有 Http 属性！❌')
      }
    })
    .catch((e) => {
      console.error('[DIAG] @capacitor-community/http 加载失败 ❌', e)
    })
} else {
  console.log('[DIAG] 浏览器模式：走 fetch + CORS 代理兜底')
}
// 把诊断状态挂到 window 上，App.vue 可以读来显示提示
window.__MSC_DIAG__ = { isNative, platform: Capacitor.getPlatform() }
// ========================================

// 设置 Varlet 暗色主题 + QQ 绿 #31C27C 主色
// 说明：Varlet v3 用 CSS 变量体系：Themes.md3Dark 是完整的 MD3 暗色主题对象（键名就是 "--xxx" CSS 变量）
//       1. 展开它 → 覆盖品牌色变量 → Themes.toViewport() 把 px 单位转 vmin（移动端屏幕自适应更友好）
const brandTheme = {
  ...Themes.md3Dark,
  '--color-primary': '#31C27C',
  '--color-primary-container': '#1f7a50',
  '--color-on-primary': '#ffffff',
  '--color-on-primary-container': '#e8fff0',
  '--color-inverse-primary': '#31C27C',
  '--color-surface': '#141a1e',
  '--color-surface-container': '#1c242a',
  '--color-surface-container-low': '#182026',
  '--color-surface-container-high': '#222c33',
  '--color-surface-container-highest': '#2a363e',
  '--color-on-surface': '#e6e8ea',
  '--color-on-surface-variant': '#a7b0b7',
  '--color-outline': '#3a464e',
  '--color-outline-variant': '#2a343b',
  '--color-background': '#0e1418',
  '--color-on-background': '#f1f3f5',
  '--color-scrim': '#000000',
  '--color-success': '#27ae60',
  '--color-success-container': '#145a32',
  '--color-on-success-container': '#e8fff0',
  '--color-error': '#ff4d4f',
  '--color-error-container': '#5a1d1e',
  '--color-on-error-container': '#ffe8e8'
}
// toViewport(theme)：默认 375px 设计稿 → 100vmin，手机横屏竖屏自适应
StyleProvider(Themes.toViewport(brandTheme))

// Varlet 全局禁用 ripple 动画（性能更好），可按需开启
// Locale.add(Messages['zh-CN'])

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(Varlet)
app.mount('#app')
