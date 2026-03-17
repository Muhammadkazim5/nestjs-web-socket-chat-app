import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import * as SocketIO from 'socket.io';
import { ChatService } from '../chat.service';

/**
 * WsAuthGuard – Concept 10: WebSocket Guards
 *
 * Guards in NestJS WebSockets work similarly to HTTP guards but receive
 * an ExecutionContext that wraps the Socket instance.
 *
 * This guard verifies:
 *  1. The connecting socket has a registered user
 *  2. The user is actually a member of the room they're messaging in
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(private readonly chatService: ChatService) {}

  canActivate(context: ExecutionContext): boolean {
    // Switch context to WebSocket to get the socket & data
    const client: SocketIO.Socket = context.switchToWs().getClient<SocketIO.Socket>();
    const data = context.switchToWs().getData<{ roomId: string }>();

    const user = this.chatService.getUser(client.id);

    // Check 1: user must be registered (connected)
    if (!user) {
      this.logger.warn(`Guard rejected unknown socket: ${client.id}`);
      throw new WsException('Unauthorised: unknown user');
    }

    // Check 2: user must be in the room they're trying to post to
    if (data?.roomId && user.roomId !== data.roomId) {
      this.logger.warn(
        `Guard rejected ${user.username}: not in room ${data.roomId}`,
      );
      throw new WsException(`Unauthorised: you are not in room ${data.roomId}`);
    }

    return true;
  }
}
