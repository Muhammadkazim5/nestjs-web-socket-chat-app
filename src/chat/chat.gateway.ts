import {
  WebSocketGateway,       // Marks class as a WS gateway
  WebSocketServer,        // Injects the Socket.IO server instance
  SubscribeMessage,       // Maps an event name to a handler method
  MessageBody,            // Extracts message payload
  ConnectedSocket,        // Injects the individual client socket
  OnGatewayInit,          // Lifecycle hook: after gateway initialises
  OnGatewayConnection,    // Lifecycle hook: new client connects
  OnGatewayDisconnect,    // Lifecycle hook: client disconnects
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import * as SocketIO from 'socket.io';
import { ChatService } from './chat.service';
import { WsAuthGuard } from './guards/ws-auth.guard';
import {
  JoinRoomPayload,
  SendMessagePayload,
  TypingPayload,
} from './chat.types';

/**
 * ─── ChatGateway ──────────────────────────────────────────────────────────────
 *
 * Demonstrates ALL major WebSocket concepts in NestJS:
 *
 * 1. @WebSocketGateway()         – Registers the Socket.IO namespace
 * 2. @WebSocketServer            – Access to the raw Socket.IO Server
 * 3. @SubscribeMessage()         – Event-based message routing
 * 4. @MessageBody()              – Payload extraction
 * 5. @ConnectedSocket()          – Per-client socket injection
 * 6. OnGatewayInit               – Gateway lifecycle hooks
 * 7. OnGatewayConnection         – Client connect lifecycle
 * 8. OnGatewayDisconnect         – Client disconnect lifecycle
 * 9. Rooms (socket.join/leave)   – Scoped broadcasting
 * 10. Guards (@UseGuards)        – Authentication / validation
 * 11. ACK callbacks              – Client awaits server confirmation
 * 12. Broadcasting patterns      – to(), emit(), broadcast
 */
@WebSocketGateway({
  namespace: '/chat',   // Concept 1: dedicated namespace (vs default '/')
  cors: { origin: '*' },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  // ── Concept 2: @WebSocketServer – inject the Socket.IO server ──────────────
  @WebSocketServer()
  server: SocketIO.Server;

  constructor(private readonly chatService: ChatService) {}

  // ── Concept 6: OnGatewayInit lifecycle hook ────────────────────────────────
  afterInit(server: SocketIO.Server) {
    this.logger.log('✅ WebSocket Gateway initialised');
  }

  // ── Concept 7: OnGatewayConnection lifecycle hook ─────────────────────────
  handleConnection(client: SocketIO.Socket) {
    const username = (client.handshake.query.username as string) || `Guest_${client.id.slice(0, 4)}`;
    this.chatService.registerUser(client.id, username);

    this.logger.log(`🔗 Client connected: ${username} [${client.id}]`);

    // Send server stats to the newly connected client
    client.emit('server:stats', this.chatService.getStats());
  }

  // ── Concept 8: OnGatewayDisconnect lifecycle hook ─────────────────────────
  handleDisconnect(client: SocketIO.Socket) {
    const user = this.chatService.getUser(client.id);
    if (!user) return;

    // Auto-leave room on disconnect
    if (user.roomId) {
      const room = this.chatService.leaveRoom(client.id, user.roomId);
      if (room) {
        // Concept 12: broadcast to remaining room members
        const sysMsg = this.chatService.saveMessage(
          user.roomId, 'SYSTEM', 'System',
          `${user.username} has left the chat.`, 'system',
        );
        this.server.to(user.roomId).emit('room:message', sysMsg);
        this.server.to(user.roomId).emit('room:user-left', {
          username: user.username,
          roomId: user.roomId,
          memberCount: this.chatService.getRoomMemberCount(user.roomId),
          message: `${user.username} disconnected`,
        });
      }
    }

    this.chatService.removeUser(client.id);
    this.logger.log(`❌ Client disconnected: ${user.username} [${client.id}]`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // Each method below shows a distinct WebSocket concept.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Concept 3 + 4 + 5: @SubscribeMessage, @MessageBody, @ConnectedSocket
   * Concept 9: Rooms – socket.join()
   * Concept 11: ACK – return value is sent back as acknowledgement
   *
   * Client calls:  socket.emit('room:join', payload, (ack) => ...)
   */
  @SubscribeMessage('room:join')
  handleJoinRoom(
    @MessageBody() payload: JoinRoomPayload,
    @ConnectedSocket() client: SocketIO.Socket,
  ) {
    const { roomId, username } = payload;

    // Update username if provided
    const user = this.chatService.getUser(client.id);
    if (user && username) user.username = username;

    // Leave previous room first
    if (user?.roomId && user.roomId !== roomId) {
      this.handleLeaveRoom({ roomId: user.roomId }, client);
    }

    // Join the Socket.IO room (Concept 9)
    client.join(roomId);
    this.chatService.joinRoom(client.id, roomId);

    const memberCount = this.chatService.getRoomMemberCount(roomId);
    const displayName = user?.username ?? username;

    // Save & broadcast system message to room (Concept 12)
    const sysMsg = this.chatService.saveMessage(
      roomId, 'SYSTEM', 'System',
      `${displayName} joined the room.`, 'system',
    );
    this.server.to(roomId).emit('room:message', sysMsg);

    // Notify room of new member
    this.server.to(roomId).emit('room:user-joined', {
      username: displayName,
      roomId,
      memberCount,
      message: `${displayName} joined`,
    });

    // Send message history to joining user only
    client.emit('room:history', {
      roomId,
      messages: this.chatService.getRoomHistory(roomId),
    });

    this.logger.log(`${displayName} joined room: ${roomId}`);

    // ACK back to caller (Concept 11)
    return { success: true, roomId, memberCount };
  }

  /**
   * Concept 9: Rooms – socket.leave()
   * Concept 12: Targeted broadcast with server.to(roomId)
   */
  @SubscribeMessage('room:leave')
  handleLeaveRoom(
    @MessageBody() payload: { roomId: string },
    @ConnectedSocket() client: SocketIO.Socket,
  ) {
    const { roomId } = payload;
    const user = this.chatService.getUser(client.id);
    if (!user) return;

    client.leave(roomId);
    const room = this.chatService.leaveRoom(client.id, roomId);

    if (room) {
      const sysMsg = this.chatService.saveMessage(
        roomId, 'SYSTEM', 'System',
        `${user.username} left the room.`, 'system',
      );
      this.server.to(roomId).emit('room:message', sysMsg);
      this.server.to(roomId).emit('room:user-left', {
        username: user.username,
        roomId,
        memberCount: this.chatService.getRoomMemberCount(roomId),
        message: `${user.username} left`,
      });
    }

    return { success: true };
  }

  /**
   * Concept 3: @SubscribeMessage for message sending
   * Concept 12: server.to(roomId).emit() – broadcast to room only
   * Concept 10: @UseGuards – guard verifies user is in the room
   */
  @UseGuards(WsAuthGuard)   // Concept 10: Guards
  @SubscribeMessage('room:send-message')
  handleSendMessage(
    @MessageBody() payload: SendMessagePayload,
    @ConnectedSocket() client: SocketIO.Socket,
  ) {
    const { roomId, content } = payload;
    const user = this.chatService.getUser(client.id);

    if (!user) return { success: false, error: 'User not found' };
    if (!content?.trim()) return { success: false, error: 'Empty message' };

    const message = this.chatService.saveMessage(
      roomId, client.id, user.username, content.trim(),
    );

    // Broadcast to ALL clients in the room (including sender)
    this.server.to(roomId).emit('room:message', message);

    this.logger.log(`[${roomId}] ${user.username}: ${content.slice(0, 40)}`);

    // ACK to sender
    return { success: true, messageId: message.id };
  }

  /**
   * Concept 12: Broadcasting – typing indicator to others in room only
   * Uses client.to(roomId) instead of server.to() to EXCLUDE sender
   */
  @SubscribeMessage('room:typing')
  handleTyping(
    @MessageBody() payload: TypingPayload,
    @ConnectedSocket() client: SocketIO.Socket,
  ) {
    const { roomId, isTyping } = payload;
    const user = this.chatService.getUser(client.id);
    if (!user) return;

    // Broadcast to room EXCLUDING the sender (client.to vs server.to)
    client.to(roomId).emit('room:typing-indicator', {
      username: user.username,
      isTyping,
    });
  }

  /**
   * Private message – direct socket-to-socket communication
   * Demonstrates sending to a specific socket ID
   */
  @SubscribeMessage('user:private-message')
  handlePrivateMessage(
    @MessageBody() payload: { toSocketId: string; content: string },
    @ConnectedSocket() client: SocketIO.Socket,
  ) {
    const { toSocketId, content } = payload;
    const sender = this.chatService.getUser(client.id);
    if (!sender) return { success: false };

    const privateMsg = {
      from: sender.username,
      fromId: client.id,
      content,
      timestamp: new Date(),
    };

    // Send to specific socket only
    this.server.to(toSocketId).emit('user:private-message', privateMsg);
    this.logger.log(`DM from ${sender.username} → ${toSocketId}`);

    return { success: true };
  }

  /**
   * Get live server stats – demonstrates request/response pattern over WS
   */
  @SubscribeMessage('server:get-stats')
  handleGetStats() {
    return this.chatService.getStats();
  }

  /**
   * Ping/Pong – demonstrates round-trip latency measurement
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: SocketIO.Socket) {
    return { pong: true, serverTime: new Date().toISOString(), socketId: client.id };
  }
}
