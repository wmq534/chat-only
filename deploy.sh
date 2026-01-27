#!/bin/bash
# deploy.sh - 部署脚本

set -e

echo "=== 开始部署 ==="

# 1. 拉取最新代码
echo "拉取代码..."
git pull origin main

# 2. 安装后端依赖
echo "安装后端依赖..."
cd server
npm install --production
cd ..

# 3. 安装前端依赖并构建
echo "构建前端..."
cd client
npm install
npm run build
cd ..

# 4. 重启服务
echo "重启服务..."
pm2 restart ecosystem.config.js --env production

echo "=== 部署完成 ==="
