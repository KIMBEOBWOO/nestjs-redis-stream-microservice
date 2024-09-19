import { RedisStreamServer } from '@lib/redis-streams';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Responder1Module } from './responder-1.module';

async function bootstrap() {
  const app = await NestFactory.create(Responder1Module);

  app.connectMicroservice({
    strategy: new RedisStreamServer({
      connection: {
        host: '127.0.0.1',
        port: 6388,
        password: 'beobwoo',
      },
      inbound: {
        consumerGroup: 'responder',
        consumer: 'responder-1',
        deleteConsumerOnClose: true,
      },
      outbound: {
        stream: 'response-stream',
      },
    }),
  });
  app.enableShutdownHooks();

  Logger.debug('[RES 1] is running on http://localhost:3080');

  await app.startAllMicroservices();
  await app.listen(3080);
}
bootstrap();
