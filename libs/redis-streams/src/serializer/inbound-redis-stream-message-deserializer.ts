import { Deserializer } from '@nestjs/microservices';
import {
  DEFAULT_LIB_MESSAGE_HEADER,
  RedisStreamData,
  RedisStreamIncommingRequest,
  RedisStreamRawMessage,
  RedisStreamRawMessagePayload,
} from '../common';

export class InboundRedisStreamMessageDeserializer implements Deserializer {
  deserialize(
    value: RedisStreamData,
  ): RedisStreamIncommingRequest | Promise<RedisStreamIncommingRequest> {
    const stream = value[0];
    const streamData: RedisStreamRawMessage[] = value[1];

    if (!(streamData.length === 1)) {
      throw new Error('Invalid stream data');
    }

    const message = streamData[0];
    const id = message[0];
    const data = this.rawMessageToJson(message[1]);

    if (!data[DEFAULT_LIB_MESSAGE_HEADER]) {
      return {
        pattern: stream,
        id,
        data,
      };
    }

    const libHeader = data[DEFAULT_LIB_MESSAGE_HEADER];
    const correlationId = libHeader?.correlationId;
    const isArray = libHeader?.isArray;
    delete data[DEFAULT_LIB_MESSAGE_HEADER];

    if (isArray) {
      const convertedData = Object.values(data).reduce((acc: any, val) => {
        acc.push(val);
        return acc;
      }, []);

      return {
        pattern: stream,
        id,
        data: convertedData,
        correlationId,
      };
    }

    return {
      pattern: stream,
      id,
      data,
      correlationId,
    };
  }

  private rawMessageToJson(fields: RedisStreamRawMessagePayload): any {
    const jsonData = fields.reduce(
      (acc, _, index) => {
        if (index % 2 === 0) {
          const key = fields[index];
          const body = fields[index + 1];

          try {
            acc[key] = JSON.parse(body as any);
          } catch (e) {
            acc[key] = body;
          }
        }
        return acc;
      },
      {} as Record<any, any>,
    );

    return jsonData;
  }
}
