import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/home' },
  {
    path: '/home',
    name: 'home',
    component: () => import('@/views/Home.vue'),
    meta: { title: '首页', keepAlive: true }
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('@/views/Search.vue'),
    meta: { title: '搜索', keepAlive: true }
  },
  {
    path: '/player',
    name: 'player',
    component: () => import('@/views/Player.vue'),
    meta: { title: '播放' }
  },
  {
    path: '/mine',
    name: 'mine',
    component: () => import('@/views/Mine.vue'),
    meta: { title: '我的' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

export default router
