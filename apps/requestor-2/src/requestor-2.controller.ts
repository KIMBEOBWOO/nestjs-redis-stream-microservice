import { Controller, Get, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { timeout, firstValueFrom } from 'rxjs';

@Controller()
export class Requestor2Controller {
  constructor(
    @Inject('REDIS-STREAM-CLIENT')
    private readonly clientProxy: ClientProxy,
  ) {}

  @Get('test/emit')
  testEmit() {
    const data = {
      name: 'beobwoo',
      age: 27,
      profile: {
        company: 'bubblecloud.io',
        position: 'developer',
      },
    };

    setInterval(() => {
      console.log('Emitting data to stream-1 ', new Date().toLocaleTimeString());
      this.clientProxy.emit('stream-1', data);
    }, 1000);
  }

  @Get('test/send')
  async testSend() {
    const data = {
      type: 'SEND',
      name: 'beobwoo',
      age: 27,
      profile: {
        company: 'bubblecloud.io',
        position: 'developer',
      },
    };

    setInterval(async () => {
      const res$ = this.clientProxy.send('stream-1', data).pipe(timeout(10000));
      const res = await firstValueFrom(res$);
      console.log('Response from stream-1: ', res);
    }, 1000);
  }
}
