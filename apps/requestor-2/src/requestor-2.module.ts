import { RedisStreamClientModule } from '@lib/redis-streams/module';
import { Module } from '@nestjs/common';
import { UseModule } from './use/use.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.test'],
    }),
    RedisStreamClientModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('HOST'),
          port: configService.get('PORT'),
          password: configService.get('PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    UseModule,
  ],
  providers: [],
})
export class Requestor2Module {}
