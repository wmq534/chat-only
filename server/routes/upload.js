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
