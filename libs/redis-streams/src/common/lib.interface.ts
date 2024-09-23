import * as Redis from 'ioredis';
import { IncomingRequest } from '@nestjs/microservices';

export type RedisInstance = Redis.Redis;
export type RedisConnectionOptions = Redis.RedisOptions;

export interface ConstructorOptions {
  /**
   * Redis instance connection options
   */
  connection: RedisConnectionOptions;
}

export interface ConsumerOption {
  /**
   * block time in milliseconds
   * - 0: block infinitely
   * - $number: block for $number milliseconds
   *
   * @description
   * if not provided, it will default to 0 (block infinitely)
   * block time is used to wait for new messages to arrive in the stream, if no new messages arrive within the block time,
   * the consumer will wait recursively for new messages to arrive
   */
  block?: number;
  /**
   * consumer group name
   * @see [redis-stream](https://redis.io/docs/latest/develop/data-types/streams/#consumer-groups)
   */
  consumerGroup: string;
  /**
   * delete consumer group on close
   * - if true, the consumer group will be deleted when the server is closed
   * - if false, the consumer group will not be deleted when the server is closed (manual deletion is required)
   * @default true
   */
  deleteConsumerGroupOnClose?: boolean;
  /**
   * delete consumer on close
   * - if true, the consumer will be deleted when the server is closed
   * - if false, the consumer will not be deleted when the server is closed (manual deletion is required)
   * @default true
   */
  deleteConsumerOnClose?: boolean;
}

export interface ClientConsumerOption extends ConsumerOption {
  consumer: string;
}

export interface ServerConsumerOption extends ConsumerOption {
  consumer: string;
}

export interface ServerConstructorOptions extends ConstructorOptions {
  option: ConsumerOption;
}

export interface ClientConstructorOptions extends ConstructorOptions {
  option?: Pick<ConsumerOption, 'block'>;
}

export interface RedisStreamIncommingRequest extends IncomingRequest {
  correlationId?: string;
}

export interface OutboundRedisStreamMessageSerializationOption {
  correlationId?: string;
}
