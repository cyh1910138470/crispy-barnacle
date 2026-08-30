#!/usr/bin/env node
// MSC-TT 授权密钥生成工具（仅作者本人使用，勿随应用分发给他人）
//
// 用法：
//   node tools/keygen.js                        交互式输入机器码
//   node tools/keygen.js 1A2B-3C4D-5E6F-7089    直接传机器码（横杠可省略）
//
// 授权流程：
//   1. 对方打开软件 → 激活页显示「机器码」并发给你
//   2. 你运行本工具，输入机器码 → 得到「激活码」
//   3. 对方在激活页输入激活码 → 永久激活（激活信息存在他那台电脑的用户目录，转发软件无效）
const readline = require('readline')
const { generateActivationCode } = require('../src/main/utils/license')

const arg = process.argv[2]

if (arg) {
  handle(arg)
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl.question('请输入对方发来的机器码: ', (answer) => {
    rl.close()
    handle(answer)
  })
}

function handle(machineCode) {
  const code = generateActivationCode(machineCode)
  if (!code) {
    console.error('机器码格式不对！应为 16 位，如 1A2B-3C4D-5E6F-7089（横杠可省略）')
    process.exit(1)
  }
  console.log('')
  console.log('  机器码: ' + machineCode.trim().toUpperCase())
  console.log('  激活码: ' + code)
  console.log('')
  console.log('把激活码发给对方，在软件激活页输入即可。')
}
