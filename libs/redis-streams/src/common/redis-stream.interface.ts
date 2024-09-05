/**
 * Redis Stream Raw Packet Payload Type
 * @example ['field1', 'value1', 'field2', 'value2', ...]
 */
export type RedisStreamRawMessagePayload = string[];

/**
 * Redis Stream Each Message Type
 * @example ['messageId', ['field1', 'value1', 'field2', 'value2', ...]]
 */
export type RedisStreamRawMessage = [string, RedisStreamRawMessagePayload];

/**
 * Redis Stream Packet Type
 * @example ['streamName', [['messageId', ['field1', 'value1', 'field2', 'value2', ...]]]]
 */
export type RedisStreamData = [string, RedisStreamRawMessage[]];

/**
 * ioredis XREADGROUP Response Type
 * @example [['streamName', [['messageId', ['field1', 'value1', 'field2', 'value2', ...]]]]
 */
export type XReadGroupResponse = RedisStreamData[];
