// 生成应用图标 build/icon.png（256x256，绿底白色音符）
// 纯 Node 实现 PNG 编码，无需任何依赖
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 256
const BG = [16, 185, 129] // 翡翠绿 #10b981
const FG = [255, 255, 255] // 白色音符

const rgba = new Uint8Array(SIZE * SIZE * 4)

function setPx(x, y, c) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
  const i = (y * SIZE + x) * 4
  rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = 255
}

// 圆角矩形背景（圆角半径 48）
const R = 48
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // 计算到圆角矩形的距离判定
    const cx = Math.max(R, Math.min(SIZE - R, x))
    const cy = Math.max(R, Math.min(SIZE - R, y))
    const dx = x - cx, dy = y - cy
    if (dx * dx + dy * dy <= R * R) setPx(x, y, BG)
  }
}

// 空心圆（描边）：cx, cy, r 外 r-t 内
function ring(cx, cy, r, t) {
  for (let y = cy - r - 1; y <= cy + r + 1; y++) {
    for (let x = cx - r - 1; x <= cx + r + 1; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d <= r && d >= r - t) setPx(x, y, FG)
    }
  }
}

// 实心圆
function disc(cx, cy, r) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (Math.hypot(x - cx, y - cy) <= r) setPx(x, y, FG)
    }
  }
}

// 矩形
function rect(x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setPx(x, y, FG)
}

// 绘制连梁双音符（beamed eighth notes）
rect(96, 74, 160, 96)          // 顶部横梁
rect(96, 74, 108, 168)         // 左竖干
rect(148, 74, 160, 158)        // 右竖干（略短，形成倾斜感）
disc(84, 172, 26)              // 左符头
disc(136, 162, 26)             // 右符头

// ---- PNG 编码 ----
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
function crc32(buf) {
  let c = -1
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8   // 位深
ihdr[9] = 6   // RGBA

// 每行前加 filter byte 0
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0
  Buffer.from(rgba.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1)
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0))
])

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'build', 'icon.png')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, png)
console.log('图标已生成:', out, `(${png.length} bytes)`)
