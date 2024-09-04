import { Module } from '@nestjs/common';
import { Responder1Controller } from './responder-1.controller';

@Module({
  imports: [],
  controllers: [Responder1Controller],
})
export class Responder1Module {}
