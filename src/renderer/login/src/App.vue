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

    <!-- 右侧表单区 -->
    <section class="form-side">
      <div class="form-card">
        <h2 class="title">欢迎回来</h2>
        <p class="subtitle">输入密码以进入 MSC-TT</p>

        <div class="field">
          <input
            v-model="password"
            type="password"
            class="input"
            placeholder="请输入密码"
            @keyup.enter="handleVerify"
            :disabled="loading"
            ref="pwdRef"
          />
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>

        <button class="submit-btn" :disabled="loading" @click="handleVerify">
          <span v-if="!loading">进入播放器</span>
          <span v-else>验证中…</span>
        </button>

        <button class="change-btn" @click="toggleChangeDialog">
          {{ showChangeDialog ? '收起修改面板' : '修改密码' }}
        </button>

        <!-- 修改密码面板 -->
        <transition name="slide">
          <div v-if="showChangeDialog" class="change-dialog">
            <h3>修改密码</h3>
            <input
              v-model="oldPassword"
              type="password"
              placeholder="原密码"
              class="input small"
            />
            <input
              v-model="newPassword"
              type="password"
              placeholder="新密码（至少 4 位）"
              class="input small"
            />
            <input
              v-model="confirmPassword"
              type="password"
              placeholder="确认新密码"
              class="input small"
            />
            <div v-if="changeMsg" :class="['msg', { ok: changeOk }]">{{ changeMsg }}</div>
            <div class="dialog-actions">
              <button @click="showChangeDialog = false">取消</button>
              <button @click="handleChange" :disabled="changing">
                {{ changing ? '提交中…' : '确认修改' }}
              </button>
            </div>
          </div>
        </transition>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'

const password = ref('')
const loading = ref(false)
const error = ref('')
const pwdRef = ref(null)

const showChangeDialog = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changing = ref(false)
const changeMsg = ref('')
const changeOk = ref(false)

onMounted(() => {
  nextTick(() => pwdRef.value && pwdRef.value.focus())
})

function toggleChangeDialog() {
  showChangeDialog.value = !showChangeDialog.value
  if (!showChangeDialog.value) {
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    changeMsg.value = ''
  }
}

async function handleVerify() {
  if (!password.value) {
    error.value = '请输入密码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const ok = await window.loginAPI.verify(password.value)
    if (!ok) {
      error.value = '密码错误，请重试'
      password.value = ''
      nextTick(() => pwdRef.value && pwdRef.value.focus())
    }
    // 成功时主进程会自动关闭本窗口并打开主窗口
  } catch (e) {
    error.value = '验证失败：' + (e.message || e)
  } finally {
    loading.value = false
  }
}

async function handleChange() {
  if (!oldPassword.value || !newPassword.value || !confirmPassword.value) {
    changeOk.value = false
    changeMsg.value = '请填写完整'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    changeOk.value = false
    changeMsg.value = '两次新密码不一致'
    return
  }
  if (newPassword.value.length < 4) {
    changeOk.value = false
    changeMsg.value = '新密码至少 4 位'
    return
  }
  changing.value = true
  changeMsg.value = ''
  try {
    const res = await window.loginAPI.changePassword(oldPassword.value, newPassword.value)
    if (res.ok) {
      changeOk.value = true
      changeMsg.value = '✓ 修改成功，下次启动用新密码'
      oldPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
      setTimeout(() => {
        showChangeDialog.value = false
        changeMsg.value = ''
      }, 1800)
    } else {
      changeOk.value = false
      changeMsg.value = res.msg
    }
  } catch (e) {
    changeOk.value = false
    changeMsg.value = '修改失败：' + (e.message || e)
  } finally {
    changing.value = false
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

.title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}

.subtitle {
  color: var(--text-secondary);
  margin-bottom: 32px;
  font-size: 13px;
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

.input.small {
  height: 36px;
  margin-bottom: 10px;
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

.change-btn {
  width: 100%;
  margin-top: 16px;
  padding: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  transition: var(--transition);
}

.change-btn:hover {
  color: var(--color-primary);
}

.change-dialog {
  margin-top: 16px;
  padding: 16px;
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.change-dialog h3 {
  font-size: 15px;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.change-dialog .msg {
  font-size: 12px;
  color: #ff5a5a;
  margin-top: 4px;
}

.change-dialog .msg.ok {
  color: var(--color-primary);
}

.dialog-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.dialog-actions button {
  flex: 1;
  height: 32px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--bg-hover);
  color: var(--text-primary);
  transition: var(--transition);
}

.dialog-actions button:last-child {
  background: var(--color-primary);
  color: #fff;
}

.dialog-actions button:hover:not(:disabled) {
  filter: brightness(1.15);
}

.dialog-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 折叠动画 */
.slide-enter-active,
.slide-leave-active {
  transition: var(--transition-slow);
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0 !important;
  padding-top: 0;
  padding-bottom: 0;
}

.slide-enter-to,
.slide-leave-from {
  max-height: 400px;
}
</style>
