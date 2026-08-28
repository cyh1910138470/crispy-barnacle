// 密码哈希与验证
// 用 bcryptjs（纯 JS 实现，跨平台无需编译）
const bcrypt = require('bcryptjs')

// 默认密码（首次启动用，用户改密码后保存哈希到 config.json）
const DEFAULT_PASSWORD = '1910138470'

function hashPassword(plain) {
  const salt = bcrypt.genSaltSync(10)
  return bcrypt.hashSync(plain, salt)
}

// 验证密码
// hash 为 null 表示首次启动，与默认密码比对
function verifyPassword(plain, hash) {
  if (!hash) {
    return plain === DEFAULT_PASSWORD
  }
  try {
    return bcrypt.compareSync(plain, hash)
  } catch (e) {
    console.error('[password] 验证异常:', e)
    return false
  }
}

module.exports = {
  DEFAULT_PASSWORD,
  hashPassword,
  verifyPassword
}
