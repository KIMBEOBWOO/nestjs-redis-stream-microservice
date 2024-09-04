import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { of } from 'rxjs';

@Controller()
export class Responder1Controller {
  @MessagePattern('stream-1')
  async consumeStream1(@Payload() data: any) {
    console.log('[stream-1] Respond Handler', data);

    return of({
      type: 'Responder 1',
      name: 'beobwoo',
      age: 27,
    });
  }

  @MessagePattern('stream-2')
  async consumeStream2(@Payload() data: any) {
    console.log('[stream-2] Respond Handler', data);

    return of([
      {
        type: 'Responder 1',
        idx: 1,
      },
      {
        type: 'Responder 1',
        name: 'beobwoo',
        idx: 2,
      },
    ]);
  }
}
