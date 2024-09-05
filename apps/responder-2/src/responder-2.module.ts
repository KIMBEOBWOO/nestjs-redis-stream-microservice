import { Module } from '@nestjs/common';
import { Responder2Controller } from './responder-2.controller';
import { Redis } from 'ioredis';

@Module({
  controllers: [Responder2Controller],
  providers: [
    {
      provide: 'IOREDIS',
      useFactory: () => {
        return new Redis({
          host: 'localhost',
          port: 6388,
          password: 'beobwoo',
        });
      },
    },
  ],
})
export class Responder2Module {}
