import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS so our HTML client can connect
  app.enableCors({ origin: '*', methods: ['GET', 'POST'] });

  await app.listen(3000);
  console.log('🚀 Chat server running on http://localhost:3000');
  console.log('🔌 WebSocket gateway active on ws://localhost:3000/chat');
}
bootstrap();
