import { IncomingRequest, IncomingEvent } from '@nestjs/microservices';
import { CONNECT_EVENT, ERROR_EVENT } from '@nestjs/microservices/constants';
import { Redis } from 'ioredis';
import {
  RedisConnectionOptions,
  RedisInstance,
  RedisStreamRawMessagePayload,
  XReadGroupResponse,
} from '../common';

export class RedisStreamManager {
  protected redis: RedisInstance;

  protected constructor(option: RedisConnectionOptions) {
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

  close() {
    return this.redis.quit();
  }

  disconnect() {
    this.redis.disconnect();
  }

  async createConsumerGroup(stream: string, consumerGroup: string): Promise<void> {
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

  async deleteConsumerGroup(stream: string, consumerGroup: string): Promise<void> {
    await this.redis.xgroup('DESTROY', stream, consumerGroup);
  }

  async deleteConsumer(stream: string, consumerGroup: string, consumer: string): Promise<void> {
    await this.redis.xgroup('DELCONSUMER', stream, consumerGroup, consumer);
  }

  ack(incommingMessage: IncomingRequest | IncomingEvent, consumerGroup: string): Promise<number> {
    if (!('id' in incommingMessage)) return;
    const stream = incommingMessage.pattern;
    return this.redis.xack(stream, consumerGroup, incommingMessage.id);
  }

  add(stream: string, ...data: RedisStreamRawMessagePayload) {
    return this.redis.xadd(stream, '*', ...data);
  }

  async readGroup(
    consumerGroup: string,
    consumer: string,
    streams: string[],
    option = {
      block: 0,
      count: 1,
    },
  ): Promise<XReadGroupResponse | null | undefined> {
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
    ) as Promise<XReadGroupResponse | null | undefined>;
  }
}
