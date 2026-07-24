# 学习房间 WebSocket

## 1. 地址与认证

```text
wss://api.example.com/ws/v1/rooms/{roomId}
```

生产环境只允许 WSS。优先在握手阶段传入：

```text
Authorization: Bearer <access-token>
```

Token 不放在 URL Query。服务端在握手阶段验证 JWT、用户、队伍成员关系和房间权限。

## 2. 事件封装

```json
{
  "type": "ROOM_STATE_SYNC",
  "eventId": "uuid",
  "roomId": "uuid",
  "data": {},
  "timestamp": "2026-07-23T10:00:00Z"
}
```

事件类型：

- `ROOM_STATE_SYNC`
- `ROOM_MEMBER_JOINED`
- `ROOM_MEMBER_LEFT`
- `ROOM_MEMBER_ONLINE`
- `ROOM_MEMBER_OFFLINE`
- `ROOM_MEMBER_READY_CHANGED`
- `ROOM_SESSION_STARTED`
- `ROOM_SESSION_FINISHED`
- `ROOM_CANCELLED`
- `PING`
- `PONG`
- `ERROR`

`ROOM_STATE_SYNC` 必须包含房间状态、成员列表、当前 Session、`serverTime` 和当前用户权限，是连接与重连后的完整真源。

## 3. 断线重连

1. Rust 检测断开并通知 `cloud://connection-state`。
2. 使用带抖动的指数退避，最大间隔 30 秒。
3. 如 Access Token 接近过期，先使用 Refresh Token 刷新。
4. 使用新 Access Token 重新握手。
5. 服务端立即返回 `ROOM_STATE_SYNC`。
6. 客户端使用 `serverTime` 与 `endTime` 恢复倒计时。
7. 用户主动退出时取消任务并停止重连。

同一时刻 Rust 只保留一个房间 WebSocket 任务。React 监听器只在 Store 初始化时注册一次，并在应用卸载时取消。

## 4. 心跳与在线状态

- 客户端每 25 秒发送 `PING`。
- 服务端回复 `PONG` 并刷新 Redis 在线 TTL。
- 在线 TTL 建议 75 秒。
- Redis 丢失后可暂时显示未知/离线，但不改变 MySQL 房间、Session 与完成记录。

## 5. Tauri 事件

Rust 向 React 发送：

- `cloud://room-event`
- `cloud://connection-state`
- `cloud://auth-expired`
- `cloud://server-error`

事件中不得包含 Access Token、Refresh Token 或本地任务正文。
