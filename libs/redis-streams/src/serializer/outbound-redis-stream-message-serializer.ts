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
    const data = [];

    if (this.isPrimitive(value)) {
      data.push('0');
      data.push(typeof value === 'string' ? value : JSON.stringify(value));
    } else if (this.isObject(value)) {
      data.push(
        ...Object.entries(value).reduce((acc, [key, val]) => {
          acc.push(key);
          acc.push(JSON.stringify(val));
          return acc;
        }, []),
      );
    }

    const header = this.getHeader(value, options);

    if (Object.keys(header).length > 0) {
      data.push(DEFAULT_LIB_MESSAGE_HEADER);
      data.push(JSON.stringify(header));
    }

    return data;
  }

  private getHeader(value: any, options?: OutboundRedisStreamMessageSerializationOption) {
    const header = {};
    if (options?.correlationId) {
      header['correlationId'] = options.correlationId;
    }

    if (Array.isArray(value)) {
      header['isArray'] = true;
    }

    if (this.isPrimitive(value)) {
      header['isPrimitive'] = true;
    }

    return header;
  }

  private isObject(value: any): boolean {
    return typeof value === 'object' && value !== null;
  }

  private isPrimitive(value: any): boolean {
    return (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    );
  }
}
