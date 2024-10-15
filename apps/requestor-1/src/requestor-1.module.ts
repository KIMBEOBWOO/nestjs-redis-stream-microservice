import { RedisStreamClientModule } from '@lib/redis-streams/module';
import { Module } from '@nestjs/common';
import { Requestor1Controller } from './requestor-1.controller';

@Module({
  imports: [
    RedisStreamClientModule.register({
      connection: {
        host: '127.0.0.1',
        port: 6388,
        password: 'beobwoo',
      },
    }),
  ],
  controllers: [Requestor1Controller],
  providers: [],
})
export class Requestor1Module {}
