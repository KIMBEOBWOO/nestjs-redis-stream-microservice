import { RedisStreamClientModule } from '@lib/redis-streams/module';
import { Module } from '@nestjs/common';
import { UseModule } from './use/use.module';

@Module({
  imports: [
    RedisStreamClientModule.registerAsync({
      useFactory: () => ({
        connection: {
          host: '127.0.0.1',
          port: 6388,
          password: 'beobwoo',
        },
      }),
    }),
    UseModule,
  ],
  providers: [],
})
export class Requestor2Module {}
