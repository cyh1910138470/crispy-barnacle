/**
 * 统一的封面加载失败兜底（所有页面复用）
 * 用法：
 *   import { useCover } from '../composables/useCover'
 *   const { markBroken, isBroken, resetBrokenKey, onCoverError, onCoverErrorInline } = useCover()
 *   <img v-if="coverUrl && !isBroken('c-1')" :src="coverUrl" @error="e => onCoverError(e, 'c-1', () => (coverRef.value = ''))" />
 */
import { reactive } from 'vue'

export function useCover() {
  const brokenSet = reactive(new Set())

  function isBroken(key) {
    return brokenSet.has(key)
  }
  function markBroken(key) {
    brokenSet.add(key)
  }
  function resetBrokenKey(key) {
    brokenSet.delete(key)
  }
  function resetAllBroken() {
    brokenSet.clear()
  }

  /**
   * 标准：失败时把 brokenSet 置 key，并清掉对应 ref 的 src（通过 onClear 回调）
   * @param {Event} e
   * @param {string|number} key
   * @param {() => void} [onClear] 可选：调用后清空承载 src 的响应式变量，触发 v-if 重新渲染
   */
  function onCoverError(e, key, onClear) {
    if (!key) return
    if (brokenSet.has(key)) return // 避免重复触发
    brokenSet.add(key)
    if (typeof onClear === 'function') {
      try { onClear() } catch {}
    }
    if (e?.target) {
      try {
        e.target.onerror = null
        e.target.removeAttribute('src')
      } catch {}
    }
  }

  /**
   * 内联写法（适合大列表 v-for，避免闭包）：给每个 item 生成一个 handler
   *   @error="onCoverErrorInline('s-' + s.id, s)"
   */
  function onCoverErrorInline(key, holderRef) {
    return (e) => onCoverError(e, key, () => {
      // 约定 holderRef.src / holderRef.cover_url / holderRef.coverUrl 清为空
      if (!holderRef) return
      if ('src' in holderRef) holderRef.src = ''
      if ('cover_url' in holderRef) holderRef.cover_url = ''
      if ('coverUrl' in holderRef) holderRef.coverUrl = ''
    })
  }

  return {
    isBroken,
    markBroken,
    resetBrokenKey,
    resetAllBroken,
    onCoverError,
    onCoverErrorInline
  }
}
