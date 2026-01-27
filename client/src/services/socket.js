// client/src/services/socket.js
import { io } from 'socket.io-client'
import { ref, reactive } from 'vue'

let socket = null

export const connected = ref(false)
export const messages = reactive([])
export const onlineUsers = reactive([])
export const typingUser = ref(null)
export const incomingCall = ref(null)

export function connectSocket(token) {
  if (socket) {
    socket.disconnect()
  }

  const url = import.meta.env.PROD ? window.location.origin : 'http://localhost:3000'

  socket = io(url, {
    auth: { token }
  })

  socket.on('connect', () => {
    connected.value = true
    console.log('Socket 已连接')
  })

  socket.on('disconnect', () => {
    connected.value = false
    console.log('Socket 已断开')
  })

  socket.on('message', (msg) => {
    messages.push(msg)
    // 播放提示音
    if (msg.senderId !== getCurrentUserId()) {
      playNotificationSound()
    }
  })

  socket.on('online-users', (users) => {
    onlineUsers.splice(0, onlineUsers.length, ...users)
  })

  socket.on('online', (user) => {
    if (!onlineUsers.find(u => u.userId === user.userId)) {
      onlineUsers.push(user)
    }
  })

  socket.on('offline', (user) => {
    const index = onlineUsers.findIndex(u => u.userId === user.userId)
    if (index > -1) {
      onlineUsers.splice(index, 1)
    }
  })

  socket.on('typing', ({ userId, nickname, isTyping }) => {
    typingUser.value = isTyping ? nickname : null
  })

  // WebRTC 信令事件
  socket.on('call-request', (data) => {
    incomingCall.value = data
  })

  socket.on('call-answer', (data) => {
    window.dispatchEvent(new CustomEvent('call-answer', { detail: data }))
  })

  socket.on('call-end', () => {
    window.dispatchEvent(new CustomEvent('call-end'))
  })

  socket.on('sdp-offer', (data) => {
    window.dispatchEvent(new CustomEvent('sdp-offer', { detail: data }))
  })

  socket.on('sdp-answer', (data) => {
    window.dispatchEvent(new CustomEvent('sdp-answer', { detail: data }))
  })

  socket.on('ice-candidate', (data) => {
    window.dispatchEvent(new CustomEvent('ice-candidate', { detail: data }))
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  messages.splice(0, messages.length)
  connected.value = false
}

export function sendMessage(type, content, duration = null) {
  if (socket) {
    socket.emit('message', { type, content, duration })
  }
}

export function sendTyping(isTyping) {
  if (socket) {
    socket.emit('typing', isTyping)
  }
}

export function sendCallRequest(type) {
  if (socket) {
    socket.emit('call-request', { type })
  }
}

export function sendCallAnswer(accepted) {
  if (socket) {
    socket.emit('call-answer', { accepted })
  }
  incomingCall.value = null
}

export function sendCallEnd() {
  if (socket) {
    socket.emit('call-end')
  }
}

export function sendSdpOffer(sdp) {
  if (socket) {
    socket.emit('sdp-offer', { sdp })
  }
}

export function sendSdpAnswer(sdp) {
  if (socket) {
    socket.emit('sdp-answer', { sdp })
  }
}

export function sendIceCandidate(candidate) {
  if (socket) {
    socket.emit('ice-candidate', { candidate })
  }
}

function getCurrentUserId() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}')
  return user.id
}

function playNotificationSound() {
  const audio = new Audio('/notification.mp3')
  audio.volume = 0.5
  audio.play().catch(() => {})
}
