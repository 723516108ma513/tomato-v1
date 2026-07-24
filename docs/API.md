# 云端 HTTP API

统一前缀：`/api/v1`

所有响应包含 `success` 和 `timestamp`。成功响应使用 `data`，失败响应使用稳定的 `code` 与可读 `message`。

## 1. 认证

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| POST | `/auth/register` | 否 | 邮箱、密码、昵称注册 |
| POST | `/auth/login` | 否 | 登录并签发 Token |
| POST | `/auth/refresh` | Refresh Token | 轮换 Token |
| POST | `/auth/logout` | Access Token | 撤销当前 Refresh Token |
| GET | `/users/me` | Access Token | 当前用户 |
| PATCH | `/users/me` | Access Token | 修改昵称 |

密码最少 8 个字符，最长 72 个 UTF-8 字节。邮箱保存前转为小写并去除两端空格。React 不根据中文消息判断错误。

主要错误码：

- `VALIDATION_ERROR`
- `EMAIL_ALREADY_EXISTS`
- `INVALID_CREDENTIALS`
- `ACCESS_TOKEN_EXPIRED`
- `INVALID_ACCESS_TOKEN`
- `INVALID_REFRESH_TOKEN`
- `REFRESH_TOKEN_REUSED`
- `AUTHENTICATION_REQUIRED`
- `RATE_LIMITED`

## 2. 队伍

| 方法 | 路径 | 最低权限 |
| --- | --- | --- |
| POST | `/teams` | 已登录 |
| GET | `/teams` | 已登录 |
| GET | `/teams/{teamId}` | MEMBER |
| PATCH | `/teams/{teamId}` | OWNER |
| DELETE | `/teams/{teamId}` | OWNER |
| POST | `/teams/join` | 已登录 |
| POST | `/teams/{teamId}/leave` | MEMBER |
| DELETE | `/teams/{teamId}/members/{userId}` | OWNER |
| POST | `/teams/{teamId}/invite-code/rotate` | OWNER |

邀请码统一转为大写，使用不易混淆的字符集，重新生成后旧邀请码立即失效。服务端对加入尝试限流。

主要错误码：

- `TEAM_NOT_FOUND`
- `TEAM_ACCESS_DENIED`
- `TEAM_OWNER_REQUIRED`
- `ALREADY_TEAM_MEMBER`
- `INVALID_INVITE_CODE`
- `OWNER_CANNOT_LEAVE`

## 3. 学习房间

| 方法 | 路径 | 最低权限 |
| --- | --- | --- |
| POST | `/teams/{teamId}/rooms` | MEMBER |
| GET | `/teams/{teamId}/rooms/active` | MEMBER |
| GET | `/rooms/{roomId}` | MEMBER |
| POST | `/rooms/{roomId}/join` | MEMBER |
| POST | `/rooms/{roomId}/leave` | MEMBER |
| PUT | `/rooms/{roomId}/ready` | 房间成员 |
| POST | `/rooms/{roomId}/start` | HOST |
| POST | `/rooms/{roomId}/cancel` | HOST |
| GET | `/rooms/{roomId}/sessions` | MEMBER |

客户端提交的用户 ID、`isHost`、角色和完成状态一律不可信。服务端从 JWT 和数据库关系决定身份与权限。

主要错误码：

- `ACTIVE_ROOM_ALREADY_EXISTS`
- `ROOM_NOT_FOUND`
- `ROOM_NOT_JOINED`
- `ROOM_HOST_REQUIRED`
- `ROOM_NOT_WAITING`
- `ROOM_MEMBER_NOT_READY`
- `ACTIVE_SESSION_ALREADY_EXISTS`

## 4. 分页、时间与请求 ID

- 时间统一使用 UTC ISO-8601。
- 列表接口后续统一使用 `page`、`size`，第一版队伍列表可返回完整小集合。
- 客户端可发送 `X-Request-Id`，服务端也会生成并在响应头返回。
- 日志只记录请求 ID、用户 ID、路径、状态和耗时，不记录密码或 Token。
