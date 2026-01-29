<!-- client/src/views/Chat.vue -->
<template>
  <div class="chat-page">
    <!-- 顶部栏 -->
    <header class="chat-header">
      <div class="partner-info">
        <span class="partner-name">{{ partnerName }}</span>
        <span v-if="isPartnerOnline" class="online-dot"></span>
        <span v-if="typingUser" class="typing">正在输入...</span>
      </div>
      <div class="header-actions">
        <button class="icon-btn" @click="startCall('audio')" title="语音通话">📞</button>
        <button class="icon-btn" @click="startCall('video')" title="视频通话">📹</button>
      </div>
    </header>

    <!-- 消息列表 -->
    <main class="chat-messages" ref="messagesContainer">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message"
        :class="{ 'message-self': msg.senderId === currentUser.id }"
      >
        <div class="message-bubble">
          <!-- 文字消息 -->
          <template v-if="msg.type === 'text'">
            {{ msg.content }}
          </template>

          <!-- 图片消息 -->
          <template v-else-if="msg.type === 'image'">
            <img :src="msg.content" @click="previewImage(msg.content)" />
          </template>

          <!-- 语音消息 -->
          <template v-else-if="msg.type === 'audio'">
            <div class="audio-message" @click="playAudio(msg.content)">
              <span class="audio-icon">🔊</span>
              <span class="audio-duration">{{ msg.duration }}''</span>
            </div>
          </template>

          <!-- 视频消息 -->
          <template v-else-if="msg.type === 'video'">
            <video :src="msg.content" controls></video>
          </template>
        </div>
        <div class="message-time">{{ formatTime(msg.createdAt) }}</div>
      </div>
    </main>

    <!-- 输入栏 -->
    <footer class="chat-input">
      <div class="input-actions">
        <button class="icon-btn" @click="showFilePicker">📷</button>
        <button
          class="icon-btn"
          @mousedown="startRecording"
          @mouseup="stopRecording"
          @touchstart.prevent="startRecording"
          @touchend.prevent="stopRecording"
        >🎤</button>
      </div>
      <input
        v-model="inputText"
        type="text"
        placeholder="输入消息..."
        @keyup.enter="sendTextMessage"
        @input="handleTyping"
      />
      <button class="send-btn" @click="sendTextMessage" :disabled="!inputText.trim()">
        发送
      </button>
    </footer>

    <!-- 录音提示 -->
    <div v-if="isRecording" class="recording-overlay">
      <div class="recording-indicator">
        <span class="recording-dot"></span>
        <span>录音中... {{ recordingDuration }}s</span>
      </div>
    </div>

    <!-- 来电弹窗 -->
    <div v-if="incomingCall" class="call-modal">
      <div class="call-content">
        <p class="call-type">{{ incomingCall.type === 'video' ? '📹 视频通话' : '📞 语音通话' }}</p>
        <p class="caller-name">{{ incomingCall.from.nickname }}</p>
        <div class="call-actions">
          <button class="reject-btn" @click="rejectCall">拒绝</button>
          <button class="accept-btn" @click="acceptCall">接听</button>
        </div>
      </div>
    </div>

    <!-- 通话中界面 -->
    <div v-if="inCall" class="call-screen">
      <video v-if="callType === 'video'" ref="remoteVideo" class="remote-video" autoplay playsinline></video>
      <div v-else class="audio-call-display">
        <span class="call-avatar">📞</span>
        <span>{{ partnerName }}</span>
      </div>
      <video v-if="callType === 'video'" ref="localVideo" class="local-video" autoplay playsinline muted></video>
      <div class="call-info">{{ callDuration }}</div>
      <div class="call-controls">
        <button class="icon-btn" @click="toggleMute">{{ isMuted ? '🔇' : '🔊' }}</button>
        <button class="end-call-btn" @click="endCall">挂断</button>
        <button v-if="callType === 'video'" class="icon-btn" @click="toggleCamera">📷</button>
      </div>
    </div>

    <!-- 图片预览 -->
    <div v-if="previewImageUrl" class="image-preview" @click="previewImageUrl = null">
      <img :src="previewImageUrl" />
    </div>

    <!-- 隐藏的文件输入 -->
    <input type="file" ref="imageInput" accept="image/*,video/*" @change="handleFileSelect" style="display: none" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  connectSocket,
  disconnectSocket,
  sendMessage,
  sendTyping,
  sendCallRequest,
  sendCallAnswer,
  sendCallEnd,
  sendSdpOffer,
  sendSdpAnswer,
  sendIceCandidate,
  messages,
  onlineUsers,
  typingUser,
  incomingCall
} from '../services/socket'

const router = useRouter()

// 用户信息
const currentUser = ref(JSON.parse(sessionStorage.getItem('user') || '{}'))
const partner = ref(null)

// 消息输入
const inputText = ref('')
const messagesContainer = ref(null)

// 录音
const isRecording = ref(false)
const recordingDuration = ref(0)
let mediaRecorder = null
let audioChunks = []
let recordingTimer = null

// 通话
const inCall = ref(false)
const callType = ref('audio')
const callDuration = ref('00:00')
const isMuted = ref(false)
const localVideo = ref(null)
const remoteVideo = ref(null)
let peerConnection = null
let localStream = null
let callTimer = null

// 图片预览
const previewImageUrl = ref(null)

// 文件输入
const imageInput = ref(null)

// 计算属性
const partnerName = computed(() => partner.value?.nickname || '等待对方加入...')
const isPartnerOnline = computed(() => {
  return partner.value && onlineUsers.some(u => u.userId === partner.value.id)
})

// 获取用户信息
onMounted(async () => {
  const token = sessionStorage.getItem('token')
  if (!token) {
    router.push('/')
    return
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()

    if (!res.ok) {
      sessionStorage.clear()
      router.push('/')
      return
    }

    currentUser.value = data.user
    partner.value = data.partner

    // 连接 Socket
    connectSocket(token)
  } catch (err) {
    console.error('获取用户信息失败', err)
  }
})

onUnmounted(() => {
  disconnectSocket()
  if (peerConnection) {
    peerConnection.close()
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop())
  }
})

// 自动滚动到底部
watch(messages, () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}, { deep: true })

// 发送文字消息
function sendTextMessage() {
  const text = inputText.value.trim()
  if (!text) return

  sendMessage('text', text)
  inputText.value = ''
  sendTyping(false)
}

// 输入提示
let typingTimeout = null
function handleTyping() {
  sendTyping(true)
  clearTimeout(typingTimeout)
  typingTimeout = setTimeout(() => {
    sendTyping(false)
  }, 1000)
}

// 文件选择（图片/视频）
function showFilePicker() {
  imageInput.value?.click()
}

async function handleFileSelect(e) {
  const file = e.target.files[0]
  if (!file) return

  const type = file.type.startsWith('video/') ? 'video' : 'image'
  await uploadAndSend(file, type)
  e.target.value = ''
}

// 上传文件
async function uploadAndSend(file, type) {
  const token = sessionStorage.getItem('token')
  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    })

    const data = await res.json()
    if (res.ok) {
      sendMessage(type, data.url)
    }
  } catch (err) {
    console.error('上传失败', err)
  }
}

// 录音功能
async function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('当前环境不支持录音功能，请使用 HTTPS 访问')
    return
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(stream)
    audioChunks = []

    mediaRecorder.ondataavailable = (e) => {
      audioChunks.push(e.data)
    }

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
      const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' })

      const token = sessionStorage.getItem('token')
      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        })

        const data = await res.json()
        if (res.ok) {
          sendMessage('audio', data.url, recordingDuration.value)
        }
      } catch (err) {
        console.error('上传语音失败', err)
      }

      stream.getTracks().forEach(track => track.stop())
    }

    mediaRecorder.start()
    isRecording.value = true
    recordingDuration.value = 0
    recordingTimer = setInterval(() => {
      recordingDuration.value++
    }, 1000)
  } catch (err) {
    console.error('无法获取麦克风权限', err)
  }
}

function stopRecording() {
  if (mediaRecorder && isRecording.value) {
    mediaRecorder.stop()
    isRecording.value = false
    clearInterval(recordingTimer)
  }
}

// 播放语音
function playAudio(url) {
  const audio = new Audio(url)
  audio.play()
}

// 图片预览
function previewImage(url) {
  previewImageUrl.value = url
}

// 格式化时间
function formatTime(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// ========== WebRTC 通话功能 ==========

async function startCall(type) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('当前环境不支持通话功能，请使用 HTTPS 访问')
    return
  }
  callType.value = type
  sendCallRequest(type)
  await setupPeerConnection(true)
}

function acceptCall() {
  callType.value = incomingCall.value.type
  sendCallAnswer(true)
  setupPeerConnection(false)
}

function rejectCall() {
  sendCallAnswer(false)
}

async function setupPeerConnection(isInitiator) {
  inCall.value = true

  // 获取本地媒体流
  const constraints = {
    audio: true,
    video: callType.value === 'video'
  }

  try {
    localStream = await navigator.mediaDevices.getUserMedia(constraints)

    if (callType.value === 'video' && localVideo.value) {
      localVideo.value.srcObject = localStream
    }
  } catch (err) {
    console.error('获取媒体流失败', err)
    endCall()
    return
  }

  // 创建 RTCPeerConnection
  peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  })

  // 添加本地流
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream)
  })

  // 处理远程流
  peerConnection.ontrack = (event) => {
    if (callType.value === 'video' && remoteVideo.value) {
      remoteVideo.value.srcObject = event.streams[0]
    } else {
      const audio = new Audio()
      audio.srcObject = event.streams[0]
      audio.play()
    }
  }

  // ICE candidate
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendIceCandidate(event.candidate)
    }
  }

  // 如果是发起方，创建 offer
  if (isInitiator) {
    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)
    sendSdpOffer(offer)
  }

  // 启动通话计时
  let seconds = 0
  callTimer = setInterval(() => {
    seconds++
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0')
    const secs = (seconds % 60).toString().padStart(2, '0')
    callDuration.value = `${mins}:${secs}`
  }, 1000)
}

function endCall() {
  sendCallEnd()
  cleanupCall()
}

function cleanupCall() {
  inCall.value = false

  if (peerConnection) {
    peerConnection.close()
    peerConnection = null
  }

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop())
    localStream = null
  }

  if (callTimer) {
    clearInterval(callTimer)
    callTimer = null
  }

  callDuration.value = '00:00'
}

function toggleMute() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      isMuted.value = !audioTrack.enabled
    }
  }
}

function toggleCamera() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
    }
  }
}

// WebRTC 信令事件监听
onMounted(() => {
  window.addEventListener('call-answer', async (e) => {
    if (e.detail.accepted) {
      // 对方接听，等待 answer
    } else {
      cleanupCall()
    }
  })

  window.addEventListener('call-end', () => {
    cleanupCall()
  })

  window.addEventListener('sdp-offer', async (e) => {
    if (!peerConnection) return
    await peerConnection.setRemoteDescription(new RTCSessionDescription(e.detail.sdp))
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)
    sendSdpAnswer(answer)
  })

  window.addEventListener('sdp-answer', async (e) => {
    if (!peerConnection) return
    await peerConnection.setRemoteDescription(new RTCSessionDescription(e.detail.sdp))
  })

  window.addEventListener('ice-candidate', async (e) => {
    if (!peerConnection) return
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(e.detail.candidate))
    } catch (err) {
      console.error('添加 ICE candidate 失败', err)
    }
  })
})
</script>

<style scoped>
.chat-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--chat-bg);
}

/* 顶部栏 */
.chat-header {
  background: var(--primary-color);
  color: white;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.partner-name {
  font-size: 18px;
  font-weight: 500;
}

.online-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #2ecc71;
  border-radius: 50%;
  margin-left: 8px;
}

.typing {
  font-size: 12px;
  margin-left: 8px;
  opacity: 0.8;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.icon-btn {
  background: transparent;
  padding: 8px;
  font-size: 20px;
}

/* 消息列表 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.message {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.message-self {
  align-items: flex-end;
}

.message-bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 18px;
  background: var(--bubble-other);
  word-break: break-word;
}

.message-self .message-bubble {
  background: var(--bubble-self);
}

.message-bubble img {
  max-width: 200px;
  border-radius: 8px;
  cursor: pointer;
}

.message-bubble video {
  max-width: 200px;
  border-radius: 8px;
}

.audio-message {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  min-width: 80px;
}

.message-time {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* 输入栏 */
.chat-input {
  background: white;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--border-color);
}

.input-actions {
  display: flex;
  gap: 4px;
}

.chat-input input {
  flex: 1;
  border: none;
  padding: 10px;
  background: var(--bg-color);
  border-radius: 20px;
}

.send-btn {
  padding: 8px 16px;
  border-radius: 20px;
}

/* 录音提示 */
.recording-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.recording-indicator {
  background: white;
  padding: 20px 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.recording-dot {
  width: 12px;
  height: 12px;
  background: red;
  border-radius: 50%;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 来电弹窗 */
.call-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
}

.call-content {
  background: white;
  padding: 30px;
  border-radius: 16px;
  text-align: center;
}

.call-type {
  font-size: 24px;
  margin-bottom: 8px;
}

.caller-name {
  font-size: 20px;
  margin-bottom: 24px;
}

.call-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.reject-btn {
  background: #e74c3c;
  padding: 12px 24px;
  border-radius: 50px;
}

.accept-btn {
  background: #2ecc71;
  padding: 12px 24px;
  border-radius: 50px;
}

/* 通话中界面 */
.call-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #1a1a1a;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.remote-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.local-video {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 120px;
  height: 160px;
  border-radius: 8px;
  object-fit: cover;
}

.audio-call-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: white;
  font-size: 24px;
}

.call-avatar {
  font-size: 64px;
}

.call-info {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: white;
  font-size: 18px;
}

.call-controls {
  position: absolute;
  bottom: 40px;
  display: flex;
  gap: 20px;
}

.call-controls .icon-btn {
  background: rgba(255, 255, 255, 0.2);
  width: 50px;
  height: 50px;
  border-radius: 50%;
}

.end-call-btn {
  background: #e74c3c;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  font-size: 14px;
}

/* 图片预览 */
.image-preview {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.image-preview img {
  max-width: 90%;
  max-height: 90%;
}
</style>
