# SenseNova Chat - 本地隐私版

> 开源 · 三模型混合调度 · 本地密码保护 · 单流输出

## 功能特性

- **DeepSeek V4 Flash** - 深度推理，流式响应
- **SenseNova 6.7 Flash-Lite** - 快速意图识别
- **SenseNova U1 Fast** - 智能配图生成
- **三模型协作** - 自动分析意图，混合调度，输出一条精准答案
- **本地密码保护** - 二次哈希加密，设备绑定，后台自动挂锁
- **隐私优先** - 所有数据仅存本地，不上传任何云端

## 快速开始

### 环境要求
- [Node.js](https://nodejs.org/) 20+ 
- npm 10+

### 一键启动

**macOS / Linux:**
```bash
./start.sh
```

**Windows:**
```
双击 start.bat
```

### 手动启动

```bash
# 1. 安装依赖（首次）
npm install

# 2. 构建项目
npm run build

# 3. 启动服务器
npm start

# 浏览器访问 http://localhost:3000
```

## 使用说明

1. 首次打开时，输入你的 **SenseNova API Key**（`sk-` 开头）
2. 设置一个**本地隐私密码**（与当前设备绑定，遗失无法找回）
3. 开始使用，输入问题即可获得三模型协作的精准回答
4. 页面切换到后台或点击「锁屏」时会**自动挂锁**，需输入密码解锁
5. 点击「退出」将**彻底清除**所有本地数据

## 获取 API Key

1. 访问 [SenseNova 控制台](https://platform.sensenova.cn/console/keys)
2. 点击「创建 API Key」
3. 复制以 `sk-` 开头的密钥

## 安全说明

- API Key 和 密码均仅存于浏览器本地 `localStorage`
- 密码使用 **SHA-256 + 随机盐 + 二次哈希** 加密存储
- 后台自动挂锁，保护隐私不被他人窥视
- 退出时完全清除所有本地数据
- 密码与设备绑定，换设备需重新配置

## 技术栈

- React 19 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Hono + tRPC（后端代理）
- SenseNova API（三模型混合调用）
