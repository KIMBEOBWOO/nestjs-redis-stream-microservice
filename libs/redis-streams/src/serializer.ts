import { Deserializer, Serializer } from '@nestjs/microservices';
import {
  OutboundRedisStreamMessageSerializationOption,
  RedisStreamIncommingRequest,
} from './interface';
import {
  RedisStreamData,
  RedisStreamMessage,
  RedisStreamMessageProperty,
} from './redis-stream.interface';

export class InboundRedisStreamMessageDeserializer implements Deserializer {
  deserialize(
    value: RedisStreamData,
  ): RedisStreamIncommingRequest | Promise<RedisStreamIncommingRequest> {
    const stream = value[0];
    const streamData: RedisStreamMessage[] = value[1];

    if (!(streamData.length === 1)) {
      throw new Error('Invalid stream data');
    }

    const message = streamData[0];
    const id = message[0];
    const data = message[1].reduce(
      (acc, curr, index) => {
        if (index % 2 === 0) {
          const body = message[1][index + 1];
          try {
            acc[curr] = JSON.parse(body as any);
          } catch (e) {
            acc[curr] = body;
          }
        }
        return acc;
      },
      {} as Record<any, any>,
    );

    const correlationId = data?.correlationId;
    if (correlationId) delete data.correlationId;

    return {
      pattern: stream,
      id,
      data,
      correlationId,
    };
  }
}

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
