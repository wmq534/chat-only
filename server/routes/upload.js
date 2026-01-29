// server/routes/upload.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const config = require('../config');

const router = express.Router();

// 确保上传目录存在
const uploadDirs = ['images', 'audio', 'video'];
uploadDirs.forEach(dir => {
  const dirPath = path.join(__dirname, '../data/files', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

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

// 上传文件 (multer 2.x 需要手动调用并处理错误)
router.post('/', authMiddleware, async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      upload.single('file')(req, res, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

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
  } catch (err) {
    console.error('上传错误:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件过大' });
    }
    res.status(500).json({ error: '上传失败: ' + err.message });
  }
});

module.exports = router;
