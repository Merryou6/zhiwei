# 知微 · 部署教程（单容器：Docker 一条命令跑通）

> 形态：**一个容器 = 静态前端 + API 同源反代**（`deploy/serve.js` 一个进程全包）。
> 前端与后端同源，天然绕开"API 不设 CORS 头"的限制；SSE 流式直通（已实测）。

---

## 〇、你要准备的东西

| 项 | 要求 |
| --- | --- |
| 服务器 | 任意能装 Docker 的 Linux（2 核 2G 内存足够），开放一个端口（默认 8080） |
| 代码 | 仓库一份（`git clone` 或 scp 上传，**不包含** `node_modules`，很小） |
| 必改配置 | **只有一项：`ZHIWEI_SERVER_SECRET`**（见下） |

---

## 一、三步部署

### 1. 上传代码到服务器

```bash
# 方式 A：git（推荐）
git clone <你的仓库地址> zhiwei && cd zhiwei

# 方式 B：本地打包上传（排除本地数据与依赖）
# tar --exclude node_modules --exclude .git --exclude data/local_db -czf zhiwei.tgz .
# scp zhiwei.tgz user@server:~/  → 服务器上解压
```

### 2. 配置密钥（唯一的必改项）

```bash
cd zhiwei
cp deploy/zhiwei.env.example deploy/zhiwei.env

# 生成随机密钥并写入 env 文件的 ZHIWEI_SERVER_SECRET=
openssl rand -hex 32
```

> `deploy/zhiwei.env` 已被 `.gitignore` 排除，**不会**进仓库；`ZHIWEI_SERVER_SECRET` 用于登录 token 签名，**不设置 = 任何人可伪造登录态**（容器启动时会打警告）。

### 3. 构建并启动

```bash
docker compose up -d --build
```

完成。浏览器打开 `http://<服务器IP>:8080`，注册一个账号即可体验完整闭环。

> 依赖安装默认走国内镜像（`registry.npmmirror.com`，见 Dockerfile 的 `NPM_REGISTRY`）。
> 首次构建实测：全量安装 **278 个包**（运行时 5 个 + 构建 6 个 + 测试专用 5 个），镜像产物 **237 MB**，耗时数分钟属正常。
> **想再快一截（可选）**：镜像构建不需要测试依赖（`jsdom` / `vitest` / `@types/*`，约占四成下载量），
> 可把 Dockerfile 的安装行改为 `npm install --omit=dev` 另按需补装 `vite esbuild tailwindcss postcss autoprefixer @vitejs/plugin-react`。
> 当前默认保持全量安装——确保与本地开发/测试环境完全一致，不在部署环节引入差异。
> 海外服务器构建慢的话：`docker build --build-arg NPM_REGISTRY=https://registry.npmjs.org -t zhiwei .`

---

## 二、验证部署（三条命令）

```bash
# 1) 首页：应返回 HTML（<title>知微…）
curl -s http://127.0.0.1:8080/ | head -3

# 2) API 探活：未带 token 应返回 401 JSON（这是正确的！）
curl -s http://127.0.0.1:8080/api/space/list

# 3) 健康检查：{"ok":true,"api":"up"}
curl -s http://127.0.0.1:8080/healthz
```

再在浏览器里走一遍：注册 → 自报 → 测评 → 图谱 → 报告。

---

## 三、日常运维

```bash
# 看日志（含 API 子进程日志）
docker compose logs -f

# 更新版本（拉新代码后重新构建，数据不丢）
git pull && docker compose up -d --build

# 停止 / 重启
docker compose down      # 数据保留在 volume
docker compose restart

# 备份全部用户数据（注册账号、作答记录、掌握度、归因记录都在这个卷里）
docker run --rm -v zhiwei_zhiwei-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/zhiwei-data-$(date +%F).tgz -C /data .

# 恢复备份
docker run --rm -v zhiwei_zhiwei-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/zhiwei-data-<日期>.tgz -C /data
```

### ⚠ 更新版本的三个坑（2026-09-24 真机踩到，务必按序）

**坑 1：`git fetch` ≠ `git pull`。** `fetch` 只更新远端引用，**不动工作区**。只 fetch 不 pull，
随后 `docker compose up -d --build` 会正常跑完、日志一片绿，**但编译的是旧代码**——表现为「构建成功、
版本没变」。判据看产物哈希：`dist/assets/index-*.css` 与线上正在服务的那个完全同名同大小 ⇒ 白构建。

**坑 2：确认你在哪条分支。** 先 `git branch` 看当前分支；部署件在 `tempdeploy` 上，若停在 `main`
就拉不到新代码。切换前先 `git status --short` 确认没有本地改动。

**坑 3：老版 docker compose 没有 buildx。** 若报 `compose build requires buildx 0.17.0 or later`，
用经典构建器即可（本项目镜像构建不依赖 BuildKit 特性）：

```bash
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0
```

**正确的一套（照抄）：**

```bash
cd <部署目录>
git status --short                      # 坑 2：必须为空
git branch                              # 坑 2：应为 tempdeploy
git pull                                # 坑 1：这一步才真正更新工作区
git log --oneline -1                    # 确认是预期的那次提交，不是再看一遍旧的
docker image tag zhiwei:latest zhiwei:rollback
docker compose up -d --build            # 报 buildx 错就加坑 3 的两个 export
# 然后按**下一节**的「版本指纹」确认产物真的换了
```

### 更新前先给旧镜像打标签（便于回滚）

`docker compose up -d --build` 会把 `zhiwei:latest` 指向新镜像，旧镜像随即变成悬空层。
先留个标签，回滚就是三条命令：

```bash
docker image tag zhiwei:latest zhiwei:rollback          # 更新前执行

# …若新版本有问题，回滚：
docker compose down
docker image tag zhiwei:rollback zhiwei:latest
docker compose up -d                                    # 注意：不带 --build
```

### 怎么确认「更新真的生效了」

前端是烤进镜像的静态产物，**光 `restart` 不会更新，必须 `--build`**。

```bash
# 1) 健康检查（旧版本同样返回 true，只能证明容器活着）
curl -s http://127.0.0.1:8080/healthz

# 2) 版本指纹：移动端适配轮给前端 CSS 新增了一条断点媒体查询，
#    这个字符串在旧版产物里不可能出现（≥1 = 已更新；0 = 仍是旧版）
CSS=$(curl -s http://127.0.0.1:8080/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.css' | head -1)
curl -s "http://127.0.0.1:8080/$CSS" | grep -c 'not all and (min-width: 720px)'
```

最后用**手机**打开一次：顶栏应为「知微」+ 汉堡键（点开是右侧抽屉导航）；
更新前在手机上顶栏会把 6 个导航项压成**竖排单字**，一眼可辨。

---

## 四、接入真实大模型（可选，DeepSeek 等 OpenAI 兼容接口）

默认 `ZHIWEI_MODEL_MODE=local` 用确定性规则适配器（零外部依赖，比赛演示稳）。想让诊断 / 对话 / 试卷识别走真实大模型：

```bash
# 编辑 deploy/zhiwei.env，追加四行：
ZHIWEI_MODEL_MODE=remote
ZHIWEI_LLM_BASE_URL=https://api.deepseek.com/v1   # 任意 OpenAI 兼容接口
ZHIWEI_LLM_MODEL=deepseek-chat
ZHIWEI_LLM_API_KEY=sk-xxxx                         # 你的 Key

docker compose up -d   # 重启生效（env 变更不需要 --build）
```

注意：远程不可用（网络/超时/解析失败）时自动回落本地规则适配器，不影响闭环；SSE 流式经 serve.js 反代直通已实测。

---

## 五、改端口 / 上 HTTPS（可选）

**换端口**（比如 80）：编辑 `deploy/zhiwei.env` 加 `ZHIWEI_HOST_PORT=80`，或直接改 `docker-compose.yml` 的 `ports` 为 `"80:8080"`，然后 `docker compose up -d`。

**上 HTTPS（有域名时）**：容器前再放一层 nginx 反代（只做 TLS 终结，注意 SSE 两行配置）：

```nginx
server {
    listen 443 ssl;
    server_name your.domain.com;
    ssl_certificate     /etc/letsencrypt/live/your.domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your.domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        # SSE 必须关缓冲（对话流式回复靠它）
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```

---

## 六、安全与已知限制（如实告知）

**安全清单**
- [x] `ZHIWEI_SERVER_SECRET` 已改为 32 字节随机值（唯一必改项）
- [x] API 只在容器内监听 8787，**不对外**；对外仅 8080 一个口
- [x] `data/local_db`（用户数据）不打进镜像，由 volume 持有
- [x] 前端构建产物与规格文档均在镜像外可审计
- [ ] 若公网长期开放，建议加 HTTPS（见上）；登录无频控（比赛演示场景可接受）

**已知限制（比赛范围内的有意取舍，不是 bug）**
1. **单实例**：存储为 JSON 文件、无并发锁（PRD 明确不做）——不要横向扩多副本。
2. **默认本地规则适配器**：开箱即用时错误诊断 / 对话 / 试卷识别是确定性规则模拟；需要真实大模型可切换 remote 模式（见上文「接入真实大模型」）。
3. **CloudBase 适配器是桩**：部署到腾讯云云函数需先实现九张表读写（代码注释已标接线点）。
4. 演示数据可重置：`docker compose down` 后删除 volume 即回到全新状态（`docker volume rm zhiwei_zhiwei-data`）。

---

## 附：文件清单

| 文件 | 作用 |
| --- | --- |
| `Dockerfile` | 多阶段构建：node:22-alpine 装依赖 → 构建（esbuild + vite）→ 精简运行镜像 |
| `docker-compose.yml` | 端口 / 密钥（env_file）/ 数据卷 / 重启策略 |
| `deploy/serve.js` | 运行入口：启动 API 子进程 + 静态托管 + `/api` 流式反代 + `/healthz` |
| `deploy/zhiwei.env.example` | 环境变量模板（真实 env 不入库） |
| `.dockerignore` | 构建上下文瘦身（排除本地数据 / 依赖 / 文档） |
