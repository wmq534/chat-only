<!-- client/src/views/Login.vue -->
<template>
  <div class="login-page">
    <div class="login-container">
      <div class="logo">🔐</div>
      <h1>网络登录器</h1>

      <div v-if="loading" class="loading">加载中...</div>

      <template v-else>
        <!-- 已有用户，显示登录 -->
        <template v-if="hasUsers">
          <p class="hint">请输入序列号</p>
          <input
            v-model="password"
            type="password"
            maxlength="6"
            inputmode="numeric"
            pattern="[0-9]*"
            placeholder="6位数字序列号"
            @keyup.enter="handleLogin"
          />
          <p v-if="error" class="error">{{ error }}</p>
          <button @click="handleLogin" :disabled="submitting">
            {{ submitting ? '验证中...' : '确 认' }}
          </button>
        </template>

        <!-- 无用户，引导设置 -->
        <template v-else>
          <p class="hint">首次使用，请先设置</p>
          <button @click="goToSetup">开始设置</button>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(true)
const hasUsers = ref(false)
const password = ref('')
const error = ref('')
const submitting = ref(false)

onMounted(async () => {
  try {
    const res = await fetch('/api/auth/invite-status')
    const data = await res.json()
    hasUsers.value = data.userCount > 0
  } catch (err) {
    console.error('检查状态失败', err)
  } finally {
    loading.value = false
  }
})

async function handleLogin() {
  if (!password.value || password.value.length !== 6) {
    error.value = '请输入6位序列号'
    return
  }

  error.value = ''
  submitting.value = true

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value })
    })

    const data = await res.json()

    if (!res.ok) {
      error.value = data.error || '登录失败'
      return
    }

    // 保存到 sessionStorage（关闭标签页即清除）
    sessionStorage.setItem('token', data.token)
    sessionStorage.setItem('user', JSON.stringify(data.user))

    router.push('/chat')
  } catch (err) {
    error.value = '网络错误'
  } finally {
    submitting.value = false
  }
}

function goToSetup() {
  router.push('/setup')
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-container {
  background: white;
  padding: 40px 30px;
  border-radius: 16px;
  text-align: center;
  width: 100%;
  max-width: 350px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.logo {
  font-size: 48px;
  margin-bottom: 16px;
}

h1 {
  font-size: 24px;
  margin-bottom: 24px;
  color: var(--text-color);
}

.hint {
  color: var(--text-secondary);
  margin-bottom: 16px;
}

input {
  margin-bottom: 16px;
  text-align: center;
  letter-spacing: 8px;
  font-size: 20px;
}

.error {
  color: #e74c3c;
  font-size: 14px;
  margin-bottom: 16px;
}

button {
  width: 100%;
}

.loading {
  color: var(--text-secondary);
  padding: 20px;
}
</style>
