import { RedisStreamServer } from '@lib/redis-streams';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Responder2Module } from './responder-2.module';

async function bootstrap() {
  const app = await NestFactory.create(Responder2Module);

  app.connectMicroservice({
    strategy: new RedisStreamServer({
      connection: {
        host: '127.0.0.1',
        port: 6388,
        password: 'beobwoo',
      },
      option: {
        consumerGroup: 'test-app',
      },
    }),
  });
  app.enableShutdownHooks();

  Logger.debug('[RES 2] is running on http://localhost:3083');

  await app.startAllMicroservices();
  await app.listen(3083);
}
bootstrap();
