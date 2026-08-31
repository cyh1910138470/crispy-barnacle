/**
 * 解析 LRC 歌词文本
 * @param {string} lrcText
 * @returns {{ lyrics: Array<{time: number, text: string}>, plainText: string|null, synced: boolean }}
 */
export function parseLRC(lrcText) {
  if (!lrcText || typeof lrcText !== 'string') {
    return { lyrics: [], plainText: null, synced: false }
  }
  const lines = lrcText.split(/\r?\n/)
  const result = []
  let hasTimestamp = false
  const plainLines = []
  const tsRe = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (/^\[(ti|ar|al|by|offset):/i.test(line)) continue
    const timestamps = []
    let m
    tsRe.lastIndex = 0
    while ((m = tsRe.exec(line)) !== null) {
      hasTimestamp = true
      const mm = parseInt(m[1], 10) || 0
      const ss = parseInt(m[2], 10) || 0
      const msStr = m[3] || '0'
      const ms = parseInt(String(msStr).padEnd(3, '0').slice(0, 3), 10)
      timestamps.push(mm * 60 + ss + ms / 1000)
    }
    const text = line.replace(tsRe, '').trim()
    if (timestamps.length > 0 && text) {
      for (const t of timestamps) result.push({ time: t, text })
    } else if (text) {
      plainLines.push(text)
    }
  }
  result.sort((a, b) => a.time - b)
  const plainText =
    !hasTimestamp && plainLines.length ? plainLines.join('\n') : hasTimestamp ? null : plainLines.join('\n') || null
  return { lyrics: result, plainText, synced: hasTimestamp && result.length > 0 }
}

export function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
