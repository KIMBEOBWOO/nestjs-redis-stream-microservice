import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { of } from 'rxjs';

@Controller()
export class Responder2Controller {
  @MessagePattern('stream-1')
  async consumeStream1(@Payload() data: any) {
    console.log('[stream-1] Respond Handler', data);

    return of({
      type: 'Responder 2',
      name: 'beobwoo',
      age: 27,
    });
  }
}
