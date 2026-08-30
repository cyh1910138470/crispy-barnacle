// SQLite 数据库初始化与连接
// 所有数据库操作都在主进程中完成（与 better-sqlite3 的 Electron ABI 一致）
const Database = require('better-sqlite3')
const path = require('path')
const { getDbPath } = require('../utils/paths')

let db = null

function getDb() {
  if (db) return db
  const dbPath = getDbPath()
  // 首次打开会自动创建文件
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')       // WAL 模式，读写并发性能更好
  db.pragma('foreign_keys = ON')         // 开启外键约束

  initTables()
  return db
}

function initTables() {
  const d = db
  d.exec(`
    -- 本地歌曲表
    CREATE TABLE IF NOT EXISTS songs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      title         TEXT NOT NULL,
      artist        TEXT,
      album         TEXT,
      genre         TEXT,
      duration      REAL,                 -- 秒
      filepath      TEXT NOT NULL UNIQUE, -- 文件唯一
      filesize      INTEGER,
      format        TEXT,                 -- mp3 / flac / wav ...
      bitrate       INTEGER,
      sample_rate   INTEGER,
      cover_path    TEXT,                 -- 封面缓存路径
      source        TEXT DEFAULT 'local', -- local / netease / kuwo ...
      source_id     TEXT,                 -- 在线源的歌曲 ID
      lyric_path    TEXT,                 -- 歌词缓存路径
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 索引：按标题/艺人/专辑搜索
    CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
    CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
    CREATE INDEX IF NOT EXISTS idx_songs_source ON songs(source);

    -- 歌单表
    CREATE TABLE IF NOT EXISTS playlists (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      cover_path    TEXT,
      description   TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 歌单-歌曲关联表
    CREATE TABLE IF NOT EXISTS playlist_songs (
      playlist_id   INTEGER NOT NULL,
      song_id       INTEGER NOT NULL,
      sort_order    INTEGER DEFAULT 0,
      added_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (playlist_id, song_id),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    );

    -- 播放历史
    CREATE TABLE IF NOT EXISTS play_history (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id       INTEGER NOT NULL,
      played_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      position      REAL DEFAULT 0,       -- 上次听到第几秒
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    );

    -- 收藏/喜欢
    CREATE TABLE IF NOT EXISTS favorites (
      song_id       INTEGER PRIMARY KEY,
      added_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    );

    -- 歌词表
    CREATE TABLE IF NOT EXISTS lyrics (
      song_id       INTEGER PRIMARY KEY,
      lrc_text      TEXT,                 -- 原始 LRC 文本
      plain_text    TEXT,                 -- 纯文本歌词（无时间戳）
      synced        INTEGER DEFAULT 0,    -- 是否同步歌词（有时间戳）
      word_lrc     TEXT,                 -- 逐字歌词原文（QRC / YRC）
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    );
  `)

  // 旧库迁移：lyrics 表补 word_lrc 列
  const lyricCols = d.prepare("PRAGMA table_info(lyrics)").all().map((c) => c.name)
  if (!lyricCols.includes('word_lrc')) {
    d.exec('ALTER TABLE lyrics ADD COLUMN word_lrc TEXT')
  }

  // 旧库迁移：songs 表补 cover_url 列（在线源直接存 URL，不用每次拼封面地址）
  const songCols = d.prepare("PRAGMA table_info(songs)").all().map((c) => c.name)
  if (!songCols.includes('cover_url')) {
    d.exec('ALTER TABLE songs ADD COLUMN cover_url TEXT')
  }
  // 旧库迁移：songs 表补 online_type 列（记录这首歌当初缓存的源类型 qq/netease/higequ，
  // ENOENT 回退抓播放直链时按这个源去取，不依赖"当前激活的源"，避免跨源互斥导致抓不到）
  if (!songCols.includes('online_type')) {
    d.exec('ALTER TABLE songs ADD COLUMN online_type TEXT')
  }

  // 初始化默认歌单
  const count = d.prepare('SELECT COUNT(*) AS cnt FROM playlists').get().cnt
  if (count === 0) {
    const insert = d.prepare('INSERT INTO playlists (name, description) VALUES (?, ?)')
    insert.run('我喜欢', '收藏的歌曲')
    insert.run('最近播放', '最近播放的歌曲（自动）')
  }
}

function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}

module.exports = {
  getDb,
  closeDb
}
