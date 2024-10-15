import { ConfigurableModuleBuilder } from '@nestjs/common';
import { RedisStreamClientModuleOptions } from '../common';

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE, ASYNC_OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<RedisStreamClientModuleOptions>().build();
