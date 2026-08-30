import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { resolve, relative } from 'path'
import { readdirSync, statSync } from 'fs'

// 递归收集某个目录下所有 .js 文件作为 rollup 多入口
// 这样主进程里的 windows/login.js、utils/paths.js 等相对 require 都能被正确构建
function collectInputs(dir, root = dir) {
  const result = {}
  function walk(d) {
    for (const name of readdirSync(d)) {
      const full = resolve(d, name)
      if (statSync(full).isDirectory()) {
        walk(full)
      } else if (name.endsWith('.js')) {
        const rel = relative(root, full).replace(/\\/g, '/').replace(/\.js$/, '')
        result[rel] = full
      }
    }
  }
  walk(dir)
  return result
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main')
      }
    },
    build: {
      rollupOptions: {
        // 自动把 src/main/ 下所有 js 作为入口，确保相对 require 都能解析
        input: collectInputs(resolve('src/main')),
        output: {
          entryFileNames: '[name].js'
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          login: resolve('src/preload/login.js'),
          main: resolve('src/preload/main.js'),
          lyrics: resolve('src/preload/lyrics.js')
        },
        output: {
          entryFileNames: '[name].js'
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src')
      }
    },
    build: {
      rollupOptions: {
        input: {
          login: resolve('src/renderer/login/index.html'),
          main: resolve('src/renderer/main/index.html'),
          lyrics: resolve('src/renderer/lyrics/index.html')
        }
      }
    },
    plugins: [vue()]
  }
})
