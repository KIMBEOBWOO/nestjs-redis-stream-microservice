import { Serializer } from '@nestjs/microservices';
import {
  OutboundRedisStreamMessageSerializationOption,
  RedisStreamMessageProperty,
} from '../common';

export class OutboundRedisStreamMessageSerializer implements Serializer {
  serialize(
    value: any,
    options?: OutboundRedisStreamMessageSerializationOption,
  ): RedisStreamMessageProperty[] | Promise<RedisStreamMessageProperty[]> {
    const data = Object.entries(value).reduce((acc, [key, val]) => {
      acc.push(key);
      acc.push(JSON.stringify(val));
      return acc;
    }, []);

    if (options?.correlationId) {
      data.push('correlationId');
      data.push(options.correlationId);
    }

    return data;
  }
}
