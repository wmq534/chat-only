<!-- client/src/views/Setup.vue -->
<template>
  <div class="setup-page">
    <div class="setup-container">
      <div class="logo">🔐</div>
      <h1>{{ isInvited ? '受邀加入' : '首次设置' }}</h1>

      <div class="form-group">
        <label>你的昵称</label>
        <input
          v-model="nickname"
          type="text"
          maxlength="20"
          placeholder="输入昵称"
        />
      </div>

      <div class="form-group">
        <label>设置6位序列号</label>
        <input
          v-model="password"
          type="password"
          maxlength="6"
          inputmode="numeric"
          pattern="[0-9]*"
          placeholder="6位数字"
        />
      </div>

      <div class="form-group">
        <label>确认序列号</label>
        <input
          v-model="confirmPassword"
          type="password"
          maxlength="6"
          inputmode="numeric"
          pattern="[0-9]*"
          placeholder="再次输入"
        />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button @click="handleSetup" :disabled="submitting">
        {{ submitting ? '创建中...' : '确认创建' }}
      </button>

      <!-- 成功后显示邀请链接 -->
      <div v-if="showInvite" class="invite-section">
        <p class="success">创建成功！</p>
        <p>发送以下链接给对方：</p>
        <div class="invite-link">{{ inviteLink }}</div>
        <button @click="copyLink" class="copy-btn">
          {{ copied ? '已复制' : '复制链接' }}
        </button>
        <button @click="goToChat" class="chat-btn">进入聊天</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const nickname = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const submitting = ref(false)
const showInvite = ref(false)
const copied = ref(false)

const isInvited = computed(() => route.query.invite === 'true')

const inviteLink = computed(() => {
  return `${window.location.origin}/setup?invite=true`
})

onMounted(async () => {
  // 检查是否还能注册
  try {
    const res = await fetch('/api/auth/invite-status')
    const data = await res.json()
    if (!data.canInvite) {
      error.value = '用户数量已达上限'
    }
  } catch (err) {
    console.error('检查状态失败', err)
  }
})

async function handleSetup() {
  // 验证
  if (!nickname.value.trim()) {
    error.value = '请输入昵称'
    return
  }

  if (password.value.length !== 6 || !/^\d+$/.test(password.value)) {
    error.value = '序列号必须是6位数字'
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = '两次输入的序列号不一致'
    return
  }

  error.value = ''
  submitting.value = true

  try {
    const res = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: nickname.value.trim(),
        password: password.value
      })
    })

    const data = await res.json()

    if (!res.ok) {
      error.value = data.error || '创建失败'
      return
    }

    // 保存登录状态
    sessionStorage.setItem('token', data.token)
    sessionStorage.setItem('user', JSON.stringify(data.user))

    // 如果是受邀用户，直接进入聊天
    if (isInvited.value) {
      router.push('/chat')
    } else {
      // 第一个用户，显示邀请链接
      showInvite.value = true
    }
  } catch (err) {
    error.value = '网络错误'
  } finally {
    submitting.value = false
  }
}

function copyLink() {
  navigator.clipboard.writeText(inviteLink.value)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function goToChat() {
  router.push('/chat')
}
</script>

<style scoped>
.setup-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.setup-container {
  background: white;
  padding: 40px 30px;
  border-radius: 16px;
  width: 100%;
  max-width: 350px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.logo {
  font-size: 48px;
  text-align: center;
  margin-bottom: 16px;
}

h1 {
  font-size: 24px;
  margin-bottom: 24px;
  text-align: center;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-secondary);
  font-size: 14px;
}

.error {
  color: #e74c3c;
  font-size: 14px;
  margin-bottom: 16px;
  text-align: center;
}

button {
  width: 100%;
  margin-top: 8px;
}

.invite-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
  text-align: center;
}

.success {
  color: var(--primary-color);
  font-size: 18px;
  margin-bottom: 16px;
}

.invite-link {
  background: var(--bg-color);
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
  word-break: break-all;
  margin: 12px 0;
}

.copy-btn {
  background: #3498db;
}

.chat-btn {
  margin-top: 12px;
}
</style>
