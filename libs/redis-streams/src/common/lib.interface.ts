import * as Redis from 'ioredis';
import { Serializer, Deserializer, IncomingRequest } from '@nestjs/microservices';

export type RedisInstance = Redis.Redis;

export type RedisConnectionOptions = Redis.RedisOptions;

interface RedisStreamOptions {
  block?: number;
  consumerGroup: string;
  consumer: string;
  deleteMessagesAfterAck?: boolean;
}

interface SerializerOptions {
  serializer?: Serializer;
  deserializer?: Deserializer;
}

export interface ConstructorOptions extends SerializerOptions {
  connection: RedisConnectionOptions;
  streams: RedisStreamOptions;
}

export interface ClientConstructorOptions extends Pick<ConstructorOptions, 'connection'> {}

export interface RedisStreamIncommingRequest extends IncomingRequest {
  correlationId?: string;
}

export interface OutboundRedisStreamMessageSerializationOption {
  correlationId?: string;
}
