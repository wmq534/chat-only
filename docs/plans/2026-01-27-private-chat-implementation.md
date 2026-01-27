# 私人聊天应用实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个两人专用的私人聊天 PWA 应用，支持文字、语音、图片、视频消息及实时通话。

**Architecture:** 前后端分离，Vue 3 + Vite 构建 PWA 前端，Node.js + Express + Socket.io 后端，SQLite 存储数据，WebRTC 实现实时通话。

**Tech Stack:** Vue 3, Vite, Socket.io, Express, SQLite, WebRTC, Nginx

---

## Phase 1: 项目初始化

### Task 1: 创建项目目录结构

**Files:**
- Create: `client/package.json`
- Create: `server/package.json`
- Create: `.gitignore`

**Step 1: 初始化 Git 仓库**

```bash
git init
```

**Step 2: 创建 .gitignore**

```
node_modules/
dist/
.env
*.log
server/data/
.DS_Store
```

**Step 3: 创建 client 目录并初始化 Vue 项目**

```bash
npm create vite@latest client -- --template vue
```

**Step 4: 创建 server 目录结构**

```bash
mkdir -p server/{routes,socket,db,data/files/{images,audio,video}}
```

**Step 5: 初始化 server/package.json**

```bash
cd server && npm init -y
```

**Step 6: Commit**

```bash
git add .
git commit -m "chore: initialize project structure"
```

---

### Task 2: 安装后端依赖

**Files:**
- Modify: `server/package.json`

**Step 1: 安装后端核心依赖**

```bash
cd server && npm install express socket.io cors better-sqlite3 bcryptjs jsonwebtoken multer uuid
```

**Step 2: 安装开发依赖**

```bash
cd server && npm install -D nodemon
```

**Step 3: 更新 package.json scripts**

修改 `server/package.json`，添加 scripts：

```json
{
  "scripts": {
    "dev": "nodemon index.js",
    "start": "node index.js"
  }
}
```

**Step 4: Commit**

```bash
git add server/package.json server/package-lock.json
git commit -m "chore: add server dependencies"
```

---

### Task 3: 安装前端依赖

**Files:**
- Modify: `client/package.json`

**Step 1: 安装前端核心依赖**

```bash
cd client && npm install socket.io-client vue-router
```

**Step 2: 安装 PWA 插件**

```bash
cd client && npm install -D vite-plugin-pwa
```

**Step 3: Commit**

```bash
git add client/package.json client/package-lock.json
git commit -m "chore: add client dependencies"
```

---

## Phase 2: 后端核心功能

### Task 4: 创建数据库模块

**Files:**
- Create: `server/db/database.js`

**Step 1: 创建数据库初始化文件**

```javascript
// server/db/database.js
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/app.db');
const db = new Database(dbPath);

// 初始化表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    duration INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id)
  );
`);

// 用户相关操作
const userQueries = {
  count: db.prepare('SELECT COUNT(*) as count FROM users'),
  findByNickname: db.prepare('SELECT * FROM users WHERE nickname = ?'),
  findById: db.prepare('SELECT * FROM users WHERE id = ?'),
  create: db.prepare('INSERT INTO users (nickname, password_hash) VALUES (?, ?)'),
  getAll: db.prepare('SELECT id, nickname, created_at FROM users')
};

// 消息相关操作
const messageQueries = {
  create: db.prepare('INSERT INTO messages (sender_id, type, content, duration) VALUES (?, ?, ?, ?)'),
  getAll: db.prepare('SELECT m.*, u.nickname as sender_name FROM messages m JOIN users u ON m.sender_id = u.id ORDER BY m.created_at ASC'),
  deleteAll: db.prepare('DELETE FROM messages')
};

module.exports = {
  db,
  userQueries,
  messageQueries
};
```

**Step 2: 运行测试确认数据库可以初始化**

```bash
cd server && node -e "require('./db/database.js'); console.log('DB OK')"
```

Expected: 输出 "DB OK"，并在 server/data/ 下生成 app.db

**Step 3: Commit**

```bash
git add server/db/database.js
git commit -m "feat: add SQLite database module"
```

---

### Task 5: 创建配置文件

**Files:**
- Create: `server/config.js`

**Step 1: 创建配置文件**

```javascript
// server/config.js
module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  maxUsers: 2,
  uploadDir: './data/files',
  maxFileSize: 50 * 1024 * 1024 // 50MB
};
```

**Step 2: Commit**

```bash
git add server/config.js
git commit -m "feat: add server config"
```

---

### Task 6: 创建认证路由

**Files:**
- Create: `server/routes/auth.js`

**Step 1: 创建认证路由**

```javascript
// server/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { userQueries } = require('../db/database');
const config = require('../config');

const router = express.Router();

// 检查是否可以注册（用户数 < 2）
router.get('/invite-status', (req, res) => {
  const result = userQueries.count.get();
  res.json({
    canInvite: result.count < config.maxUsers,
    userCount: result.count
  });
});

// 首次注册
router.post('/setup', (req, res) => {
  const { nickname, password } = req.body;

  // 验证输入
  if (!nickname || !password) {
    return res.status(400).json({ error: '昵称和序列号不能为空' });
  }

  if (password.length !== 6 || !/^\d+$/.test(password)) {
    return res.status(400).json({ error: '序列号必须是6位数字' });
  }

  // 检查用户数量
  const countResult = userQueries.count.get();
  if (countResult.count >= config.maxUsers) {
    return res.status(400).json({ error: '用户数量已达上限' });
  }

  // 检查昵称是否已存在
  const existingUser = userQueries.findByNickname.get(nickname);
  if (existingUser) {
    return res.status(400).json({ error: '昵称已被使用' });
  }

  // 创建用户
  const passwordHash = bcrypt.hashSync(password, 10);
  const result = userQueries.create.run(nickname, passwordHash);

  // 生成 token
  const token = jwt.sign(
    { userId: result.lastInsertRowid, nickname },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    token,
    user: {
      id: result.lastInsertRowid,
      nickname
    }
  });
});

// 登录
router.post('/login', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: '请输入序列号' });
  }

  // 遍历所有用户检查密码
  const users = userQueries.getAll.all();

  for (const user of users) {
    const fullUser = userQueries.findById.get(user.id);
    if (bcrypt.compareSync(password, fullUser.password_hash)) {
      const token = jwt.sign(
        { userId: user.id, nickname: user.nickname },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          nickname: user.nickname
        }
      });
    }
  }

  res.status(401).json({ error: '序列号错误' });
});

// 获取当前用户信息
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: '未登录' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = userQueries.findById.get(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }

    // 获取对方用户信息
    const allUsers = userQueries.getAll.all();
    const otherUser = allUsers.find(u => u.id !== user.id);

    res.json({
      user: {
        id: user.id,
        nickname: user.nickname
      },
      partner: otherUser ? {
        id: otherUser.id,
        nickname: otherUser.nickname
      } : null
    });
  } catch (err) {
    res.status(401).json({ error: 'Token 无效' });
  }
});

module.exports = router;
```

**Step 2: Commit**

```bash
git add server/routes/auth.js
git commit -m "feat: add authentication routes"
```

---

### Task 7: 创建文件上传路由

**Files:**
- Create: `server/routes/upload.js`

**Step 1: 创建上传路由**

```javascript
// server/routes/upload.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const config = require('../config');

const router = express.Router();

// 验证 token 中间件
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: '未登录' });
  }

  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token 无效' });
  }
};

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'images';
    if (file.mimetype.startsWith('audio/')) {
      folder = 'audio';
    } else if (file.mimetype.startsWith('video/')) {
      folder = 'video';
    }
    cb(null, path.join(__dirname, '../data/files', folder));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize }
});

// 上传文件
router.post('/', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有文件' });
  }

  let folder = 'images';
  if (req.file.mimetype.startsWith('audio/')) {
    folder = 'audio';
  } else if (req.file.mimetype.startsWith('video/')) {
    folder = 'video';
  }

  res.json({
    success: true,
    url: `/files/${folder}/${req.file.filename}`,
    type: folder,
    filename: req.file.filename
  });
});

module.exports = router;
```

**Step 2: Commit**

```bash
git add server/routes/upload.js
git commit -m "feat: add file upload route"
```

---

### Task 8: 创建 Socket.io 处理器

**Files:**
- Create: `server/socket/handler.js`

**Step 1: 创建 Socket 处理器**

```javascript
// server/socket/handler.js
const jwt = require('jsonwebtoken');
const config = require('../config');
const { userQueries, messageQueries } = require('../db/database');

// 存储在线用户
const onlineUsers = new Map(); // Map<odp>

function setupSocketHandlers(io) {
  // 验证中间件
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('未登录'));
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Token 无效'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.userId;
    const nickname = socket.user.nickname;

    console.log(`用户连接: ${nickname} (${userId})`);

    // 记录在线状态
    onlineUsers.set(userId, socket.id);

    // 通知对方上线
    socket.broadcast.emit('online', { userId, nickname });

    // 发送当前在线用户列表
    const allUsers = userQueries.getAll.all();
    const onlineList = allUsers
      .filter(u => onlineUsers.has(u.id))
      .map(u => ({ userId: u.id, nickname: u.nickname }));
    socket.emit('online-users', onlineList);

    // 接收消息
    socket.on('message', (data) => {
      const { type, content, duration } = data;

      // 保存到数据库
      const result = messageQueries.create.run(userId, type, content, duration || null);

      // 广播消息给所有人（包括自己，用于确认）
      io.emit('message', {
        id: result.lastInsertRowid,
        senderId: userId,
        senderName: nickname,
        type,
        content,
        duration,
        createdAt: new Date().toISOString()
      });
    });

    // 正在输入
    socket.on('typing', (isTyping) => {
      socket.broadcast.emit('typing', { userId, nickname, isTyping });
    });

    // WebRTC 信令 - 发起通话
    socket.on('call-request', (data) => {
      socket.broadcast.emit('call-request', {
        from: { userId, nickname },
        type: data.type // 'audio' 或 'video'
      });
    });

    // WebRTC 信令 - 应答通话
    socket.on('call-answer', (data) => {
      socket.broadcast.emit('call-answer', {
        from: { userId, nickname },
        accepted: data.accepted
      });
    });

    // WebRTC 信令 - 结束通话
    socket.on('call-end', () => {
      socket.broadcast.emit('call-end', { from: { userId, nickname } });
    });

    // WebRTC 信令 - SDP
    socket.on('sdp-offer', (data) => {
      socket.broadcast.emit('sdp-offer', { from: userId, sdp: data.sdp });
    });

    socket.on('sdp-answer', (data) => {
      socket.broadcast.emit('sdp-answer', { from: userId, sdp: data.sdp });
    });

    // WebRTC 信令 - ICE candidate
    socket.on('ice-candidate', (data) => {
      socket.broadcast.emit('ice-candidate', { from: userId, candidate: data.candidate });
    });

    // 断开连接
    socket.on('disconnect', () => {
      console.log(`用户断开: ${nickname} (${userId})`);
      onlineUsers.delete(userId);
      socket.broadcast.emit('offline', { userId, nickname });
    });
  });
}

module.exports = { setupSocketHandlers };
```

**Step 2: Commit**

```bash
git add server/socket/handler.js
git commit -m "feat: add Socket.io message and signaling handler"
```

---

### Task 9: 创建服务器入口文件

**Files:**
- Create: `server/index.js`

**Step 1: 创建主入口**

```javascript
// server/index.js
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const config = require('./config');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const { setupSocketHandlers } = require('./socket/handler');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST']
  }
});

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件
app.use('/files', express.static(path.join(__dirname, 'data/files')));

// 生产环境：服务前端静态文件
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);

// 生产环境：所有其他路由返回前端
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// 设置 Socket.io
setupSocketHandlers(io);

// 启动服务器
httpServer.listen(config.port, () => {
  console.log(`服务器运行在 http://localhost:${config.port}`);
});
```

**Step 2: 测试服务器启动**

```bash
cd server && npm run dev
```

Expected: 输出 "服务器运行在 http://localhost:3000"

**Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat: add server entry point"
```

---

## Phase 3: 前端核心功能

### Task 10: 配置 Vite 和 PWA

**Files:**
- Modify: `client/vite.config.js`
- Create: `client/public/icon-192.png`
- Create: `client/public/icon-512.png`

**Step 1: 创建 PWA 图标（使用占位符）**

```bash
# 暂时使用空图标，后续可替换
cd client/public
# 可以用在线工具生成或先跳过
```

**Step 2: 配置 vite.config.js**

```javascript
// client/vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: '私密空间',
        short_name: '私密空间',
        description: '私人聊天应用',
        theme_color: '#07c160',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/files': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  }
})
```

**Step 3: Commit**

```bash
git add client/vite.config.js
git commit -m "feat: configure Vite with PWA support"
```

---

### Task 11: 创建 Vue Router

**Files:**
- Create: `client/src/router/index.js`
- Modify: `client/src/main.js`

**Step 1: 创建路由配置**

```javascript
// client/src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/setup',
    name: 'Setup',
    component: () => import('../views/Setup.vue')
  },
  {
    path: '/chat',
    name: 'Chat',
    component: () => import('../views/Chat.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = sessionStorage.getItem('token')

  if (to.meta.requiresAuth && !token) {
    next('/')
  } else {
    next()
  }
})

export default router
```

**Step 2: 更新 main.js**

```javascript
// client/src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

createApp(App).use(router).mount('#app')
```

**Step 3: Commit**

```bash
git add client/src/router/index.js client/src/main.js
git commit -m "feat: add Vue Router with auth guard"
```

---

### Task 12: 创建 Socket 服务

**Files:**
- Create: `client/src/services/socket.js`

**Step 1: 创建 Socket 服务**

```javascript
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
```

**Step 2: Commit**

```bash
git add client/src/services/socket.js
git commit -m "feat: add Socket.io client service"
```

---

### Task 13: 创建全局样式

**Files:**
- Modify: `client/src/style.css`

**Step 1: 创建全局样式**

```css
/* client/src/style.css */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary-color: #07c160;
  --bg-color: #ededed;
  --chat-bg: #f5f5f5;
  --bubble-self: #95ec69;
  --bubble-other: #ffffff;
  --text-color: #333;
  --text-secondary: #999;
  --border-color: #ddd;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--bg-color);
  color: var(--text-color);
  min-height: 100vh;
  -webkit-tap-highlight-color: transparent;
}

input, button {
  font-family: inherit;
  font-size: inherit;
}

button {
  cursor: pointer;
  border: none;
  background: var(--primary-color);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
}

button:active {
  opacity: 0.8;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 16px;
  outline: none;
}

input:focus {
  border-color: var(--primary-color);
}

.container {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
}
```

**Step 2: Commit**

```bash
git add client/src/style.css
git commit -m "feat: add global styles"
```

---

### Task 14: 创建登录页面

**Files:**
- Create: `client/src/views/Login.vue`

**Step 1: 创建登录页面**

```vue
<!-- client/src/views/Login.vue -->
<template>
  <div class="login-page">
    <div class="login-container">
      <div class="logo">🔐</div>
      <h1>私密空间</h1>

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
```

**Step 2: Commit**

```bash
git add client/src/views/Login.vue
git commit -m "feat: add login page"
```

---

### Task 15: 创建设置页面

**Files:**
- Create: `client/src/views/Setup.vue`

**Step 1: 创建设置页面**

```vue
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
        <p class="success">✅ 创建成功！</p>
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
```

**Step 2: Commit**

```bash
git add client/src/views/Setup.vue
git commit -m "feat: add setup page with invite link"
```

---

### Task 16: 创建聊天页面 - 基础结构

**Files:**
- Create: `client/src/views/Chat.vue`

**Step 1: 创建聊天页面**

```vue
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
        <button class="icon-btn" @click="showImagePicker">📷</button>
        <button
          class="icon-btn"
          @mousedown="startRecording"
          @mouseup="stopRecording"
          @touchstart.prevent="startRecording"
          @touchend.prevent="stopRecording"
        >🎤</button>
        <button class="icon-btn" @click="showVideoPicker">📹</button>
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
    <input type="file" ref="imageInput" accept="image/*" @change="handleImageSelect" style="display: none" />
    <input type="file" ref="videoInput" accept="video/*" @change="handleVideoSelect" style="display: none" />
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
const videoInput = ref(null)

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

// 图片选择
function showImagePicker() {
  imageInput.value?.click()
}

async function handleImageSelect(e) {
  const file = e.target.files[0]
  if (!file) return

  await uploadAndSend(file, 'image')
  e.target.value = ''
}

// 视频选择
function showVideoPicker() {
  videoInput.value?.click()
}

async function handleVideoSelect(e) {
  const file = e.target.files[0]
  if (!file) return

  await uploadAndSend(file, 'video')
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
```

**Step 2: Commit**

```bash
git add client/src/views/Chat.vue
git commit -m "feat: add chat page with messaging and calls"
```

---

### Task 17: 更新 App.vue

**Files:**
- Modify: `client/src/App.vue`

**Step 1: 更新 App.vue**

```vue
<!-- client/src/App.vue -->
<template>
  <router-view />
</template>

<script setup>
</script>

<style>
#app {
  width: 100%;
  min-height: 100vh;
}
</style>
```

**Step 2: Commit**

```bash
git add client/src/App.vue
git commit -m "feat: update App.vue for router"
```

---

### Task 18: 添加消息提示音

**Files:**
- Create: `client/public/notification.mp3`

**Step 1: 创建一个简单的提示音**

可以从网上下载一个免费的短提示音，放到 `client/public/notification.mp3`

或者暂时跳过，用户可以稍后添加。

**Step 2: Commit (如果有文件)**

```bash
git add client/public/notification.mp3
git commit -m "feat: add notification sound"
```

---

## Phase 4: 部署配置

### Task 19: 创建 Nginx 配置示例

**Files:**
- Create: `nginx.conf.example`

**Step 1: 创建 Nginx 配置**

```nginx
# nginx.conf.example
# 复制到 /etc/nginx/sites-available/private-chat 并修改域名

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书（Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    # 前端静态文件
    root /var/www/private-chat/client/dist;
    index index.html;

    # 前端路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 文件代理
    location /files {
        proxy_pass http://127.0.0.1:3000;
    }

    # WebSocket 代理
    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

**Step 2: Commit**

```bash
git add nginx.conf.example
git commit -m "docs: add Nginx configuration example"
```

---

### Task 20: 创建 PM2 配置

**Files:**
- Create: `ecosystem.config.js`

**Step 1: 创建 PM2 配置**

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'private-chat',
    script: 'server/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
}
```

**Step 2: Commit**

```bash
git add ecosystem.config.js
git commit -m "docs: add PM2 configuration"
```

---

### Task 21: 创建部署脚本

**Files:**
- Create: `deploy.sh`

**Step 1: 创建部署脚本**

```bash
#!/bin/bash
# deploy.sh - 部署脚本

set -e

echo "=== 开始部署 ==="

# 1. 拉取最新代码
echo "拉取代码..."
git pull origin main

# 2. 安装后端依赖
echo "安装后端依赖..."
cd server
npm install --production
cd ..

# 3. 安装前端依赖并构建
echo "构建前端..."
cd client
npm install
npm run build
cd ..

# 4. 重启服务
echo "重启服务..."
pm2 restart ecosystem.config.js --env production

echo "=== 部署完成 ==="
```

**Step 2: 添加执行权限并提交**

```bash
chmod +x deploy.sh
git add deploy.sh
git commit -m "docs: add deployment script"
```

---

### Task 22: 创建 README

**Files:**
- Create: `README.md`

**Step 1: 创建 README**

```markdown
# 私人聊天应用

两人专用的私密聊天 PWA 应用。

## 功能

- 文字消息
- 语音消息
- 图片/视频消息
- 实时语音/视频通话
- 退出即清空（手机端不保留历史）

## 部署步骤

### 1. 准备

- 一台 Linux 云服务器
- 一个域名（已解析到服务器 IP）

### 2. 安装环境

```bash
# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 Nginx
sudo apt install -y nginx

# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 安装 PM2
sudo npm install -g pm2
```

### 3. 申请 SSL 证书

```bash
sudo certbot --nginx -d your-domain.com
```

### 4. 部署应用

```bash
# 克隆代码
cd /var/www
git clone <your-repo-url> private-chat
cd private-chat

# 安装依赖
cd server && npm install && cd ..
cd client && npm install && npm run build && cd ..

# 配置 Nginx
sudo cp nginx.conf.example /etc/nginx/sites-available/private-chat
sudo ln -s /etc/nginx/sites-available/private-chat /etc/nginx/sites-enabled/
# 编辑配置文件，修改域名
sudo nano /etc/nginx/sites-available/private-chat
sudo nginx -t
sudo systemctl reload nginx

# 启动服务
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 5. 使用

1. 手机 Safari 打开 https://your-domain.com
2. 第一个人设置昵称和序列号
3. 复制邀请链接发给对方
4. 对方打开链接完成注册
5. 点击 Safari 底部分享按钮 → 添加到主屏幕

## 本地开发

```bash
# 启动后端
cd server && npm run dev

# 启动前端（新终端）
cd client && npm run dev

# 访问 http://localhost:5173
```
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with deployment instructions"
```

---

## 完成

所有核心功能已实现，项目结构：

```
private-chat/
├── client/                # Vue 3 前端
│   ├── src/
│   │   ├── views/         # 页面组件
│   │   ├── services/      # Socket 服务
│   │   └── router/        # 路由配置
│   └── vite.config.js
├── server/                # Node.js 后端
│   ├── routes/            # API 路由
│   ├── socket/            # Socket.io 处理
│   ├── db/                # 数据库模块
│   └── index.js           # 入口文件
├── nginx.conf.example     # Nginx 配置
├── ecosystem.config.js    # PM2 配置
├── deploy.sh              # 部署脚本
└── README.md              # 说明文档
```
