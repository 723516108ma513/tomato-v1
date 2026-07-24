# Ubuntu 云端部署

这套部署只承载可选的账号、团队和学习房间服务。桌面端的任务、项目、番茄历史、AI 对话、长期记忆、模型密钥与 SQLite 数据库不会上传。

## 1. 服务器要求

- Ubuntu 22.04 或 24.04 LTS
- 2 核 CPU、2 GB 内存起步
- 已解析到服务器的域名
- Docker Engine 与 Docker Compose plugin
- 防火墙仅对外开放 22、80、443

当前仓库会启动 MySQL、Redis、Spring Boot 和 Nginx 四个容器。MySQL 与 Redis 只位于内部 Docker 网络，不向公网映射端口。

## 2. 准备环境

```bash
sudo apt update
sudo apt install -y ca-certificates curl git ufw
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

克隆代码后复制环境模板：

```bash
git clone https://github.com/723516108ma513/tomato-v1.git
cd tomato-v1
cp .env.example .env
chmod 600 .env
```

为数据库、Redis 和 JWT 分别生成不同的随机值：

```bash
openssl rand -base64 36
openssl rand -base64 36
openssl rand -base64 48
```

编辑 `.env`，替换所有示例值。`JWT_SECRET` 至少包含 32 个随机字节，部署后不要随意更换，否则现有登录会失效。

## 3. TLS 证书

Nginx 期望以下文件：

```text
deploy/certs/fullchain.pem
deploy/certs/privkey.pem
```

可以使用 Certbot 在宿主机申请证书，再复制或软链接到上述位置。首次申请时可暂时用仅监听 80 的 Nginx 配置完成 HTTP-01 验证，或使用 DNS-01 验证。

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d tomato.example.com
sudo cp /etc/letsencrypt/live/tomato.example.com/fullchain.pem deploy/certs/
sudo cp /etc/letsencrypt/live/tomato.example.com/privkey.pem deploy/certs/
sudo chown "$USER":"$USER" deploy/certs/*.pem
chmod 600 deploy/certs/privkey.pem
```

设置证书续期后，应在续期钩子中复制证书并执行 `docker compose exec nginx nginx -s reload`。

## 4. 启动与检查

```bash
docker compose config
docker compose build --pull
docker compose up -d
docker compose ps
docker compose logs --tail=100 server nginx
curl -fsS https://tomato.example.com/actuator/health
```

期望健康接口返回 `{"status":"UP"}`。Flyway 会在服务端启动时自动创建或升级业务表。

## 5. 构建桌面端

正式安装包必须在编译时写入云端地址，且必须使用 HTTPS：

```powershell
$env:TOMATO_CLOUD_SERVER_URL="https://tomato.example.com"
npm run tauri:build
```

该值由 Rust 编译进程序；React 不保存服务器地址，也不直接发起认证请求。发布给用户的是 `src-tauri/target/release/bundle/nsis/` 下的安装程序。

## 6. 更新、备份与回滚

更新：

```bash
git pull --ff-only
docker compose build --pull server
docker compose up -d
```

数据库备份：

```bash
docker compose exec -T mysql \
  mysqldump -u root -p"$DB_ROOT_PASSWORD" --single-transaction "$DB_NAME" \
  | gzip > "tomato-$(date +%F-%H%M).sql.gz"
```

恢复前先停止 `server`，并在独立环境验证备份。应用版本回滚时不要回滚已执行的 Flyway 数据库迁移；应发布向前兼容的修复迁移。

## 7. 生产安全清单

- `.env` 权限为 `600`，绝不提交真实密码。
- 只开放 80/443；MySQL、Redis、8080 不映射到公网。
- `RATE_LIMIT_FAIL_OPEN=false`，Redis 故障时认证与邀请码限流安全失败。
- Nginx 强制 HTTPS/WSS，并转发 WebSocket 的 `Authorization` 请求头。
- 日志不记录密码、Access Token、Refresh Token 或桌面端本地内容。
- 定期备份 MySQL 卷并实际演练恢复。
- 监控 `/actuator/health`、磁盘、证书到期时间与容器重启次数。

## 8. 常见故障

- `502 Bad Gateway`：检查 `server` 容器日志和 MySQL/Redis 健康状态。
- WebSocket 不连接：确认反向代理保留 `Upgrade`、`Connection` 和 `Authorization` 请求头。
- 桌面端只显示本地模式：确认安装包在构建时设置了 `TOMATO_CLOUD_SERVER_URL`。
- 登录全部失效：检查 `JWT_SECRET` 是否被改动，服务器时间是否正确。
- 邀请码请求返回安全服务不可用：生产环境 Redis 不可用时会按设计拒绝请求。
