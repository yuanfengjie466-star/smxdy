# SenseNova Chat

> 开源 · 三模型混合调度 · 本地隐私保护 · 单流输出

![License](https://img.shields.io/github/license/yuanfengjie466-star/smxdy)
![React](https://img.shields.io/badge/React-19.2.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Vite](https://img.shields.io/badge/Vite-7.2-green)

## 🌟 特性

| 特性 | 说明 |
|------|------|
| **🤖 三模型协作** | DeepSeek V4 + Flash-Lite + U1 Fast 智能调度 |
| **🔒 本地密码保护** | SHA-256 + 随机盐 + 二次哈希，设备绑定 |
| **🔐 自动锁屏** | 页面失焦/后台切换自动挂锁 |
| **📱 跨平台** | Windows / macOS / Linux 一键启动 |
| **🚀 流式响应** | SSE 实时输出，支持思考过程展示 |
| **🎨 精美 UI** | shadcn/ui + Tailwind CSS |

## 📦 三模型架构

```
┌─────────────────────────────────────────────────┐
│                  用户输入                        │
└──────────────────┬──────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│  Flash-Lite（意图识别）                          │
│  • 分析用户意图                                  │
│  • 判断是否需要配图                              │
│  • 输出类别 + 语气 + 配图需求                      │
└──────────────────┬──────────────────────────────┘
                   ▼
        ┌──────────┴──────────┐
        ▼                     ▼
┌───────────────┐     ┌───────────────┐
│ DeepSeek V4   │     │ U1 Fast       │
│ 深度推理回答   │     │ 智能配图生成   │
└───────┬───────┘     └───────┬───────┘
        │                     │
        └──────────┬──────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│              单流统一输出到前端                    │
└─────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 20+
- npm 10+

### 一键启动

**Windows:**
```powershell
# 双击 start.bat
# 或在 PowerShell 中运行
.\start.bat
```

**macOS / Linux:**
```bash
chmod +x start.sh
./start.sh
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

## 📋 使用说明

1. **首次打开** - 输入你的 **SenseNova API Key**（`sk-` 开头）
2. **设置密码** - 设置一个本地隐私密码（与当前设备绑定，遗失无法找回）
3. **开始使用** - 输入问题即可获得三模型协作的精准回答
4. **自动锁屏** - 页面切换到后台或点击「锁屏」时自动挂锁
5. **退出登录** - 点击「退出」彻底清除所有本地数据

## 🔑 获取 API Key

1. 访问 [SenseNova 控制台](https://platform.sensenova.cn/console/keys)
2. 点击「创建 API Key」
3. 复制以 `sk-` 开头的密钥

## 🔐 安全说明

| 数据 | 存储位置 | 加密方式 |
|------|---------|---------|
| API Key | `localStorage` | 明文（本地安全） |
| 密码哈希 | `localStorage` | SHA-256 + 随机盐 + 二次哈希 |
| 随机盐 | `localStorage` | 128 位随机数 |

**安全特性：**
- ✅ 所有数据仅存浏览器本地，不上传任何服务器
- ✅ 密码使用二次哈希加密，增加暴力破解难度
- ✅ 随机盐每次设置密码时重新生成
- ✅ 页面失焦/后台切换自动挂锁
- ✅ 退出时完全清除所有本地数据
- ⚠️ 密码与设备绑定，换设备需重新配置
- ⚠️ 密码遗失无法找回，请妥善保管

## 🛠️ 技术栈

### 前端
| 技术 | 版本 |
|------|------|
| React | 19.2.0 |
| TypeScript | 5.9.3 |
| Vite | 7.2.4 |
| Tailwind CSS | 3.4.19 |
| shadcn/ui | - |

### 后端
| 技术 | 版本 |
|------|------|
| Hono | 4.8.3 |
| tRPC | 11.8.1 |
| Drizzle ORM | 0.45.1 |

### AI 模型
| 模型 | 用途 |
|------|------|
| DeepSeek V4 Flash | 深度推理 & 主回答生成 |
| SenseNova 6.7 Flash-Lite | 意图识别（快速分析） |
| SenseNova U1 Fast | 智能配图生成 |

## 📁 项目结构

```
app/
├── api/                    # 后端 API 层（Hono）
│   ├── routes/
│   │   └── chat.ts        # 核心聊天流式 API
│   ├── router.ts          # tRPC 路由
│   └── middleware.ts      # 中间件
├── src/                    # 前端源码
│   ├── components/ui/     # shadcn/ui 组件
│   ├── hooks/             # 自定义 Hooks
│   ├── providers/         # tRPC Provider
│   └── App.tsx            # 主应用组件
├── db/                     # 数据库层（Drizzle ORM）
├── contracts/              # 类型合约
├── start.sh / start.bat   # 一键启动脚本
└── package.json           # 项目配置
```

## 📄 开源协议

[GNU Affero GPL v3](LICENSE)

## 🔗 相关链接

- [SenseNova 官网](https://www.sensenova.cn/)
- [API Key 管理](https://platform.sensenova.cn/console/keys)
- [GitHub 仓库](https://github.com/yuanfengjie466-star/smxdy)

## ⚠️ 免责声明

本项目为开源项目，仅供学习和研究使用。API 调用产生的费用均由用户自行承担，与项目作者无关。使用本项目时请遵守 SenseNova 的服务条款。
