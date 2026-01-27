# 私人聊天应用设计文档

## 项目概述

一个两人专用的私人聊天 PWA 应用，支持文字、语音消息、图片、视频消息以及实时语音/视频通话。

## 需求规格

| 项目 | 内容 |
|------|------|
| 应用形式 | PWA 网页应用 |
| 用户数量 | 仅 2 人 |
| 消息类型 | 文字、语音消息、图片、视频消息 |
| 实时通信 | 语音通话、视频通话 |
| 登录方式 | 6位序列号（密码） |
| 消息提醒 | 网页内提醒 + 声音 |
| 隐私策略 | 服务器保留记录，手机端退出即清空 |
| 安全级别 | HTTPS 传输加密 |
| 技术栈 | Vue 3 + Node.js |
| 服务器 | 自有 Linux 云服务器 |

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        云服务器                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Nginx (反向代理)                    │   │
│  │                   - HTTPS 证书                       │   │
│  │                   - 静态文件服务                      │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │               Node.js 服务 (端口 3000)                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐   │   │
│  │  │ Express API │  │  Socket.io  │  │  信令服务   │   │   │
│  │  │  - 登录认证  │  │  - 实时消息  │  │  - WebRTC  │   │   │
│  │  │  - 文件上传  │  │  - 在线状态  │  │  - 通话协商 │   │   │
│  │  └─────────────┘  └─────────────┘  └────────────┘   │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│         ┌───────────────┴───────────────┐                  │
│         ▼                               ▼                  │
│  ┌─────────────┐                ┌──────────────┐           │
│  │   SQLite    │                │  文件目录     │           │
│  │  - 聊天记录  │                │  /data/files │           │
│  │  - 用户信息  │                │  - 图片/视频  │           │
│  └─────────────┘                └──────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## 界面流程

### 首次使用（第一个用户）
1. 打开网址，显示"首次设置"页面
2. 输入昵称 + 6位序列号
3. 获得邀请链接，发给对方

### 首次使用（第二个用户）
1. 打开邀请链接，显示"受邀注册"页面
2. 输入昵称 + 6位序列号
3. 完成注册

### 日常使用
1. 打开网址/主屏幕图标
2. 输入6位序列号
3. 进入聊天界面（空白，不显示历史记录）

## 前端技术栈

| 部分 | 技术 |
|------|------|
| 框架 | Vue 3 |
| 构建 | Vite |
| PWA | vite-plugin-pwa |
| 实时通信 | Socket.io-client |
| 通话 | WebRTC |

### 前端目录结构

```
client/
├── src/
│   ├── views/
│   │   ├── Login.vue        # 输入序列号
│   │   ├── Setup.vue        # 首次设置
│   │   └── Chat.vue         # 聊天界面
│   ├── components/
│   │   ├── MessageBubble.vue
│   │   ├── ChatInput.vue
│   │   ├── MediaRecorder.vue
│   │   └── CallModal.vue
│   ├── services/
│   │   ├── socket.js
│   │   ├── webrtc.js
│   │   └── audio.js
│   └── App.vue
├── public/
│   └── icon.png
├── index.html
├── vite.config.js
└── package.json
```

## 后端技术栈

| 部分 | 技术 |
|------|------|
| 运行时 | Node.js 18+ |
| 框架 | Express |
| 实时通信 | Socket.io |
| 数据库 | SQLite |
| 进程管理 | PM2 |

### 后端目录结构

```
server/
├── index.js
├── config.js
├── routes/
│   ├── auth.js
│   └── upload.js
├── socket/
│   ├── handler.js
│   └── signaling.js
├── db/
│   └── database.js
└── data/
    ├── app.db
    └── files/
```

## 数据库设计

```sql
-- 用户表
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    nickname TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 消息表
CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    sender_id INTEGER,
    type TEXT,           -- text / image / audio / video
    content TEXT,
    duration INTEGER,    -- 语音/视频时长（秒）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id)
);
```

## API 接口

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/setup` | POST | 首次注册 |
| `/api/login` | POST | 验证序列号 |
| `/api/invite-status` | GET | 检查是否可邀请 |
| `/api/upload` | POST | 上传文件 |

## Socket.io 事件

| 事件 | 功能 |
|------|------|
| `message` | 发送/接收消息 |
| `typing` | 正在输入提示 |
| `online` / `offline` | 在线状态 |
| `call-request` | 发起通话 |
| `call-answer` | 接听/拒绝 |
| `call-end` | 挂断 |
| `ice-candidate` | WebRTC ICE |
| `sdp-offer` / `sdp-answer` | WebRTC SDP |

## 部署需求

- 域名（HTTPS 必须）
- Let's Encrypt SSL 证书
- Nginx 反向代理
- Node.js 18+
- PM2 进程管理
