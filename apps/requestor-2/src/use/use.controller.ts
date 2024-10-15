import { InjectRedisStreamClient } from '@lib/redis-streams';
import { Body, Controller, Param, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { timeout } from 'rxjs';

@Controller()
export class UseController {
  constructor(
    @InjectRedisStreamClient()
    private readonly clientProxy: ClientProxy,
  ) {}

  @Post('test/emit/:stream')
  emit(@Body() data: any, @Param('stream') stream?: string) {
    console.log('Emitting data to stream-1 ', new Date().toLocaleTimeString());
    const reqStream = stream || 'stream-1';
    this.clientProxy.emit(reqStream, data);
  }

  @Post('test/send/:stream')
  send(@Body() data: any, @Param('stream') stream?: string) {
    console.log('Sending data to stream-1 ', new Date().toLocaleTimeString());
    const reqStream = stream || 'stream-1';
    return this.clientProxy.send(reqStream, data).pipe(timeout(1000));
  }
}
