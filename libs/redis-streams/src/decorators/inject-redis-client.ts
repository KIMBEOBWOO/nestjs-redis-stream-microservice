import { Inject } from '@nestjs/common';
import { getRedisStreamClientToken } from '../common';

/**
 * Injects the Redis Stream Client
 * @example `@InjectRedisStreamClient() private readonly client: ClientProxy`
 */
export const InjectRedisStreamClient = () => Inject(getRedisStreamClientToken());
