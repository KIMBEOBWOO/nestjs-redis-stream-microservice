import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Requestor1Module } from './requestor-1.module';

async function bootstrap() {
  const app = await NestFactory.create(Requestor1Module);
  app.enableShutdownHooks();
  await app.listen(3081);
  Logger.debug('[REQ 1] is running on http://localhost:3081');
}
bootstrap();
