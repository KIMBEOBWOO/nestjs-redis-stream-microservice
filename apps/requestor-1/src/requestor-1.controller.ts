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
    const data = [
      {
        name: 'A',
        age: 27,
        profile: {
          position: 'dev',
        },
      },
      {
        name: 'B',
        profile: {
          position: 'dev',
        },
      },
    ];

    console.log('Emitting data to stream-1 ', new Date().toLocaleTimeString());
    this.clientProxy.emit('stream-1', data);
  }

  @Get('test/send')
  async testSend() {
    const data = {
      // type: 'SEND',
      // name: 'beobwoo',
      // age: 27,
      // profile: {
      //   company: 'bubblecloud.io',
      //   position: 'developer',
      // },
      0: 'type',
      1: 'SEND',
      2: {
        0: 'name',
        1: 'beobwoo',
        2: 'age',
        3: 27,
        4: {
          0: 'company',
          1: 'bubblecloud.io',
          2: 'position',
          3: 'developer',
        },
      },
    };

    const res$ = this.clientProxy.send('stream-1', data).pipe(timeout(10000));
    const res = await firstValueFrom(res$);
    return res;
  }

  @Get('test/send/stream')
  async testSendArray() {
    const data = [
      {
        idx: 1,
        type: 'SEND',
        name: 'beobwoo',
        age: 27,
        profile: {
          company: 'bubblecloud.io',
          position: 'developer',
        },
      },
      {
        idx: 2,
        type: 'SEND',
        name: 'beobwoo',
        age: 27,
        profile: {
          company: 'bubblecloud.io',
          position: 'developer',
        },
      },
    ];

    console.log('Sending data to stream-2', new Date().toLocaleTimeString());
    const res$ = this.clientProxy.send('stream-2', data).pipe(timeout(10000));
    const res = await firstValueFrom(res$);

    console.log('Received data from stream-2', res);

    return res;
  }
}
