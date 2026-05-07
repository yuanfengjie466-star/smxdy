#!/bin/bash

# ============================================================
# SenseNova Chat - 本地启动脚本
# 开源 · 三模型混合调度 · 本地隐私保护
# ============================================================

echo "=========================================="
echo "  SenseNova Chat 本地启动器"
echo "  开源 · 三模型混合调度 · 本地隐私保护"
echo "=========================================="
echo ""

# 检查 Node.js
echo "[1/4] 检查环境..."
if ! command -v node &> /dev/null; then
    echo "错误：未检测到 Node.js，请先安装 Node.js 20+"
    echo "下载地址：https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "警告：Node.js 版本过低，建议升级到 20+"
fi

echo "      Node.js 版本: $(node -v)"
echo "      npm 版本: $(npm -v)"
echo ""

# 检查依赖
echo "[2/4] 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "      正在安装依赖（首次启动需要几分钟）..."
    npm install
    if [ $? -ne 0 ]; then
        echo "错误：依赖安装失败"
        exit 1
    fi
else
    echo "      依赖已安装"
fi
echo ""

# 构建项目
echo "[3/4] 构建项目..."
npm run build > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "警告：构建失败，尝试直接启动开发模式..."
    echo ""
    echo "[4/4] 启动开发服务器..."
    echo "      正在启动，请稍候..."
    echo "      浏览器将自动打开 http://localhost:3000"
    echo "      按 Ctrl+C 停止服务器"
    echo ""
    npm run dev
else
    echo "      构建成功"
    echo ""
    echo "[4/4] 启动服务器..."
    echo "      浏览器将自动打开 http://localhost:3000"
    echo "      按 Ctrl+C 停止服务器"
    echo ""
    
    # 等待服务器启动后打开浏览器
    (
        sleep 3
        if command -v open &> /dev/null; then
            open http://localhost:3000
        elif command -v xdg-open &> /dev/null; then
            xdg-open http://localhost:3000
        elif command -v start &> /dev/null; then
            start http://localhost:3000
        fi
    ) &
    
    npm start
fi
