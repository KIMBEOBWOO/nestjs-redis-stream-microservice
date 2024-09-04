import { IncomingRequest, IncomingEvent } from '@nestjs/microservices';
import { CONNECT_EVENT, ERROR_EVENT } from '@nestjs/microservices/constants';
import { Redis } from 'ioredis';
import {
  RedisConnectionOptions,
  RedisInstance,
  RedisStreamMessageProperty,
  XReadGroupRawResult,
} from '../common';

export class RedisStreamManager {
  private redis: RedisInstance;

  private constructor(option: RedisConnectionOptions) {
    this.redis = new Redis(option);
  }

  static init(option: RedisConnectionOptions): RedisStreamManager {
    return new RedisStreamManager(option);
  }

  onConnect(callback: () => void) {
    this.redis.on(CONNECT_EVENT, () => {
      callback();
    });
  }

  onError(callback: (error: Error) => void) {
    this.redis.on(ERROR_EVENT, (error: Error) => {
      callback(error);
    });
  }

  async close() {
    return this.redis.quit();
  }

  disconnect() {
    this.redis.disconnect();
  }

  public async createConsumerGroup(stream: string, consumerGroup: string): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', stream, consumerGroup, '$', 'MKSTREAM');
    } catch (e) {
      if (
        e instanceof Error &&
        e.message.includes('BUSYGROUP Consumer Group name already exists')
      ) {
        return;
      }
      throw e;
    }
  }

  public ack(
    incommingMessage: IncomingRequest | IncomingEvent,
    consumerGroup: string,
  ): Promise<number> {
    if (!('id' in incommingMessage)) return;
    const stream = incommingMessage.pattern;
    return this.redis.xack(stream, consumerGroup, incommingMessage.id);
  }

  public add(stream: string, ...data: RedisStreamMessageProperty[]) {
    return this.redis.xadd(stream, '*', ...data);
  }

  public async readGroup(
    consumerGroup: string,
    consumer: string,
    streams: string[],
    option = {
      block: 0,
      count: 1,
    },
  ): Promise<XReadGroupRawResult | null | undefined> {
    return this.redis.xreadgroup(
      'GROUP',
      consumerGroup,
      consumer,
      'COUNT',
      option.count,
      'BLOCK',
      option.block,
      'STREAMS',
      ...streams,
      ...streams.map(() => '>'),
    ) as Promise<XReadGroupRawResult | null | undefined>;
  }
}
