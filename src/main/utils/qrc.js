// 逐字歌词（卡拉OK歌词）解析工具
// 支持两种来源的逐字歌词文本：
//  - 网易云 YRC：[start,dur](start,dur,0)字(start,dur,0)字...（时间标记在字前面）
//  - QQ QRC：  [start,dur]字(start,dur)字(start,dur)...（时间标记在字后面）
// 特性：
//  - 行头 [start,dur] 全局扫描，自动兼容"两行粘在一行"的数据（网易云 yrc 实测存在）
//  - JSON 形式的元数据行（网易云 yrc 开头的 {"t":...,"c":[...]}）与 [ti:xx] [offset:0] 等 LRC 标签自动跳过
//
// 统一输出（秒为单位）：
//   [{ start, duration, text, words: [{ text, start, duration }] }]

/**
 * 解析逐字歌词文本
 * @param {string} raw - YRC / QRC 原始文本
 * @returns {Array<{start: number, duration: number, text: string, words: Array<{text: string, start: number, duration: number}>}>}
 */
function parseWordLyrics(raw) {
  if (!raw || typeof raw !== 'string') return []
  if (!/\[\d+,\d+\]/.test(raw)) return [] // 必须含行头，否则不是逐字歌词

  // 全局扫描行头，记录每个行头在原文中的位置，把文本切成 [行头 + 内容] 片段
  // （兼容"两行粘在一行"的数据：每个行头各自开启一段内容）
  const headIdx = []
  const re = /\[(\d+),(\d+)\]/g
  let m
  while ((m = re.exec(raw)) !== null) {
    headIdx.push({ idx: m.index, end: m.index + m[0].length, start: parseInt(m[1], 10) / 1000, duration: parseInt(m[2], 10) / 1000 })
  }

  const result = []
  for (let i = 0; i < headIdx.length; i++) {
    const cur = headIdx[i]
    const body = raw.slice(cur.end, i + 1 < headIdx.length ? headIdx[i + 1].idx : raw.length)
    const words = parseLineWords(body.replace(/\r?\n/g, ' ').trim())
    if (words.length === 0) continue

    // 行时长兜底：从最后一个字的结束时间推算
    const lastWord = words[words.length - 1]
    const derived = lastWord.start + lastWord.duration - cur.start
    const duration = cur.duration > 0 ? cur.duration : derived

    result.push({
      start: cur.start,
      duration: Math.max(0, duration),
      text: words.map((w) => w.text).join(''),
      words
    })
  }

  result.sort((a, b) => a.start - b.start)
  return result
}

/**
 * 解析一段行内容的逐字时间标记，自动识别两种模式：
 *  - YRC：时间标记在前，文字在后  → (34290,390,0)让(34680,520,0)我
 *  - QRC：文字在前，时间标记在后  → 温柔(11750,470)的(12220,120)
 */
function parseLineWords(body) {
  const words = []

  // YRC 模式：时间标记含第三个参数 (start,dur,0)
  if (/\(\d+,\d+,\d+\)/.test(body)) {
    // split 后结构：[前置, s1, d1, 文字1, s2, d2, 文字2, ...]
    const parts = body.split(/\((\d+),(\d+)(?:,\d+)?\)/)
    for (let i = 1; i + 2 < parts.length; i += 3) {
      const text = parts[i + 2]
      if (text) {
        words.push({
          text,
          start: parseInt(parts[i], 10) / 1000,
          duration: parseInt(parts[i + 1], 10) / 1000
        })
      }
    }
    return words
  }

  // QRC 模式：文字在前，时间标记 (start,dur) 在后
  const re = /\((\d+),(\d+)\)/g
  let last = 0
  let m
  while ((m = re.exec(body)) !== null) {
    const text = body.slice(last, m.index)
    if (text) {
      words.push({
        text,
        start: parseInt(m[1], 10) / 1000,
        duration: parseInt(m[2], 10) / 1000
      })
    }
    last = re.lastIndex
  }
  return words
}

module.exports = { parseWordLyrics }
