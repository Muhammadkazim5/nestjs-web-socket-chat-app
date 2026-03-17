import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  ChatMessage,
  Room,
  ConnectedUser,
} from './chat.types';

/**
 * ChatService manages all in-memory state:
 *  - connected users (socketId → ConnectedUser)
 *  - rooms          (roomId  → Room)
 *  - message history per room (last 50 messages kept)
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  // socketId → ConnectedUser
  private users = new Map<string, ConnectedUser>();

  // roomId → Room
  private rooms = new Map<string, Room>();

  // roomId → ChatMessage[]
  private messageHistory = new Map<string, ChatMessage[]>();

  // ─── User Management ───────────────────────────────────────────────────────

  registerUser(socketId: string, username: string): void {
    this.users.set(socketId, { socketId, username, roomId: null });
    this.logger.log(`User registered: ${username} (${socketId})`);
  }

  removeUser(socketId: string): ConnectedUser | undefined {
    const user = this.users.get(socketId);
    this.users.delete(socketId);
    if (user) this.logger.log(`User removed: ${user.username} (${socketId})`);
    return user;
  }

  getUser(socketId: string): ConnectedUser | undefined {
    return this.users.get(socketId);
  }

  getAllUsers(): ConnectedUser[] {
    return Array.from(this.users.values());
  }

  // ─── Room Management ───────────────────────────────────────────────────────

  /**
   * Creates room if it doesn't exist, adds the socket to it,
   * updates the user's current roomId, and returns the room.
   */
  joinRoom(socketId: string, roomId: string): Room {
    // Ensure room exists
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, { id: roomId, name: roomId, members: new Set() });
      this.messageHistory.set(roomId, []);
      this.logger.log(`Room created: ${roomId}`);
    }

    const room = this.rooms.get(roomId)!;
    room.members.add(socketId);

    // Update user's current room
    const user = this.users.get(socketId);
    if (user) user.roomId = roomId;

    this.logger.log(`${socketId} joined room ${roomId} (${room.members.size} members)`);
    return room;
  }

  leaveRoom(socketId: string, roomId: string): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    room.members.delete(socketId);

    // Clean up empty rooms
    if (room.members.size === 0) {
      this.rooms.delete(roomId);
      this.messageHistory.delete(roomId);
      this.logger.log(`Room deleted (empty): ${roomId}`);
    }

    const user = this.users.get(socketId);
    if (user) user.roomId = null;

    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getRoomMemberCount(roomId: string): number {
    return this.rooms.get(roomId)?.members.size ?? 0;
  }

  // ─── Message Management ────────────────────────────────────────────────────

  /**
   * Saves a message to the room's history (capped at 50).
   */
  saveMessage(
    roomId: string,
    senderId: string,
    senderName: string,
    content: string,
    type: 'text' | 'system' = 'text',
  ): ChatMessage {
    const message: ChatMessage = {
      id: uuidv4(),
      roomId,
      senderId,
      senderName,
      content,
      timestamp: new Date(),
      type,
    };

    const history = this.messageHistory.get(roomId) ?? [];
    history.push(message);

    // Keep only last 50 messages
    if (history.length > 50) history.shift();

    this.messageHistory.set(roomId, history);
    return message;
  }

  getRoomHistory(roomId: string): ChatMessage[] {
    return this.messageHistory.get(roomId) ?? [];
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  getStats() {
    return {
      connectedUsers: this.users.size,
      activeRooms: this.rooms.size,
      rooms: Array.from(this.rooms.entries()).map(([id, r]) => ({
        id,
        memberCount: r.members.size,
        messageCount: this.messageHistory.get(id)?.length ?? 0,
      })),
    };
  }
}
