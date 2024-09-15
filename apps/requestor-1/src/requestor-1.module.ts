import { RedisStreamClient } from '@lib/redis-streams';
import { Module } from '@nestjs/common';
import { Requestor1Controller } from './requestor-1.controller';

@Module({
  controllers: [Requestor1Controller],
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
          inboundStream: {
            stream: 'response-stream',
            consumerGroup: 'requestor-2',
            consumer: 'requestor',
          },
        });
      },
    },
  ],
})
export class Requestor1Module {}
