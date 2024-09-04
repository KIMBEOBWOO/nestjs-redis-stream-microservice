import { CONNECT_EVENT, ERROR_EVENT } from '@nestjs/microservices/constants';
import { Redis } from 'ioredis';
import { RedisConnectionOptions, RedisInstance } from './interface';

export type OnConnectCallback = () => void;
export type OnErrorCallback = (error: Error) => void;

export class RedisStreamManager {
  public redis: RedisInstance;

  private constructor(option: RedisConnectionOptions) {
    this.redis = new Redis(option);
  }

  static init(
    option: RedisConnectionOptions,
    onConnectCallback?: OnConnectCallback,
    OnErrorCallback?: OnErrorCallback,
  ) {
    const manager = new RedisStreamManager(option);

    if (onConnectCallback) {
      manager.onConnect(onConnectCallback);
    }

    if (OnErrorCallback) {
      manager.onError(OnErrorCallback);
    }

    return manager;
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
}
