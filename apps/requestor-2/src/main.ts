import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Requestor2Module } from './requestor-2.module';

async function bootstrap() {
  const app = await NestFactory.create(Requestor2Module);
  await app.listen(3082);
  Logger.debug('[REQ 2] is running on http://localhost:3082');
}
bootstrap();
