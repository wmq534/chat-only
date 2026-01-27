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
