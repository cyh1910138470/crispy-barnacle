// 全局确认弹窗（替代原生 window.confirm 的应用内统一样式）
// 用法：const ok = await appConfirm('确定删除吗？', { danger: true, okText: '删除' })

export function appConfirm(message, { title = '请确认', danger = false, okText = '确定', cancelText = '取消' } = {}) {
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent('app:confirm', { detail: { message, title, danger, okText, cancelText, resolve } })
    )
  })
}
