<template>
  <div class="app-root" :class="{ 'has-mini-only': !showTabs }">
    <!-- 顶部栏 -->
    <div class="topbar" :style="{ paddingTop: `calc(${safeTop}px + 8px)` }">
      <template v-if="$route.name === 'home'">
        <div class="brand">
          <span class="logo-dot"></span>
          <span class="brand-text">MSC-TT</span>
        </div>
        <div class="top-actions">
          <var-icon
            name="magnify"
            size="22"
            color="#a7b0b7"
            @click="$router.push('/search')"
          />
        </div>
      </template>

      <template v-else-if="$route.name === 'search'">
        <div class="search-wrap" @click="$refs.searchInput && $refs.searchInput.focus()">
          <var-icon name="magnify" size="16" color="#6b7680" />
          <input
            ref="searchInput"
            v-model="kw"
            class="search-input"
            placeholder="搜索歌曲、歌手、专辑"
            @keyup.enter="onSearch"
          />
          <var-icon
            v-if="kw"
            name="close-circle"
            size="16"
            color="#6b7680"
            @click.stop="kw = ''; onSearch()"
          />
        </div>
      </template>

      <template v-else-if="$route.name === 'player'">
        <var-icon
          name="chevron-down"
          size="26"
          color="#a7b0b7"
          @click="$router.back()"
        />
        <div class="top-title ellipsis">
          {{ player.currentMeta?.title || '正在播放' }}
        </div>
        <var-icon
          name="dots-vertical"
          size="22"
          color="#a7b0b7"
          @click="onMore"
        />
      </template>

      <template v-else-if="$route.name === 'mine'">
        <div class="brand">
          <span class="brand-text" style="font-size:18px">我的</span>
        </div>
        <div></div>
      </template>
    </div>

    <!-- 页面内容 -->
    <div class="app-content scroll-y no-scrollbar">
      <router-view v-slot="{ Component, route }">
        <transition name="page" mode="out-in">
          <component :is="Component" :key="route.fullPath" @search-go="goSearch" />
        </transition>
      </router-view>
    </div>

    <!-- 迷你播放条（非播放页才显示） -->
    <MiniPlayer v-if="player.currentMeta && $route.name !== 'player'" />

    <!-- 底部 Tab 导航 -->
    <div
      v-if="showTabs"
      class="tabbar"
      :style="{ paddingBottom: safeBottom + 'px' }"
    >
      <div
        class="tab-item"
        :class="{ active: $route.name === 'home' }"
        @click="$router.push('/home')"
      >
        <var-icon :name="$route.name === 'home' ? 'home' : 'home-outline'" size="24" />
        <span>首页</span>
      </div>
      <div
        class="tab-item"
        :class="{ active: $route.name === 'search' }"
        @click="$router.push('/search')"
      >
        <var-icon
          :name="$route.name === 'search' ? 'magnify' : 'magnify-plus-outline'"
          size="24"
        />
        <span>搜索</span>
      </div>
      <div
        class="tab-item"
        :class="{ active: $route.name === 'mine' }"
        @click="$router.push('/mine')"
      >
        <var-icon
          :name="$route.name === 'mine' ? 'account-circle' : 'account-circle-outline'"
          size="24"
        />
        <span>我的</span>
      </div>
    </div>

    <!-- Snackbar 容器（Varlet 组件自带挂载） -->
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Snackbar } from '@varlet/ui'
import { usePlayerStore } from '@shared/stores/player'
import MiniPlayer from '@/components/MiniPlayer.vue'

const player = usePlayerStore()
const route = useRoute()
const router = useRouter()

const safeTop = ref(0)
const kw = ref(route.query.kw || '')
// 导航栏是否显示：在 player 全屏页隐藏（播放页自己有返回键）
const showTabs = computed(() => route.name !== 'player')

onMounted(() => {
  // 读取 safe-area（非 iOS WebView 也兼容）
  try {
    const sty = getComputedStyle(document.documentElement)
    const v = parseInt((sty.getPropertyValue('--sat') || '').replace('px', ''), 10)
    if (v > 0) safeTop.value = v
  } catch {}
})

function onSearch() {
  if (!kw.value.trim()) return
  router.push({ name: 'search', query: { kw: kw.value, auto: 1 } })
}
function goSearch(word) {
  kw.value = word
  router.push({ name: 'search', query: { kw: word, auto: 1 } })
}
function onMore() {
  Snackbar('后续开放：下载 / 分享 / 音质选择')
}
</script>

<style scoped>
.app-root {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  background: var(--bg-app);
}

/* 顶部栏 56px + 安全区 */
.topbar {
  height: calc(56px + var(--safe-top));
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 16px;
  padding-top: calc(var(--safe-top) + 8px);
  background: linear-gradient(180deg, rgba(49, 194, 124, 0.16), transparent);
  border-bottom: 1px solid var(--line);
  gap: 12px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.logo-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--brand);
  box-shadow: var(--brand-glow);
}
.brand-text {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #fff;
}
.top-actions {
  display: flex;
  gap: 14px;
  align-items: center;
}
.top-title {
  flex: 1;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  padding: 0 8px;
}

/* 顶部搜索框（搜索页） */
.search-wrap {
  flex: 1;
  height: 36px;
  background: var(--bg-card);
  border-radius: 999px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--line);
}
.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-size: 14px;
  height: 100%;
}
.search-input::placeholder {
  color: var(--text-tertiary);
}

.app-content {
  flex: 1;
  min-height: 0;
  width: 100%;
  position: relative;
  padding: 0 14px 0 14px;
}

/* 底部 Tab 导航 */
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 56px; /* 迷你播放条在上面 */
  z-index: 30;
  height: 56px;
  display: flex;
  border-top: 1px solid var(--line);
  background: rgba(14, 20, 24, 0.96);
  backdrop-filter: blur(14px);
}
.has-mini-only .tabbar {
  bottom: 0;
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--text-tertiary);
  font-size: 11px;
}
.tab-item.active {
  color: var(--brand);
}
.tab-item.active :deep(svg) {
  filter: drop-shadow(0 0 6px rgba(49, 194, 124, 0.5));
}
</style>
