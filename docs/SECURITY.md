# 安全设计

## 1. 密钥与 Token

- 密码使用 BCrypt。
- Access Token 使用服务端签名 JWT，默认 20 分钟。
- Refresh Token 使用高熵随机值，默认 30 天。
- MySQL 只保存 Refresh Token 的 SHA-256 哈希。
- 每次刷新轮换 Refresh Token，并撤销旧值。
- Access Token 只在 Rust 内存。
- Refresh Token 只在 Windows Credential Manager。
- AI API Key 使用现有 `Tomato Companion` 服务；登录凭证使用独立 `Tomato Companion Auth` 服务。

禁止把密码或 Token 写入 SQLite、localStorage、Zustand 持久化、环境示例、日志和 Git。

## 2. 授权

- 每个队伍和房间接口均从 JWT 获取当前用户。
- OWNER/MEMBER、HOST 和房间参与关系由 MySQL 查询确认。
- 前端隐藏按钮只改善体验，不构成授权。
- WebSocket 握手重复执行认证和成员校验。

## 3. 输入与滥用防护

- DTO 使用 Bean Validation。
- 密码、昵称、队伍名、介绍、房间名和请求体均限制长度。
- 登录和邀请码尝试使用 Redis 限流。
- Nginx 与 Spring Boot 同时限制请求体。
- 邀请码使用随机、不可预测、非连续值。
- 不配置宽泛的 `Access-Control-Allow-Origin: *`。

## 4. 日志

允许记录请求 ID、用户 ID、路径、状态、耗时、WebSocket 连接和房间状态变化。

禁止记录原始密码、完整 Token、JWT Secret、数据库密码、AI API Key、AI 对话和本地任务正文。

## 5. 生产检查

- HTTPS/WSS 证书有效且自动续期。
- JWT Secret 至少 32 字节随机值。
- MySQL、Redis、Spring Boot 不直接暴露公网。
- 生产环境关闭 Debug、SQL 参数日志、H2 Console、测试用户和 `ddl-auto` 自动建表。
- Actuator 只公开必要健康检查。
- 数据库按计划备份并验证恢复。
- 发布前运行依赖扫描、镜像扫描与密钥泄漏检查。
