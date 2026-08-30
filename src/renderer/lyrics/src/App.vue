<template>
  <div class="dt-lyrics" :class="{ vertical: s.layout === 'vertical', locked: s.locked }" @mouseenter="onEnter" @mouseleave="onLeave" @mousedown="onDragStart">
    <!-- 歌词内容 -->
    <div class="lines" :style="fontVars">
      <!-- 当前句：双层文字 + 裁剪实现逐字变色 -->
      <div v-if="text" class="line current" :class="{ paused: !playing }">
        <span class="base">{{ text }}</span>
        <span :key="text" class="fill" :style="fillStyle">{{ text }}</span>
      </div>
      <!-- 下一句（仅横排显示） -->
      <div v-if="next && s.layout !== 'vertical'" class="line next">{{ next }}</div>
      <!-- 占位 -->
      <div v-if="!text && !next" class="line placeholder">MSC-TT 桌面歌词</div>
    </div>

    <!-- 锁定状态：只显示解锁小把手（窗口其余部分点击穿透） -->
    <button v-if="s.locked" class="lock-tab" title="桌面歌词已锁定，点击解锁" @click="toggleLock">
      <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 016 0v3H9z"/></svg>
    </button>

    <!-- 悬浮工具栏：未锁定时鼠标悬停显示 -->
    <div v-if="!s.locked" v-show="hovered || panelOpen" class="toolbar" @mouseleave="armPanelClose">
      <button class="tool-btn" :title="s.layout === 'vertical' ? '切换横排' : '切换竖排'" @click="patch({ layout: s.layout === 'vertical' ? 'horizontal' : 'vertical' })">
        {{ s.layout === 'vertical' ? '横' : '竖' }}
      </button>
      <button class="tool-btn" title="字号与颜色" :class="{ on: panelOpen }" @click="panelOpen = !panelOpen">
        <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M3 4h18v4h-2V6h-6v14h3v2H8v-2h3V6H5v2H3V4z"/></svg>
      </button>
      <button class="tool-btn" title="锁定位置（防止误拖，点击穿透）" @click="toggleLock">
        <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 016 0v3H9z"/></svg>
      </button>
      <button class="tool-btn" title="关闭桌面歌词" @click="close">
        <svg viewBox="0 0 12 12" width="11" height="11"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>

      <!-- 设置面板：字号 + 颜色 -->
      <div v-if="panelOpen" class="settings-panel" @mouseenter="onPanelEnter">
        <div class="panel-row">
          <span class="lbl">字号</span>
          <div class="opts">
            <button
              v-for="opt in sizeOpts"
              :key="opt.key"
              class="opt-btn"
              :class="{ on: s.fontSize === opt.key }"
              @click="patch({ fontSize: opt.key })"
            >{{ opt.label }}</button>
          </div>
        </div>
        <div class="panel-row">
          <span class="lbl">颜色</span>
          <div class="opts">
            <button
              v-for="c in colorOpts"
              :key="c"
              class="swatch"
              :class="{ on: s.color === c }"
              :style="{ background: c }"
              @click="patch({ color: c })"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const text = ref('')
const next = ref('')
const playing = ref(true)
const hovered = ref(false)
const panelOpen = ref(false)
// 当前句的起止时间与播放进度（主窗口推送）
const lineStart = ref(0)
const lineEnd = ref(0)
const time = ref(0)
// 当前句逐字时间（[{text,start,duration}]，主窗口在 QRC/YRC 歌词可用时推送）
const words = ref([])

// 桌面歌词设置（主进程持久化）
const s = reactive({ layout: 'horizontal', fontSize: 'medium', color: '#21C37A', locked: false })

const sizeOpts = [
  { key: 'small', label: '小' },
  { key: 'medium', label: '中' },
  { key: 'large', label: '大' }
]
const colorOpts = ['#21C37A', '#FFFFFF', '#FF7EB6', '#4FC3F7', '#FFD54F', '#B388FF']
const sizePx = { small: 20, medium: 28, large: 36 }

// 字号/颜色注入 CSS 变量
const fontVars = computed(() => ({
  '--lyr-size': sizePx[s.fontSize] + 'px',
  '--lyr-color': s.color
}))

// 字符演唱权重：汉字/日文假名等全角字符 = 1，空格 = 0.4，其他（英文数字）= 0.6
const weightOf = (c) => (/[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3040-\u30FF]/.test(c) ? 1 : (c === ' ' ? 0.4 : 0.6))

// 一个词（可能多字符）的总权重
function wordWeight(t) {
  let w = 0
  for (const c of t) w += weightOf(c)
  return Math.max(w, 0.1)
}

// 卡拉OK填充百分比
// 有逐字时间（QRC/YRC）时：按每个字的精确起止时间填色，当前字内部按进度插值
// 无逐字时间时：按"时间进度"估算"已唱字数"（短暂进入延迟 + 句尾留拖音）
const fillPct = computed(() => {
  const chars = Array.from(text.value)
  if (!chars.length) return 0

  const ws = words.value
  if (ws.length) {
    // ---- 精确模式 ----
    let total = 0
    for (const w of ws) total += wordWeight(w.text)
    if (total <= 0) return 0

    let acc = 0
    const t = time.value
    for (const w of ws) {
      const ww = wordWeight(w.text)
      if (t >= w.start + w.duration) {
        acc += ww // 这个字已唱完
      } else if (t > w.start) {
        // 当前字：内部按进度插值（避免瞬跳，填充边缘平滑扫过）
        const frac = Math.min(1, (t - w.start) / Math.max(0.001, w.duration))
        return ((acc + ww * frac) / total) * 100
      } else {
        break // 这个字还没开始唱
      }
    }
    return 100
  }

  // ---- 估算模式（普通 LRC）----
  if (lineEnd.value <= lineStart.value) return 0
  const weights = chars.map(weightOf)
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return 0

  // 人声时间窗口：延迟约 0.25s 进入，句尾约 18% 时长是拖尾音，不参与填充
  const dur = lineEnd.value - lineStart.value
  const vocalStart = lineStart.value + Math.min(0.25, dur * 0.08)
  const vocalDur = Math.max(0.5, dur * 0.82 - 0.25)

  let p = (time.value - vocalStart) / vocalDur
  p = Math.min(1, Math.max(0, p))

  // 时间进度 → 加权字数进度（填充边缘落在字与字之间，更贴合演唱节奏）
  const target = p * total
  let acc = 0
  for (let i = 0; i < weights.length; i++) {
    if (acc + weights[i] >= target) {
      const frac = Math.min(weights[i], target - acc)
      return ((acc + frac) / total) * 100
    }
    acc += weights[i]
  }
  return 100
})

// 已唱部分用裁剪显示成变色层：横排从左往右，竖排从上往下
const fillStyle = computed(() => {
  const p = fillPct.value
  return s.layout === 'vertical'
    ? { clipPath: `inset(0 0 ${100 - p}% 0)` }
    : { clipPath: `inset(0 ${100 - p}% 0 0)` }
})

function onPush(data) {
  text.value = data.text || ''
  next.value = data.next || ''
  playing.value = data.playing !== false
  lineStart.value = data.lineStart || 0
  lineEnd.value = data.lineEnd || 0
  time.value = data.time || 0
  words.value = Array.isArray(data.words) && data.words.length ? data.words : []
}

// 更新设置并持久化（主进程会广播回来）
function patch(partial) {
  window.dtLyricsAPI?.setSettings?.(partial)
}

function toggleLock() {
  patch({ locked: !s.locked })
  panelOpen.value = false
}

function onEnter() {
  hovered.value = true
  clearTimeout(leaveTimer)
}

function onLeave() {
  hovered.value = false
  armPanelClose()
}

function onPanelEnter() {
  clearTimeout(leaveTimer)
}

// 延迟关闭设置面板：给鼠标在工具栏↔面板之间移动留缓冲
function armPanelClose() {
  clearTimeout(leaveTimer)
  leaveTimer = setTimeout(() => { panelOpen.value = false }, 450)
}

// ============ 手动拖拽 ============
// 不能用 -webkit-app-region: drag（拖拽区域不派发鼠标事件，会导致悬浮/按钮失效）
let dragging = false
let leaveTimer = null
const dragStart = { x: 0, y: 0, wx: 0, wy: 0 }

async function onDragStart(e) {
  if (s.locked) return
  // 工具栏/设置面板/解锁把手上的按下不触发拖动
  if (e.target.closest('.toolbar, .settings-panel, .lock-tab')) return
  dragging = true
  const pos = (await window.dtLyricsAPI?.getPosition?.()) || { x: 0, y: 0 }
  dragStart.x = e.screenX
  dragStart.y = e.screenY
  dragStart.wx = pos.x
  dragStart.wy = pos.y
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e) {
  if (!dragging) return
  const dx = e.screenX - dragStart.x
  const dy = e.screenY - dragStart.y
  window.dtLyricsAPI?.moveTo?.(dragStart.wx + dx, dragStart.wy + dy)
}

function onDragEnd() {
  dragging = false
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
}

function close() {
  window.dtLyricsAPI?.close()
}

onMounted(async () => {
  window.dtLyricsAPI?.onLyricsPush(onPush)
  // 初始化设置 + 监听主进程同步
  if (window.dtLyricsAPI?.getSettings) {
    Object.assign(s, await window.dtLyricsAPI.getSettings())
  }
  window.dtLyricsAPI?.onSettingsChange?.((settings) => {
    Object.assign(s, settings)
  })
})
</script>

<style>
/* 覆盖全局样式：悬浮窗默认透明 */
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background: transparent !important;
  overflow: hidden;
}

.dt-lyrics {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  /* 极淡背景：肉眼不可见，但让整个窗口可命中鼠标（否则透明区域事件穿透） */
  background: rgba(0, 0, 0, 0.01);
  cursor: move;
  user-select: none;
  -webkit-user-select: none;
}

/* 悬停时给一点底色，提示可拖动/有工具栏 */
.dt-lyrics:not(.locked):hover {
  background: rgba(10, 10, 10, 0.35);
  border-radius: 14px;
}

/* ============ 锁定状态：点击穿透 ============ */
.dt-lyrics.locked {
  background: transparent;
  cursor: default;
}

.dt-lyrics.locked .lines {
  pointer-events: none;
}

.lines {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  max-width: 96%;
  max-height: 96%;
}

.line {
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  max-height: 100%;
}

.line.current {
  position: relative;
  font-size: var(--lyr-size, 28px);
  font-weight: 800;
  color: rgba(255, 255, 255, 0.92);
  text-shadow:
    1px 1px 0 rgba(0, 0, 0, 0.85),
    -1px -1px 0 rgba(0, 0, 0, 0.85),
    1px -1px 0 rgba(0, 0, 0, 0.85),
    -1px 1px 0 rgba(0, 0, 0, 0.85),
    0 2px 10px rgba(0, 0, 0, 0.6);
  transition: color 0.2s ease;
}

/* 未演唱部分 */
.line.current .base {
  color: inherit;
}

/* 已演唱部分（变色覆盖层，随进度裁剪） */
.line.current .fill {
  position: absolute;
  inset: 0;
  color: var(--lyr-color, #21C37A);
  text-shadow: inherit;
  clip-path: inset(0 100% 0 0);
  transition: clip-path 0.3s linear;
  pointer-events: none;
}

/* 暂停时整句变灰 */
.line.current.paused {
  color: #aab0b6;
}

.line.current.paused .fill {
  color: #7a8a82;
}

.line.next {
  font-size: calc(var(--lyr-size, 28px) * 0.64);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  text-shadow:
    1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.8),
    1px -1px 0 rgba(0, 0, 0, 0.8),
    -1px 1px 0 rgba(0, 0, 0, 0.8);
}

.line.placeholder {
  font-size: 22px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  text-shadow:
    1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.8),
    1px -1px 0 rgba(0, 0, 0, 0.8),
    -1px 1px 0 rgba(0, 0, 0, 0.8);
}

/* ============ 竖排模式 ============ */
.dt-lyrics.vertical .lines {
  flex-direction: row;
  justify-content: center;
}

.dt-lyrics.vertical .line.current {
  writing-mode: vertical-rl;   /* 文字竖排：从上到下 */
  text-orientation: upright;   /* 字符保持直立 */
  letter-spacing: 6px;         /* 竖排字间距 */
}

/* ============ 悬浮工具栏 ============ */
.toolbar {
  position: absolute;
  top: 6px;
  right: 8px;
  display: flex;
  gap: 6px;
  align-items: center;
}

.dt-lyrics.vertical .toolbar {
  top: auto;
  bottom: 8px;
  right: auto;
  left: 8px;
}

.tool-btn {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease;
}

.tool-btn:hover {
  background: rgba(0, 0, 0, 0.85);
}

.tool-btn.on {
  background: var(--lyr-color, #21C37A);
}

/* ============ 设置面板 ============ */
.settings-panel {
  position: absolute;
  top: 26px; /* 紧贴工具栏底边，无缝隙，鼠标移动不会中途离开 */
  right: 0;
  background: rgba(24, 24, 26, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
}

.dt-lyrics.vertical .settings-panel {
  top: auto;
  bottom: 26px;
  right: auto;
  left: 0;
}

.panel-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lbl {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  width: 26px;
}

.opts {
  display: flex;
  gap: 6px;
  align-items: center;
}

.opt-btn {
  min-width: 28px;
  height: 22px;
  padding: 0 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 11px;
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  font-size: 11px;
  cursor: pointer;
}

.opt-btn:hover {
  border-color: rgba(255, 255, 255, 0.4);
}

.opt-btn.on {
  background: var(--lyr-color, #21C37A);
  border-color: var(--lyr-color, #21C37A);
  color: #fff;
}

.swatch {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  outline: 1px solid rgba(255, 255, 255, 0.2);
}

.swatch.on {
  border-color: #fff;
  outline: none;
  transform: scale(1.15);
}

/* ============ 锁定把手 ============ */
.lock-tab {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.45;
  transition: opacity 0.15s ease;
}

.lock-tab:hover {
  opacity: 1;
}
</style>
