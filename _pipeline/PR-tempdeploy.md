# PR：Docker 单容器部署件（已对齐 main 最新能力）

## 内容

tempdeploy 在 main 之外新增 5 个提交：原 3 个 Docker 部署提交 + 本次 2 个（合并 main、部署件适配）。

**部署件（此前已在 tempdeploy）：**
- `Dockerfile`：多阶段构建（node:22-alpine 装依赖 → esbuild + vite 构建 → 精简运行镜像），`NPM_REGISTRY` 可切换国内镜像
- `docker-compose.yml` + `deploy/serve.js`：单容器 = 静态前端 + `/api` 同源流式反代（SSE 直通）+ `/healthz`，对外仅 8080 一个口
- `deploy/DEPLOY.md`：三步部署教程 + 运维/备份/HTTPS/安全清单
- `deploy/zhiwei.env.example`：环境变量模板（真实 env 不入库）

**本次合并与适配：**
- `b8d5581` 合并 main（多知识库 cz+gz、B 端控制台并入 apps/web、DeepSeek 远程模型、一键启动等 12 个提交）；唯一冲突 `.gitignore` 已合并保留双方（`.env` 忽略 + `deploy/zhiwei.env` 忽略）
- `f31643e` 部署件对齐 main 新能力：
  - env 模板与 DEPLOY.md 新增「接入真实大模型」一节：`ZHIWEI_MODEL_MODE=remote` + `ZHIWEI_LLM_BASE_URL / API_KEY / MODEL / TIMEOUT_MS`（已从 `remoteChat.ts` 核实：默认超时 45000ms，任何失败自动回落本地规则适配器）
  - `.dockerignore` 排除 `zhiwei-console`（B 端原型已并入 apps/web，构建不需要）
  - LOOKATME.md 部署摘要同步

## 兼容性说明

- 依赖集与分叉点完全一致，DEPLOY.md 的实测数字（278 包 / 237 MB）仍有效
- Dockerfile `COPY data/knowledge` / `data/item_bank` 整目录拷贝，main 新增的高中知识库（gz）自动进镜像
- 校验：`node --check serve.js` 通过；esbuild 打包后端通过（业务代码与 main 完全一致，未改动）

## 合并后

`git checkout main && git pull` 即可在 main 上看到部署件。
