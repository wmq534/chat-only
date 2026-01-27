// server/socket/handler.js
const jwt = require('jsonwebtoken');
const config = require('../config');
const { userQueries, messageQueries } = require('../db/database');

// 存储在线用户
const onlineUsers = new Map();

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
