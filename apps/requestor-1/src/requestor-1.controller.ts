import { Controller, Get, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

@Controller()
export class Requestor1Controller {
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

    console.log('Emitting data to stream-1 ', new Date().toLocaleTimeString());
    this.clientProxy.emit('stream-1', data);
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

    const res$ = this.clientProxy.send('stream-1', data).pipe(timeout(10000));
    const res = await firstValueFrom(res$);
    return res;
  }

  @Get('test/send/stream')
  async testSendStream() {
    const data = {
      type: 'SEND',
      name: 'beobwoo',
      age: 27,
      profile: {
        company: 'bubblecloud.io',
        position: 'developer',
      },
    };

    console.log('Sending data to stream-2', new Date().toLocaleTimeString());
    const res$ = this.clientProxy.send('stream-2', data).pipe(timeout(10000));
    const res = await firstValueFrom(res$);

    return res;
  }
}
