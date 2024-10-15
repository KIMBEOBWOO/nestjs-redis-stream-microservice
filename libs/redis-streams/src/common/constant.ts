export const DEFAULT_LIB_MESSAGE_HEADER = 'x-nestjs-redis-stream-header';

export const DEFAULT_LIB_RESPONSE_STREAM = 'x-nestjs-redis-stream-response';

export const REDIS_STREAM_CLIENT_TOKEN = Symbol('x-nestjs-redis-stream/REDIS_STREAM_CLIENT_TOKEN');

export const getRedisStreamClientToken = () => REDIS_STREAM_CLIENT_TOKEN;
