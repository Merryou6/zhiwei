# syntax=docker/dockerfile:1
# 知微 · 单容器部署镜像（静态前端 + API 同源反代，一个进程全包）
# 用法见 deploy/DEPLOY.md。构建：docker build -t zhiwei . ；运行：见 docker-compose.yml

# ------------------------------------------------------------ 构建阶段
FROM node:22-alpine AS build
WORKDIR /app

# 先只拷 package.json 装依赖，充分利用层缓存。
# NPM_REGISTRY 默认国内镜像（腾讯云/国内 VPS 快）；海外服务器构建时用：
#   docker build --build-arg NPM_REGISTRY=https://registry.npmjs.org -t zhiwei .
COPY package.json ./
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm install --no-audit --no-fund --registry=${NPM_REGISTRY}

# 拷源码并构建（后端 esbuild 打包 + 前端 vite 生产构建，均为仓库已验证命令）
COPY . .
RUN npm run build:api && npm run build:web

# ------------------------------------------------------------ 运行阶段
# 仅用 Node 标准库（serve.js 零依赖），运行镜像不需要 npm install
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    ZHIWEI_ROOT=/app \
    ZHIWEI_API_PORT=8787 \
    PORT=8080

# 运行时只需要：打包后的 API、前端静态产物、算法参数、静态数据（图谱/题库）、部署入口
COPY --from=build /app/functions/api/dist/server.js functions/api/dist/server.js
COPY --from=build /app/apps/web/dist apps/web/dist
COPY config/params.json config/params.json
COPY data/knowledge data/knowledge
COPY data/item_bank data/item_bank
COPY deploy/serve.js deploy/serve.js

# JSON 文件存储目录（作答记录、用户、空间都在这；compose 挂 volume 持久化）
RUN mkdir -p data/local_db

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:8080/healthz || exit 1

# ZHIWEI_SERVER_SECRET 等敏感项一律运行时注入（-e 或 env_file），绝不写进镜像
CMD ["node", "deploy/serve.js"]
