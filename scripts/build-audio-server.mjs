// 打包内置音源服务（qq-music-api）为单文件 CJS bundle
// 产物：resources/audio-server/dist/qq-music-api.cjs + public/ 静态目录
// 运行时由 Electron 内置 Node（ELECTRON_RUN_AS_NODE=1）执行，朋友电脑无需安装 Node
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const apiRoot = path.join(root, 'qq-music-api');
const outDir = path.join(root, 'resources', 'audio-server');
const publicDir = path.join(outDir, 'public');

console.log('[audio-server] building bundle...');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'audio-server-entry.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: path.join(outDir, 'dist', 'qq-music-api.cjs'),
  sourcemap: false,
  // 源码（ESM）里用 import.meta.url 推导目录；CJS 输出没有 import.meta，
  // 老版 esbuild 会替换成 undefined 导致启动崩溃。
  // define 只接受标识符，因此先用 banner 在产物头部定义 shim 常量，再引用它
  define: {
    'import.meta.url': 'IMPORT_META_URL_SHIM',
  },
  banner: {
    js: 'const IMPORT_META_URL_SHIM = require("node:url").pathToFileURL(__filename).href;',
  },
  minify: false, // 保留可读性，方便排查问题
  logLevel: 'silent',
});

// 静态资源目录（explorer 调试页等，koaApp 的 publicDir fallback 依赖这个位置）
fs.rmSync(publicDir, { recursive: true, force: true });
fs.cpSync(path.join(apiRoot, 'public'), publicDir, { recursive: true });

const size = fs.statSync(path.join(outDir, 'dist', 'qq-music-api.cjs')).size;
console.log(`[audio-server] done: dist/qq-music-api.cjs (${(size / 1024).toFixed(0)} KB) + public/`);
