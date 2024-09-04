import { Module } from '@nestjs/common';
import { Responder2Controller } from './responder-2.controller';

@Module({
  imports: [],
  controllers: [Responder2Controller],
})
export class Responder2Module {}
