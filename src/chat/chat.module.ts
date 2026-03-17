import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { WsAuthGuard } from './guards/ws-auth.guard';

@Module({
  providers: [ChatGateway, ChatService, WsAuthGuard],
  exports: [ChatService],
})
export class ChatModule {}
