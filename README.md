# NestJS WebSocket Chat App

Real-time chat demonstrating every major WebSocket concept in NestJS + Socket.IO.

## Quick Start

```bash
npm install
npm run start:dev
```

Then open your browser at **http://localhost:3000**

The client UI is served automatically — no separate setup needed.

---

## Project Structure

```
src/
├── main.ts                     # Bootstrap + CORS
├── app.module.ts               # ServeStatic + ChatModule
└── chat/
    ├── chat.types.ts           # Shared TS interfaces
    ├── chat.service.ts         # In-memory state (users/rooms/messages)
    ├── chat.gateway.ts         # ★ All 12 WebSocket concepts
    ├── chat.module.ts
    └── guards/
        └── ws-auth.guard.ts    # WebSocket Guard

public/
└── index.html                  # Interactive client (auto-served)
```

---

## WebSocket Concepts Covered

| # | Concept | File |
|---|---------|------|
| 1 | `@WebSocketGateway({ namespace })` | chat.gateway.ts |
| 2 | `@WebSocketServer()` inject Server | chat.gateway.ts |
| 3 | `@SubscribeMessage('event')` routing | chat.gateway.ts |
| 4 | `@MessageBody()` payload extraction | chat.gateway.ts |
| 5 | `@ConnectedSocket()` client socket | chat.gateway.ts |
| 6 | `OnGatewayInit` lifecycle hook | chat.gateway.ts |
| 7 | `OnGatewayConnection` hook | chat.gateway.ts |
| 8 | `OnGatewayDisconnect` hook | chat.gateway.ts |
| 9 | Rooms — `socket.join/leave` | chat.gateway.ts |
| 10 | `@UseGuards(WsAuthGuard)` | ws-auth.guard.ts |
| 11 | ACK callbacks | chat.gateway.ts |
| 12 | Broadcast patterns (`server.to`, `client.to`) | chat.gateway.ts |

---

## Testing

1. `npm run start:dev`
2. Open **http://localhost:3000** in two browser tabs
3. Use different usernames, join the same room
4. Watch the **Event Log** at the bottom of each tab
5. Try the typing indicator, Ping, and DM features
