import { DynamicModule, Module } from '@nestjs/common';
import { getRedisStreamClientToken } from '../common';
import { RedisStreamClient } from '../requestor';
import {
  ConfigurableModuleClass,
  ASYNC_OPTIONS_TYPE,
  OPTIONS_TYPE,
  MODULE_OPTIONS_TOKEN,
} from './redis-client.module-definition';

@Module({
  providers: [],
  exports: [],
})
export class RedisStreamClientModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const module = super.register(options);
    const redisClientToken = getRedisStreamClientToken();

    module.providers.push({
      provide: redisClientToken,
      useFactory: () => new RedisStreamClient(options),
    });

    return {
      ...module,
      exports: [redisClientToken],
      global: true,
    };
  }

  static registerAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    const module = super.registerAsync(options);
    const redisClientToken = getRedisStreamClientToken();

    if (!(options.useExisting || options.useFactory || options.useClass)) {
      throw new Error('Invalid configuration. Must provide useFactory, useClass or useExisting');
    }

    if (options.useFactory) {
      module.providers.push({
        provide: redisClientToken,
        useFactory: async (option: any) => {
          return new RedisStreamClient(option);
        },
        inject: [MODULE_OPTIONS_TOKEN],
      });
    } else {
      const inject = options.useClass
        ? [options.useClass]
        : options.useExisting
          ? [options.useExisting]
          : [];

      module.providers.push({
        provide: redisClientToken,
        useFactory: async (optionsFactory: any) => {
          return new RedisStreamClient(await optionsFactory.create());
        },
        inject: inject,
      });
    }

    return {
      ...module,
      exports: [redisClientToken],
      global: true,
    };
  }
}
