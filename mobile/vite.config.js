import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url))
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 1500
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // 🛠️ 开发阶段：把三个音乐源 + CORS 代理的请求都走 Vite 本地代理
    //    这样浏览器调试时完全不走公共 CORS 代理（更稳定、无编码问题）
    proxy: {
      // higequ（不写 www 时也是它）
      '/__p_higequ': {
        target: 'https://higequ.com',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/__p_higequ/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
          'Referer': 'https://higequ.com/'
        }
      },
      '/__p_xmwav': {
        target: 'https://www.xmwav.net',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/__p_xmwav/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
          'Referer': 'https://www.xmwav.net/'
        }
      },
      '/__p_gmmp3': {
        target: 'https://www.gmmp3.com',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/__p_gmmp3/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
          'Referer': 'https://www.gmmp3.com/'
        }
      },
      '/__p_corsproxy': {
        target: 'https://corsproxy.io',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/__p_corsproxy/, '')
      }
    }
  }
})
