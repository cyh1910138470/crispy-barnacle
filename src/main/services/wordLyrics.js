// 逐字歌词（YRC）跨源补拉服务
// 网易云公开 Web API 提供明文的逐字歌词（YRC 格式，与网页版播放器同源接口）。
// 仅在歌曲缺少逐字歌词时，按「歌名 + 歌手 + 时长」匹配后拉取歌词文本，
// 不涉及任何音频内容。匹配失败的歌会记入负缓存，避免反复请求。
const { getDb } = require('../db/init')
const { saveLyrics } = require('./localScanner')
const { parseWordLyrics } = require('../utils/qrc')

// 同一首歌的并发去重 + 失败负缓存（进程内存即可，重启后允许重试）
const inflight = new Map()
const failed = new Map()
const FAILED_RETRY_MS = 6 * 60 * 60 * 1000 // 6 小时内不重试同一首

// 歌名归一化：小写、去括号补充信息（Live/Remix/伴奏等）、去空白标点
function normTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[（(【\[][^）)】\]]*[）)】\]]/g, ' ')
    .replace(/[\s'"""·\-_~/\\~！!？?，,。.：:；;|]+/g, '')
    .trim()
}

// 歌手拆成归一化 token（按 / , 、 & feat 等分隔）
function artistTokens(s) {
  return String(s || '')
    .split(/[/、,，&]|feat\.?|with/i)
    .map((t) => t.toLowerCase().replace(/[\s'"()（）.-]+/g, '').trim())
    .filter(Boolean)
}

/**
 * 在候选列表里挑最佳匹配
 * 评分：歌名完全相等 +2 / 互相包含 +1（否则淘汰）；歌手命中 +2；时长 ±3s 内 +2 / ±8s 内 +1
 * 总分 >= 3 才算可信（即"歌名精确相等"或"包含关系且歌手命中"）
 */
function pickBest(candidates, title, artist, duration) {
  const t = normTitle(title)
  if (!t) return null
  const aTokens = artistTokens(artist)
  let best = null
  let bestScore = 0
  for (const c of candidates) {
    const ct = normTitle(c.name)
    if (!ct) continue
    let score = 0
    if (ct === t) score += 2
    else if (ct.includes(t) || t.includes(ct)) score += 1
    else continue

    const cArtists = artistTokens((c.artists || []).map((a) => a?.name).join('/'))
    if (aTokens.some((a) => cArtists.some((ca) => ca === a || ca.includes(a) || a.includes(ca)))) {
      score += 2
    }

    const cDur = Math.round((c.duration || 0) / 1000)
    if (duration > 0 && cDur > 0) {
      const diff = Math.abs(cDur - duration)
      if (diff <= 3) score += 2
      else if (diff <= 8) score += 1
    }

    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return bestScore >= 3 ? best : null
}

// 复用 onlineSource 的网易请求通道（自动收集游客 cookie + 405 限流重试；裸请求会被风控返回空结果）
// 惰性 require：避免与 onlineSource 的模块循环依赖（onlineSource 也引用了 fetchSyncedLyricForSong）
function neteaseGetLazy() {
  return require('./onlineSource').neteaseGet
}

async function searchNeteaseSongs(title, artist) {
  const kw = [title, artist].filter(Boolean).join(' ').trim()
  const data = await neteaseGetLazy()(`/api/search/get/web?s=${encodeURIComponent(kw)}&type=1&limit=8`)
  return data?.result?.songs || []
}

async function fetchNeteaseYrc(id) {
  const data = await neteaseGetLazy()(`/api/song/lyric/v1?id=${encodeURIComponent(id)}&_nmclfl=1&yv=-1&lv=-1`)
  const raw = data?.yrc?.lyric
  return typeof raw === 'string' && /\[\d+,\d+\]/.test(raw) ? raw : null
}

/**
 * 为无时间戳歌词的歌（网页抓取源：熊猫无损/闺蜜音乐/1Music）跨源匹配网易云同步歌词
 * 按「歌名 + 歌手 + 时长」匹配后拉取普通 LRC（带时间戳才有效）
 * 匹配成功返回 { lrcText, wordLrcText }；失败/无匹配返回 null（不写数据库，由调用方决定回退）
 * 注意：网易被限流（405/软风控）时返回 null，调用方应走 QQ 源备胎（onlineSource.qqSyncedLyricFallback）
 * @param {{ title:string, artist?:string, duration?:number }} song
 */
async function fetchSyncedLyricForSong(song) {
  if (!song?.title) return null
  try {
    const candidates = await searchNeteaseSongs(song.title, song.artist)
    const best = pickBest(candidates, song.title, song.artist, song.duration)
    if (!best) return null
    const data = await neteaseGetLazy()(`/api/song/lyric/v1?id=${encodeURIComponent(best.id)}&_nmclfl=1&yv=-1&lv=-1`)
    const lrc = typeof data?.lrc?.lyric === 'string' ? data.lrc.lyric : null
    // 必须真的带时间戳才算同步歌词（网易纯音乐/无词歌会返回空 LRC）
    if (!lrc || !/\[\d{1,2}:\d{1,2}(?:[.:]\d{1,3})?\]/.test(lrc)) return null
    const rawYrc = typeof data?.yrc?.lyric === 'string' ? data.yrc.lyric : null
    const wordLrcText = rawYrc && parseWordLyrics(rawYrc).length > 0 ? rawYrc : null
    return { lrcText: lrc, wordLrcText }
  } catch {
    return null
  }
}

/**
 * 为一首歌补拉逐字歌词（后台静默执行）
 * 成功后写入 word_lrc 并返回解析结果；失败/无匹配返回 null
 * @param {{ id:number, title:string, artist?:string, duration?:number }} song
 * @returns {Promise<Array|null>}
 */
async function fetchWordLyricForSong(song) {
  if (!song || !song.id || !song.title) return null

  const failedAt = failed.get(song.id)
  if (failedAt && Date.now() - failedAt < FAILED_RETRY_MS) return null
  if (inflight.has(song.id)) return inflight.get(song.id)

  const task = (async () => {
    try {
      const candidates = await searchNeteaseSongs(song.title, song.artist)
      const best = pickBest(candidates, song.title, song.artist, song.duration)
      if (!best) {
        failed.set(song.id, Date.now())
        return null
      }
      const yrc = await fetchNeteaseYrc(best.id)
      if (!yrc) {
        failed.set(song.id, Date.now())
        return null
      }
      const parsed = parseWordLyrics(yrc)
      if (!parsed.length) {
        failed.set(song.id, Date.now())
        return null
      }
      // 仅合并 word_lrc，不动已有歌词字段
      saveLyrics(song.id, null, null, null, yrc)
      console.log(`[word-lyrics] 已补拉逐字歌词: ${song.title}`)
      return parsed
    } catch (e) {
      failed.set(song.id, Date.now())
      console.warn(`[word-lyrics] 补拉失败(${song.title}):`, e.message)
      return null
    } finally {
      inflight.delete(song.id)
    }
  })()

  inflight.set(song.id, task)
  return task
}

/**
 * 启动后后台批量补拉：已有时进歌词但缺逐字歌词的歌（每轮 30 首，多次启动逐步补完）
 */
async function backfillWordLyrics() {
  try {
    const db = getDb()
    const rows = db
      .prepare(
        `SELECT s.id, s.title, s.artist, s.duration FROM songs s
         JOIN lyrics l ON l.song_id = s.id
         WHERE (l.word_lrc IS NULL OR l.word_lrc = '')
           AND l.synced = 1
         LIMIT 30`
      )
      .all()
    if (!rows.length) return { updated: 0, remaining: 0 }

    let updated = 0
    for (const row of rows) {
      const parsed = await fetchWordLyricForSong(row)
      if (parsed) updated++
      await new Promise((r) => setTimeout(r, 3000)) // 限速：与搜索接口共用网易配额，避免触发风控
    }

    const remaining = db
      .prepare(
        `SELECT COUNT(*) AS c FROM songs s
         JOIN lyrics l ON l.song_id = s.id
         WHERE (l.word_lrc IS NULL OR l.word_lrc = '')
           AND l.synced = 1`
      )
      .get()?.c || 0
    console.log(`[word-lyrics] 后台补齐：本轮更新 ${updated} 首，剩余 ${remaining} 首`)
    return { updated, remaining }
  } catch (e) {
    return { updated: 0, error: e.message }
  }
}

module.exports = {
  fetchWordLyricForSong,
  backfillWordLyrics,
  fetchSyncedLyricForSong,
  normTitle,
  artistTokens
}
