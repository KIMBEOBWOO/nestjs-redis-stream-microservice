import { RedisStreamClient } from '@lib/redis-streams';
import { Module } from '@nestjs/common';
import { Requestor2Controller } from './requestor-2.controller';

@Module({
  controllers: [Requestor2Controller],
  providers: [
    {
      provide: 'REDIS-STREAM-CLIENT',
      useFactory: () => {
        return new RedisStreamClient({
          connection: {
            host: '127.0.0.1',
            port: 6388,
            password: 'beobwoo',
          },
        });
      },
    },
  ],
})
export class Requestor2Module {}
