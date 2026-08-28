// LRC 歌词解析工具
// 支持标准 LRC 格式：[mm:ss.xx] 或 [mm:ss.xxx]，一行多个时间戳
// 返回 [{ time: number, text: string }] 结构

/**
 * 解析 LRC 文本
 * @param {string} lrcText - LRC 格式歌词文本
 * @returns {{ lyrics: Array<{time: number, text: string}>, plainText: string | null }}
 */
function parseLRC(lrcText) {
  if (!lrcText || typeof lrcText !== 'string') {
    return { lyrics: [], plainText: null }
  }

  const lines = lrcText.split(/\r?\n/)
  const result = []
  let hasTimestamp = false
  let hasText = false
  const plainLines = []

  // 正则匹配时间戳 [mm:ss.xx] 或 [mm:ss.xxx]
  const timestampRegex = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g

  for (const line of lines) {
    // 跳过空行和纯 metadata 行
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^\[(ti|ar|al|by|offset):/.test(trimmed)) continue

    // 提取所有时间戳
    const timestamps = []
    let match
    timestampRegex.lastIndex = 0
    while ((match = timestampRegex.exec(line)) !== null) {
      hasTimestamp = true
      const minutes = parseInt(match[1], 10)
      const seconds = parseInt(match[2], 10)
      const msStr = match[3] || '0'
      const ms = parseInt(msStr.padEnd(3, '0').slice(0, 3), 10)
      const time = minutes * 60 + seconds + ms / 1000
      timestamps.push(time)
    }

    // 提取歌词文本（去除所有时间戳）
    const text = trimmed.replace(timestampRegex, '').trim()

    if (timestamps.length > 0 && text) {
      hasText = true
      for (const ts of timestamps) {
        result.push({ time: ts, text })
      }
    } else if (text) {
      plainLines.push(text)
    }
  }

  // 按时间排序
  result.sort((a, b) => a.time - b.time)

  const plainText = plainLines.length > 0 && !hasTimestamp ? plainLines.join('\n') : null

  return {
    lyrics: hasTimestamp ? result : [],
    plainText
  }
}

/**
 * 获取当前时间对应的歌词行索引（二分查找）
 * @param {Array<{time: number}>} lyrics - 已解析的歌词数组
 * @param {number} currentTime - 当前播放时间（秒）
 * @returns {number} 歌词行索引
 */
function findLyricIndex(lyrics, currentTime) {
  if (!lyrics || lyrics.length === 0) return -1

  let lo = 0
  let hi = lyrics.length - 1
  let idx = -1

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (lyrics[mid].time <= currentTime) {
      idx = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return idx
}

/**
 * 格式化秒数为 mm:ss
 */
function formatLrctime(sec) {
  if (sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 1000)
  return `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}]`
}

/**
 * 将歌词数组反序列化为 LRC 文本
 */
function toLRC(lyrics) {
  if (!lyrics || lyrics.length === 0) return ''
  return lyrics
    .map(({ time, text }) => `${formatLrctime(time)}${text}`)
    .join('\n')
}

/**
 * 从 music-metadata 的歌词字段中提取原始文本
 * 兼容多种格式：字符串、数组、对象
 */
function extractLyricText(lyricsField) {
  if (!lyricsField) return null

  if (typeof lyricsField === 'string') {
    return lyricsField
  }

  if (Array.isArray(lyricsField)) {
    // 可能是 [{ value: '...', language: '...' }] 格式
    if (lyricsField.length > 0 && typeof lyricsField[0] === 'object' && lyricsField[0].value) {
      return lyricsField[0].value
    }
    // 或纯字符串数组
    return lyricsField.join('\n')
  }

  if (typeof lyricsField === 'object') {
    return lyricsField.value || lyricsField.text || null
  }

  return null
}

module.exports = {
  parseLRC,
  findLyricIndex,
  toLRC,
  extractLyricText,
  formatLrctime
}
