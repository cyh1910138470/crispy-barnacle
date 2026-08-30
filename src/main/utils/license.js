// 授权（机器码 + 激活码）核心算法
// 设计：
//   机器码 = SHA-256(Windows 系统安装唯一 GUID) 截 16 位，格式 XXXX-XXXX-XXXX-XXXX
//   激活码 = HMAC-SHA256(授权密钥, 机器码) 截 20 位，格式 XXXXX-XXXXX-XXXXX-XXXXX
//   授权密钥只存在本项目内（本文件 + tools/keygen.js）：拿到激活码推不出密钥，
//   也无法为其他机器伪造激活码；换机器 = 换机器码 = 旧激活码无效
// 注意：本文件保持纯 Node 依赖（不 require electron/config），
//       tools/keygen.js 需在普通 node 环境下复用这里的算法
const { execSync } = require('child_process')
const crypto = require('crypto')
const os = require('os')

// 授权密钥：更换后所有已发出的激活码立即失效（老用户需重新授权）
const LICENSE_SECRET = 'msc-tt#a6f3-4d92-bc58-7e10d3f9a2c4'

// 读取 Windows 系统安装唯一 GUID（装系统时生成，重装才变；换硬件不影响）
function getMachineGuid() {
  try {
    const out = execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
      { timeout: 3000 }
    ).toString()
    const m = out.match(/MachineGuid\s+REG_SZ\s+(\S+)/)
    if (m) return m[1]
  } catch {
    // 非 Windows 或注册表读取失败，走回退方案
  }
  // 回退：第一块物理网卡的 MAC 地址
  const ifs = os.networkInterfaces()
  for (const list of Object.values(ifs)) {
    const hit = (list || []).find(
      (it) => !it.internal && it.mac && it.mac !== '00:00:00:00:00:00'
    )
    if (hit) return hit.mac
  }
  return `${os.hostname()}-${os.userInfo().username}`
}

// 机器码：XXXX-XXXX-XXXX-XXXX（展示给用户申请激活码用）
function getMachineCode() {
  const hash = crypto
    .createHash('sha256')
    .update(getMachineGuid())
    .digest('hex')
    .toUpperCase()
  return hash.slice(0, 16).match(/.{4}/g).join('-')
}

// 归一化：去掉横杠/空格等分隔符，转大写
function normalizeCode(s) {
  return String(s || '')
    .replace(/[^0-9A-Za-z]/g, '')
    .toUpperCase()
}

// 由机器码生成激活码（仅 tools/keygen.js 调用）
function generateActivationCode(machineCode) {
  const norm = normalizeCode(machineCode)
  if (norm.length !== 16) return null
  const hmac = crypto
    .createHmac('sha256', LICENSE_SECRET)
    .update(norm)
    .digest('hex')
    .toUpperCase()
  return hmac.slice(0, 20).match(/.{5}/g).join('-')
}

// 校验激活码：应用启动时与本机机器码绑定验证
function verifyActivationCode(code) {
  const expected = normalizeCode(generateActivationCode(getMachineCode()))
  const given = normalizeCode(code)
  if (given.length !== expected.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  } catch {
    return false
  }
}

module.exports = { getMachineCode, generateActivationCode, verifyActivationCode }
