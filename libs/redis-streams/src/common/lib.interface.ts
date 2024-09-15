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

interface InboundRedisStreamOptions {
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
   * consumer name
   * @see [redis-stream](https://redis.io/docs/latest/develop/data-types/streams/#consumer-groups)
   * - should be unique within the consumer group, even if the distributed nestjs application is running multiple instances
   */
  consumer: string;
  /**
   * delete messages after ack
   * @see [xack](https://redis.io/docs/latest/commands/xack/)
   * - if true, messages will be deleted after they are acknowledged
   * - if false, messages will not be deleted after they are acknowledged, developer will have to manually delete the messages
   */
  deleteMessagesAfterAck?: boolean;
}

interface OutboundRedisStreamOptions {
  /**
   * stream name
   * @see [redis-stream](https://redis.io/docs/latest/develop/data-types/streams/)
   */
  stream: string;
}

interface ClientInboundRedisStreamOptions
  extends InboundRedisStreamOptions,
    OutboundRedisStreamOptions {}

export interface ServerConstructorOptions extends ConstructorOptions {
  /**
   * Settings for the request stream that the server is listening to
   */
  inboundStream: InboundRedisStreamOptions;
  /**
   * Response stream settings for which the server will return data
   */
  outboundStream: OutboundRedisStreamOptions;
}

export interface ClientConstructorOptions extends ConstructorOptions {
  /**
   * Settings for streams that the server responded to
   */
  inboundStream: ClientInboundRedisStreamOptions;
}

export interface RedisStreamIncommingRequest extends IncomingRequest {
  correlationId?: string;
}

export interface OutboundRedisStreamMessageSerializationOption {
  correlationId?: string;
}
