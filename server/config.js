// server/config.js
module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  maxUsers: 2,
  uploadDir: './data/files',
  maxFileSize: 50 * 1024 * 1024 // 50MB
};
