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
