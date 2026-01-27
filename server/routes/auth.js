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
