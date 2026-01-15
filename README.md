# HF Proxy Vercel

一个简单的转发服务，可以部署在 Vercel 上。将所有请求原封不动转发到目标服务器。

## 功能

- 将所有请求透传转发到目标服务器
- 完全保留原始路径和查询参数
- 保留原始请求头和请求体
- 返回目标服务器的完整响应

## 部署

### 前置要求

- Node.js 16+
- Vercel 账号

### 环境变量

需要设置 `TARGET_DOMAIN` 环境变量指定目标服务器地址：

```
TARGET_DOMAIN=https://lancernix-cpa.hf.space
```

### 本地开发

```bash
# 创建 .env.local 文件
cp .env.example .env.local

# 编辑 .env.local 并设置 TARGET_DOMAIN
nano .env.local

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 部署到 Vercel

```bash
# 全局安装 Vercel CLI（如果未安装）
npm i -g vercel

# 部署时会提示设置环境变量 TARGET_DOMAIN
vercel
```

或在 Vercel 仪表板的项目设置中添加环境变量。

## 使用方法

访问你的 Vercel 应用，所有请求都会被转发到目标服务器。

```bash
# 访问
https://your-vercel-app.vercel.app/xxxx

# 会被转发到
https://lancernix-cpa.hf.space/xxxx
```

所有请求头、请求方法、查询参数都会保持不变。

## 示例

```bash
# GET 请求
curl https://your-vercel-app.vercel.app/api/data?key=value

# POST 请求
curl -X POST https://your-vercel-app.vercel.app/api/create \
  -H "Content-Type: application/json" \
  -d '{"name": "test"}'
```

## 许可证

MIT


