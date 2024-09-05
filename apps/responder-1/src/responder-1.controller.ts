import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { of } from 'rxjs';
import { v4 } from 'uuid';
import { Redis } from 'ioredis';

@Controller()
export class Responder1Controller {
  constructor(@Inject('IOREDIS') private redis: Redis) {}

  @MessagePattern('stream-1')
  async consumeStream1(@Payload() data: any) {
    console.log('[stream-1] Respond Handler', data);

    const response = Array.isArray(data)
      ? data
      : Object.keys(data).length === 0
        ? {}
        : {
            ...data,
            responder: 'Responder 1',
          };

    const key = 'stream-1-data/' + v4();
    await this.redis.set(key, JSON.stringify(response));

    return of(response);
  }
}
