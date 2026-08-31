<template>
  <div class="search-page">
    <!-- 音源 Tabs -->
    <div class="tabs-wrap">
      <var-tabs v-model:active="activeSource" line-width="40" elevation="0">
        <var-tab
          v-for="s in sources"
          :key="s.id"
          :name="s.id"
          @click="onSourceChange"
        >
          {{ s.short }}
        </var-tab>
      </var-tabs>
    </div>

    <!-- 加载/空状态 -->
    <div v-if="loading" class="state card">
      <var-icon name="loading" size="28" color="#31c27c" :transition="'rotate'" />
      <div class="state-text">{{ sourceLabel }} 搜索中...</div>
    </div>
    <div v-else-if="!keyword && list.length === 0" class="state card">
      <var-icon name="magnify-plus-outline" size="34" color="#6b7680" />
      <div class="state-text">输入关键词开始搜索</div>
      <div class="tips">支持 歌名 / 歌手名 / 专辑名</div>
    </div>
    <div v-else-if="!loading && list.length === 0 && keyword" class="state card">
      <var-icon name="file-not-found" size="34" color="#6b7680" />
      <div class="state-text">暂无搜索结果</div>
      <div class="tips">试试更换音源或换关键词</div>
    </div>

    <!-- 搜索结果 -->
    <div v-if="list.length" class="result-list">
      <div class="list-head">
        <span>共 {{ list.length }} 条 · {{ tookMs }}ms</span>
        <span class="link" @click="playAll">▶ 全部播放</span>
      </div>

      <div
        v-for="(it, i) in list"
        :key="i"
        class="song-item"
        :class="{ active: isCurrent(it) }"
        @click="playOne(it, i)"
      >
        <div class="idx">{{ i + 1 }}</div>
        <div class="item-meta">
          <div class="item-title ellipsis">
            {{ it.title }}
            <span v-if="it.vip" class="vip-tag">VIP</span>
          </div>
          <div class="item-sub ellipsis">
            {{ it.artist }}
            <template v-if="it.album"> · {{ it.album }}</template>
          </div>
        </div>
        <div class="item-actions">
          <var-icon
            v-if="isCurrent(it) && player.isPlaying"
            name="volume-high"
            size="18"
            color="#31c27c"
          />
          <var-icon
            v-else
            name="play-circle-outline"
            size="22"
            :color="isCurrent(it) ? '#31c27c' : '#a7b0b7'"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Snackbar, Dialog } from '@varlet/ui'
import {
  SOURCE_LABELS,
  SOURCE_LIST,
  search as srcSearch
} from '@shared/services/tripleSources'
import { usePlayerStore } from '@shared/stores/player'

const route = useRoute()
const player = usePlayerStore()

const activeSource = ref(SOURCE_LIST[0])
const keyword = ref('')
const list = ref([])
const loading = ref(false)
const tookMs = ref(0)

const sources = SOURCE_LIST.map((id) => ({
  id,
  label: SOURCE_LABELS[id],
  short: SOURCE_LABELS[id].split(' · ')[0] // "三方源X"
}))
const sourceLabel = computed(
  () => SOURCE_LABELS[activeSource.value] || activeSource.value
)

async function runSearch(kw = keyword.value, src = activeSource.value) {
  const k = String(kw).trim()
  if (!k) {
    list.value = []
    return
  }
  loading.value = true
  try {
    const r = await srcSearch({ keyword: k, source: src, page: 1 })
    list.value = r.list
    tookMs.value = r.tookMs || 0
  } catch (e) {
    console.error(e)
    Dialog({
      title: '搜索失败',
      message: String(e.message || e) + '\n\n提示：浏览器调试会走公共CORS代理，偶发不稳定；安装到手机后走原生HTTP请求更稳定。',
      confirmButtonText: '知道了'
    })
    list.value = []
  } finally {
    loading.value = false
  }
}

function onSourceChange() {
  if (keyword.value) runSearch()
}

function playOne(it, idx) {
  player.play(it, list.value, idx).catch((e) => {
    Snackbar.error(String(e.message || '播放失败'))
  })
}
function playAll() {
  if (!list.value.length) return
  playOne(list.value[0], 0)
  Snackbar('已加入播放队列：' + list.value.length + ' 首')
}

function isCurrent(it) {
  return (
    player.currentMeta?.sourceId === it.sourceId &&
    player.currentMeta?.onlineType === it.onlineType
  )
}

// 路由参数自动搜（首页入口触发）
watch(
  () => [route.query.kw, route.query.auto],
  ([kw, auto]) => {
    if (kw && String(kw).trim()) {
      keyword.value = String(kw).trim()
      if (auto) runSearch(keyword.value)
    }
  },
  { immediate: true }
)

// App.vue 顶部搜索框 v-model 绑定的是父组件的 kw；父组件改变 URL ?kw=xxx 后自动触发上面的watch，父子组件解耦。
// 我们还可以挂载一个全局事件让 App.vue 的搜索框回车时除了改 URL 还能在这里立即响应（路由变watch已经处理）。
onMounted(() => {
  if (route.query.kw && route.query.auto) {
    runSearch(String(route.query.kw))
  }
})
</script>

<style scoped>
.search-page {
  padding-top: 14px;
}
.tabs-wrap {
  margin-bottom: 14px;
  background: var(--bg-card);
  border-radius: 12px;
  border: 1px solid var(--line);
  padding: 4px 6px;
}

.state {
  padding: 36px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}
.state-text {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}
.tips {
  font-size: 12px;
  color: var(--text-tertiary);
}

.list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 6px 6px 10px;
}
.list-head .link {
  color: var(--brand);
  font-weight: 600;
}

.song-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 10px;
  border-radius: 12px;
  background: var(--bg-card);
  border: 1px solid var(--line);
  margin-bottom: 6px;
}
.song-item.active {
  border-color: rgba(49, 194, 124, 0.5);
  background: linear-gradient(
    90deg,
    rgba(49, 194, 124, 0.12),
    transparent 60%
  );
}
.idx {
  width: 22px;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
  flex-shrink: 0;
  font-weight: 600;
}
.item-meta {
  flex: 1;
  min-width: 0;
}
.item-title {
  font-size: 14px;
  color: #fff;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}
.vip-tag {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 193, 7, 0.15);
  color: #ffc107;
}
.item-sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 3px;
}
.item-actions {
  flex-shrink: 0;
  padding-left: 6px;
}
</style>
