// ─── Shared Types ────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'system';
}

export interface Room {
  id: string;
  name: string;
  members: Set<string>; // socket IDs
}

export interface ConnectedUser {
  socketId: string;
  username: string;
  roomId: string | null;
}

// ─── Client → Server Payloads ────────────────────────────────────────────────

export interface JoinRoomPayload {
  roomId: string;
  username: string;
}

export interface SendMessagePayload {
  roomId: string;
  content: string;
}

export interface TypingPayload {
  roomId: string;
  isTyping: boolean;
}

// ─── Server → Client Payloads ────────────────────────────────────────────────

export interface UserJoinedPayload {
  username: string;
  roomId: string;
  memberCount: number;
  message: string;
}

export interface UserLeftPayload {
  username: string;
  roomId: string;
  memberCount: number;
  message: string;
}

export interface TypingIndicatorPayload {
  username: string;
  isTyping: boolean;
}

export interface RoomHistoryPayload {
  roomId: string;
  messages: ChatMessage[];
}
