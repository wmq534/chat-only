# 私人聊天应用

两人专用的私密聊天 PWA 应用。

## 功能

- 文字消息
- 语音消息
- 图片/视频消息
- 实时语音/视频通话
- 退出即清空（手机端不保留历史）

## 部署方式

### 方式一：使用公网 IP 部署（无域名）

适合没有域名、只有公网 IP 的情况。

#### 1. 准备

- 一台有公网 IP 的 Linux 云服务器
- 开放端口：80（HTTP）、3000（可选，直连后端）

#### 2. 安装环境

```bash
# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 Nginx
sudo apt install -y nginx

# 安装 PM2
sudo npm install -g pm2
```

#### 3. 部署应用

```bash
# 克隆代码
cd /var/www
git clone <your-repo-url> private-chat
cd private-chat

# 安装依赖
cd server && npm install && cd ..
cd client && npm install && npm run build && cd ..

# 启动后端服务
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

#### 4. 配置 Nginx（公网 IP 版）

创建 Nginx 配置文件：

```bash
sudo nano /etc/nginx/sites-available/private-chat
```

写入以下内容（将 `YOUR_PUBLIC_IP` 替换为你的公网 IP）：

```nginx
server {
    listen 80;
    server_name YOUR_PUBLIC_IP;

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

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/private-chat /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # 删除默认配置
sudo nginx -t
sudo systemctl reload nginx
```

#### 5. 使用

1. 手机浏览器打开 `http://YOUR_PUBLIC_IP`
2. 第一个人设置昵称和序列号
3. 复制邀请链接发给对方
4. 对方打开链接完成注册
5. 开始聊天

> **注意**：使用 HTTP（非 HTTPS）时，部分浏览器可能限制麦克风/摄像头权限。如需使用语音/视频通话功能，建议使用域名 + HTTPS 部署方式。

---

### 方式二：使用域名 + HTTPS 部署（推荐）

适合有域名的情况，支持完整的 PWA 功能。

#### 1. 准备

- 一台 Linux 云服务器
- 一个域名（已解析到服务器 IP）

#### 2. 安装环境

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

#### 3. 申请 SSL 证书

```bash
sudo certbot --nginx -d your-domain.com
```

#### 4. 部署应用

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

#### 5. 使用

1. 手机 Safari 打开 `https://your-domain.com`
2. 第一个人设置昵称和序列号
3. 复制邀请链接发给对方
4. 对方打开链接完成注册
5. 点击 Safari 底部分享按钮 → 添加到主屏幕

---

## 本地开发

```bash
# 启动后端
cd server && npm run dev

# 启动前端（新终端）
cd client && npm run dev

# 访问 http://localhost:5173
```

## 常见问题

### Q: 使用公网 IP 无法使用麦克风/摄像头？

A: 现代浏览器要求 HTTPS 才能访问麦克风和摄像头（localhost 除外）。解决方案：
1. 使用域名 + HTTPS 部署
2. 或在 Chrome 中访问 `chrome://flags/#unsafely-treat-insecure-origin-as-secure`，添加你的 IP 地址

### Q: WebSocket 连接失败？

A: 检查防火墙是否开放了 80 端口，以及 Nginx 配置中的 WebSocket 代理是否正确。
