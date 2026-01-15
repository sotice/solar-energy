# VoltVision

太阳能能源管理系统，提供实时监控、数据分析与账单管理功能。

## 项目结构

```text
VoltVision/
├── VoltVision-Backend/     # 后端 API 服务
├── VoltVision-Frontend/    # 前端 React 应用
└── VoltVision-data-API/    # 数据采集服务
```

## 技术栈

- **前端**: React + Vite + Tailwind CSS + daisyUI
- **后端**: Node.js + Express + TypeScript
- **数据库**: MongoDB
- **支付**: Stripe
- **认证**: Clerk

## 本地开发

### 环境要求

- Node.js v18+
- MongoDB

### 启动服务

```bash
# 后端
cd VoltVision-Backend && npm install && npm run dev

# 数据服务
cd VoltVision-data-API && npm install && npm run dev

# 前端
cd VoltVision-Frontend && npm install && npm run dev
```

前端默认运行在 `http://localhost:5173`

## 主要功能

- ☀️ 太阳能设备管理
- 📊 能源数据监控与分析
- 💳 账单与支付管理
- ⚠️ 异常检测与告警
- 🌤️ 天气数据集成

## 许可证

MIT License
