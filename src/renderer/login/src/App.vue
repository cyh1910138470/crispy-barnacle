<template>
  <div class="login-page">
    <!-- 左侧品牌区 -->
    <aside class="brand-side">
      <div class="brand-content">
        <div class="logo">
          <svg viewBox="0 0 48 48" class="logo-icon">
            <circle cx="14" cy="36" r="6" fill="currentColor" />
            <circle cx="36" cy="32" r="6" fill="currentColor" />
            <path
              d="M20 36 L20 12 L42 8 L42 32"
              stroke="currentColor"
              stroke-width="2.5"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <h1 class="brand-name">MSC-TT</h1>
        <p class="brand-slogan">把你想听的，都装进一个播放器</p>
      </div>
    </aside>

    <!-- 右侧：启动画面 / 激活表单 -->
    <section class="form-side">
      <!-- 已激活：启动画面，2 秒后自动进入 -->
      <div v-if="mode === 'splash'" class="form-card splash">
        <div class="spinner"></div>
        <h2 class="title">正在启动</h2>
        <p class="subtitle">MSC-TT 准备中，请稍候…</p>
      </div>

      <!-- 激活成功，即将进入 -->
      <div v-else-if="mode === 'success'" class="form-card splash">
        <div class="success-icon">✓</div>
        <h2 class="title">激活成功</h2>
        <p class="subtitle">正在进入 MSC-TT…</p>
      </div>

      <!-- 未激活：激活表单 -->
      <div v-else class="form-card">
        <h2 class="title">激活 MSC-TT</h2>
        <p class="subtitle">首次使用需要激活。激活码与这台电脑绑定，转发软件给他人无法使用。</p>

        <label class="label">本机机器码</label>
        <div class="machine-row">
          <div class="machine-code">{{ machineCode || '读取中…' }}</div>
          <button class="copy-btn" :disabled="!machineCode" @click="copyMachineCode">
            {{ copied ? '已复制' : '复制' }}
          </button>
        </div>
        <p class="tip">把机器码发给作者，换取激活码后填入下方</p>

        <div class="field">
          <input
            v-model="code"
            class="input"
            placeholder="请输入激活码"
            @keyup.enter="handleActivate"
            :disabled="activating"
            ref="codeRef"
          />
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>

        <button class="submit-btn" :disabled="activating" @click="handleActivate">
          <span v-if="!activating">激活并进入</span>
          <span v-else>激活中…</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'

const mode = ref('checking') // checking | splash | success | activate
const machineCode = ref('')
const code = ref('')
const activating = ref(false)
const error = ref('')
const copied = ref(false)
const codeRef = ref(null)

onMounted(async () => {
  try {
    const st = await window.loginAPI.getLicenseStatus()
    machineCode.value = st.machineCode
    if (st.activated) {
      // 已授权：展示启动画面，2 秒后自动进入主界面
      mode.value = 'splash'
      setTimeout(enterApp, 2000)
    } else {
      mode.value = 'activate'
      nextTick(() => codeRef.value && codeRef.value.focus())
    }
  } catch (e) {
    mode.value = 'activate'
    error.value = '初始化失败：' + (e.message || e)
  }
})

async function enterApp() {
  const ok = await window.loginAPI.enterApp()
  if (!ok) {
    mode.value = 'activate'
    error.value = '进入失败，请重启应用重试'
  }
}

function copyMachineCode() {
  window.loginAPI.copyMachineCode(machineCode.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

async function handleActivate() {
  if (!code.value.trim()) {
    error.value = '请输入激活码'
    return
  }
  activating.value = true
  error.value = ''
  try {
    const res = await window.loginAPI.activate(code.value.trim())
    if (res.ok) {
      mode.value = 'success'
      setTimeout(enterApp, 900)
    } else {
      error.value = res.msg || '激活码无效'
    }
  } catch (e) {
    error.value = '激活失败：' + (e.message || e)
  } finally {
    activating.value = false
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  width: 100vw;
  height: 100vh;
  background: var(--bg-base);
  overflow: hidden;
}

/* 左侧品牌区 */
.brand-side {
  flex: 1;
  background:
    radial-gradient(circle at 30% 40%, rgba(33, 195, 122, 0.18), transparent 55%),
    linear-gradient(135deg, #1a3d2e 0%, #0d0d0d 60%, #000 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.brand-side::after {
  /* 装饰光斑 */
  content: '';
  position: absolute;
  bottom: -120px;
  right: -120px;
  width: 360px;
  height: 360px;
  background: radial-gradient(circle, rgba(33, 195, 122, 0.25), transparent 70%);
  filter: blur(40px);
}

.brand-content {
  text-align: center;
  color: var(--text-primary);
  z-index: 1;
}

.logo {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.logo-icon {
  width: 88px;
  height: 88px;
  color: var(--color-primary);
  filter: drop-shadow(0 0 24px rgba(33, 195, 122, 0.5));
  animation: float 4s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.brand-name {
  font-size: 52px;
  font-weight: 800;
  letter-spacing: 3px;
  margin-bottom: 14px;
  background: linear-gradient(135deg, var(--color-primary) 0%, #7eebb0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-slogan {
  color: var(--text-secondary);
  font-size: 15px;
  letter-spacing: 1px;
}

/* 右侧表单区 */
.form-side {
  width: 440px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-base);
  border-left: 1px solid var(--border-color);
}

.form-card {
  width: 320px;
}

/* 启动画面 */
.splash {
  text-align: center;
}

.spinner {
  width: 44px;
  height: 44px;
  margin: 0 auto 24px;
  border: 3px solid rgba(33, 195, 122, 0.2);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.success-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: #fff;
  font-size: 26px;
  font-weight: 700;
  border-radius: 50%;
  box-shadow: var(--shadow-glow);
}

.title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}

.subtitle {
  color: var(--text-secondary);
  margin-bottom: 32px;
  font-size: 13px;
  line-height: 1.6;
}

.label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.machine-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.machine-code {
  flex: 1;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border: 1px dashed var(--color-primary);
  background: rgba(33, 195, 122, 0.08);
  color: var(--color-primary);
  border-radius: var(--radius-md);
  font-family: Consolas, 'Courier New', monospace;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 2px;
  user-select: text;
}

.copy-btn {
  width: 72px;
  height: 44px;
  border: 1px solid var(--border-color);
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  font-size: 13px;
  transition: var(--transition);
}

.copy-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.copy-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tip {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 24px;
}

.field {
  margin-bottom: 16px;
}

.input {
  width: 100%;
  height: 44px;
  padding: 0 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  font-size: 14px;
  outline: none;
  transition: var(--transition);
}

.input::placeholder {
  color: var(--text-tertiary);
}

.input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.error-msg {
  color: #ff5a5a;
  font-size: 12px;
  margin-bottom: 12px;
  text-align: left;
}

.submit-btn {
  width: 100%;
  height: 44px;
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-md);
  font-size: 15px;
  font-weight: 600;
  transition: var(--transition);
}

.submit-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
  box-shadow: var(--shadow-glow);
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
