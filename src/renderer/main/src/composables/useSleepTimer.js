// 睡眠定时器（模块级单例）：到点自动停止播放
// 状态放模块作用域，设置页组件卸载后定时器继续有效
import { ref, computed } from 'vue'

export const SLEEP_OPTIONS = [0, 30, 60, 90]

const remainSec = ref(0) // 0 表示未开启
export const selectedMins = ref(0)
let timer = null

export const sleepActive = computed(() => remainSec.value > 0)

export const sleepDescText = computed(() => {
  if (remainSec.value <= 0) return '定时停止播放，适合睡前听歌'
  const m = Math.floor(remainSec.value / 60)
  const s = remainSec.value % 60
  return `将在 ${m} 分 ${String(s).padStart(2, '0')} 秒后停止播放`
})

export function setSleepTimer(mins, player) {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (!mins) {
    remainSec.value = 0
    selectedMins.value = 0
    return
  }
  remainSec.value = mins * 60
  selectedMins.value = mins
  timer = setInterval(() => {
    remainSec.value -= 1
    if (remainSec.value <= 0) {
      clearInterval(timer)
      timer = null
      remainSec.value = 0
      selectedMins.value = 0
      try { player.stop() } catch {}
      window.dispatchEvent(
        new CustomEvent('app:toast', { detail: { text: '睡眠时间到，已停止播放', type: 'info' } })
      )
    }
  }, 1000)
}
