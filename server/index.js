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
