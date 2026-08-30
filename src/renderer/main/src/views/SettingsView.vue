<!-- 设置页：通用行为 + 缓存管理 + 关于 -->
<template>
  <div class="settings-page">
    <h1 class="page-title">设置</h1>

    <!-- 通用 -->
    <section class="set-section">
      <div class="sec-title">通用</div>
      <div class="card">
        <div class="set-row">
          <div class="set-info">
            <div class="set-name">开机自启动</div>
            <div class="set-desc">登录 Windows 后自动在后台启动 MSC-TT</div>
          </div>
          <label class="switch">
            <input type="checkbox" :checked="info.openAtLogin" @change="toggleAutoLogin($event)" />
            <span class="slider"></span>
          </label>
        </div>

        <div class="set-row">
          <div class="set-info">
            <div class="set-name">点击关闭按钮时</div>
            <div class="set-desc">最小化到托盘可以继续听歌，托盘右键可完全退出</div>
          </div>
          <div class="seg">
            <button :class="{ active: info.closeAction === 'tray' }" @click="setCloseAction('tray')">
              最小化到托盘
            </button>
            <button :class="{ active: info.closeAction === 'exit' }" @click="setCloseAction('exit')">
              直接退出
            </button>
          </div>
        </div>

        <div class="set-row">
          <div class="set-info">
            <div class="set-name">听歌时防止系统休眠</div>
            <div class="set-desc">开启后应用运行期间屏幕不会自动熄灭</div>
          </div>
          <label class="switch">
            <input type="checkbox" :checked="info.preventSleep" @change="togglePreventSleep($event)" />
            <span class="slider"></span>
          </label>
        </div>

        <div class="set-row">
          <div class="set-info">
            <div class="set-name">睡眠定时器</div>
            <div class="set-desc">{{ sleepDescText }}</div>
          </div>
          <div class="seg">
            <button
              v-for="m in SLEEP_OPTIONS"
              :key="m"
              :class="{ active: m === 0 ? selectedMins === 0 : selectedMins === m }"
              @click="onSetSleepTimer(m)"
            >
              {{ m === 0 ? '关闭' : m + ' 分钟' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 缓存 -->
    <section class="set-section">
      <div class="sec-title">缓存管理</div>
      <div class="card">
        <div class="set-row">
          <div class="set-info">
            <div class="set-name">在线歌曲缓存</div>
            <div class="set-desc">听过的在线歌曲会临时缓存，清空后下次播放会重新下载</div>
          </div>
          <div class="cache-act">
            <span class="cache-size">{{ fmtSize(info.musicCacheSize) }}</span>
            <button class="mini-btn" @click="openDir('music')">打开</button>
            <button class="mini-btn danger" @click="clearCache">清空</button>
          </div>
        </div>

        <div class="set-row">
          <div class="set-info">
            <div class="set-name">封面缓存</div>
            <div class="set-desc">专辑封面图片缓存，清空后会按需自动重新拉取</div>
          </div>
          <div class="cache-act">
            <span class="cache-size">{{ fmtSize(info.coverCacheSize) }}</span>
            <button class="mini-btn" @click="openDir('cover')">打开</button>
          </div>
        </div>

        <div class="set-row">
          <div class="set-info">
            <div class="set-name">数据文件夹</div>
            <div class="set-desc" :title="info.userDataPath">{{ info.userDataPath }}</div>
          </div>
          <button class="mini-btn" @click="openDir('userData')">打开</button>
        </div>
      </div>
    </section>

    <!-- 关于 -->
    <section class="set-section">
      <div class="sec-title">关于</div>
      <div class="card">
        <div class="set-row">
          <div class="set-info">
            <div class="set-name">MSC-TT</div>
            <div class="set-desc">桌面音乐播放器 · 支持本地音乐与在线试听</div>
          </div>
          <span class="ver-chip">v{{ info.version }}</span>
        </div>
        <div class="set-row">
          <div class="set-info">
            <div class="set-name">授权状态</div>
            <div class="set-desc">
              {{ info.activated ? '已激活 · 本机已授权' : '未激活' }}
              <template v-if="info.machineCode">
                <br />机器码：{{ info.machineCode }}
              </template>
            </div>
          </div>
          <span class="state-chip" :class="{ ok: info.activated }">
            {{ info.activated ? '已激活' : '未激活' }}
          </span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue'
import { appConfirm } from '../utils/confirm'
import { usePlayerStore } from '../stores/player'
import { SLEEP_OPTIONS, selectedMins, sleepDescText, setSleepTimer } from '../composables/useSleepTimer'

const player = usePlayerStore()

const info = reactive({
  version: '',
  activated: false,
  machineCode: '',
  openAtLogin: false,
  closeAction: 'tray',
  preventSleep: true,
  userDataPath: '',
  musicCacheSize: 0,
  coverCacheSize: 0
})

onMounted(async () => {
  try {
    const s = await window.mscAPI.getSettings()
    Object.assign(info, s)
  } catch (e) {
    console.warn('[settings] 读取失败:', e)
  }
})

function toast(text, type = 'info') {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { text, type } }))
}

async function toggleAutoLogin(e) {
  const enabled = e.target.checked
  const r = await window.mscAPI.setOpenAtLogin(enabled)
  if (!r?.ok) {
    e.target.checked = !enabled
    toast('设置开机自启动失败：' + (r?.error || '未知错误'), 'error')
    return
  }
  toast(enabled ? '已开启开机自启动' : '已关闭开机自启动', 'success')
}

async function setCloseAction(action) {
  info.closeAction = action
  await window.mscAPI.setCloseAction(action)
  toast(action === 'tray' ? '关闭按钮将最小化到托盘' : '关闭按钮将直接退出应用', 'success')
}

async function togglePreventSleep(e) {
  const enabled = e.target.checked
  info.preventSleep = enabled
  try {
    await window.mscAPI.setPowerSave(enabled)
    toast(enabled ? '播放时将阻止系统休眠' : '已允许播放时休眠', 'success')
  } catch {
    e.target.checked = !enabled
    info.preventSleep = !enabled
  }
}

function onSetSleepTimer(mins) {
  setSleepTimer(mins, player)
  if (!mins) {
    toast('已关闭睡眠定时器', 'info')
  } else {
    toast(`睡眠定时器已开启：${mins} 分钟后停止播放`, 'success')
  }
}

async function openDir(which) {
  await window.mscAPI.openAppDir(which)
}

async function clearCache() {
  const ok = await appConfirm(
    '确定清空在线歌曲缓存吗？清空后播放过的在线歌曲会在下次播放时自动重新下载。',
    { title: '清空在线缓存', okText: '清空', danger: true }
  )
  if (!ok) return
  const r = await window.mscAPI.clearOnlineCache()
  if (r?.ok) {
    info.musicCacheSize = 0
    toast(`已清空 ${r.count} 个缓存文件，释放 ${fmtSize(r.freed)}`, 'success')
  } else {
    toast('清空失败：' + (r?.error || '未知错误'), 'error')
  }
}

function fmtSize(bytes) {
  const b = Number(bytes) || 0
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB'
  return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}
</script>

<style scoped>
.settings-page {
  padding: 24px 32px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  color: #e8e8e8;
}
.page-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 20px;
}
.set-section {
  margin-bottom: 26px;
}
.sec-title {
  font-size: 14px;
  font-weight: 700;
  color: #9a9a9a;
  margin-bottom: 10px;
}
.card {
  background: #1c1c1c;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 4px 18px;
}
.set-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 14px 0;
}
.set-row + .set-row {
  border-top: 1px solid #262626;
}
.set-info {
  min-width: 0;
  flex: 1;
}
.set-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}
.set-desc {
  font-size: 12px;
  color: #8a8a8a;
  line-height: 1.6;
  word-break: break-all;
}

/* 开关 */
.switch {
  position: relative;
  flex: none;
  width: 42px;
  height: 24px;
  cursor: pointer;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  inset: 0;
  background: #3a3a3a;
  border-radius: 12px;
  transition: background 0.2s;
}
.slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  top: 3px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}
.switch input:checked + .slider {
  background: var(--accent);
}
.switch input:checked + .slider::before {
  transform: translateX(18px);
}

/* 分段选择 */
.seg {
  flex: none;
  display: flex;
  background: #232323;
  border: 1px solid #333;
  border-radius: 18px;
  padding: 3px;
}
.seg button {
  border: none;
  background: transparent;
  color: #9a9a9a;
  font-size: 12px;
  border-radius: 15px;
  padding: 5px 14px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.seg button.active {
  background: var(--accent);
  color: #06140c;
  font-weight: 600;
}

/* 缓存行 */
.cache-act {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
}
.cache-size {
  font-size: 13px;
  color: var(--accent);
  font-weight: 600;
  min-width: 64px;
  text-align: right;
}
.mini-btn {
  border: 1px solid #3a3a3a;
  background: transparent;
  color: #c8c8c8;
  font-size: 12px;
  border-radius: 14px;
  padding: 4px 14px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.mini-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.mini-btn.danger:hover {
  border-color: #ff6b6b;
  color: #ff6b6b;
}

/* 关于 */
.ver-chip {
  flex: none;
  font-size: 12px;
  color: #9a9a9a;
  border: 1px solid #3a3a3a;
  border-radius: 12px;
  padding: 3px 12px;
}
.state-chip {
  flex: none;
  font-size: 12px;
  color: #9a9a9a;
  border: 1px solid #3a3a3a;
  border-radius: 12px;
  padding: 3px 12px;
}
.state-chip.ok {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.5);
  background: rgba(var(--accent-rgb), 0.08);
}
</style>
