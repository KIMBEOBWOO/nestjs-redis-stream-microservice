import { Serializer } from '@nestjs/microservices';
import {
  DEFAULT_LIB_MESSAGE_HEADER,
  OutboundRedisStreamMessageSerializationOption,
  RedisStreamRawMessagePayload,
} from '../common';

export class OutboundRedisStreamMessageSerializer implements Serializer {
  serialize(
    value: any,
    options?: OutboundRedisStreamMessageSerializationOption,
  ): RedisStreamRawMessagePayload | Promise<RedisStreamRawMessagePayload> {
    const data = Object.entries(value).reduce((acc, [key, val]) => {
      acc.push(key);
      acc.push(JSON.stringify(val));
      return acc;
    }, []);

    const libHeader = {};
    if (options?.correlationId) {
      libHeader['correlationId'] = options.correlationId;
    }
    if (Array.isArray(value)) {
      libHeader['isArray'] = true;
    }

    if (Object.keys(libHeader).length > 0) {
      data.push(DEFAULT_LIB_MESSAGE_HEADER);
      data.push(JSON.stringify(libHeader));
    }

    return data;
  }
}
