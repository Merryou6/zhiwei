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

> 国内服务器 npm 拉包慢的话，把 `Dockerfile` 里那行 `RUN npm install ...` 换成：
> `RUN npm install --no-audit --no-fund --registry=https://registry.npmmirror.com`

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

---

## 四、改端口 / 上 HTTPS（可选）

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

## 五、安全与已知限制（如实告知）

**安全清单**
- [x] `ZHIWEI_SERVER_SECRET` 已改为 32 字节随机值（唯一必改项）
- [x] API 只在容器内监听 8787，**不对外**；对外仅 8080 一个口
- [x] `data/local_db`（用户数据）不打进镜像，由 volume 持有
- [x] 前端构建产物与规格文档均在镜像外可审计
- [ ] 若公网长期开放，建议加 HTTPS（见上）；登录无频控（比赛演示场景可接受）

**已知限制（比赛范围内的有意取舍，不是 bug）**
1. **单实例**：存储为 JSON 文件、无并发锁（PRD 明确不做）——不要横向扩多副本。
2. **模型为本地规则适配器**：错误诊断 / 对话 / 试卷识别是确定性规则模拟，非真实大模型（接真模型只需实现 remote 适配器 + Key）。
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
