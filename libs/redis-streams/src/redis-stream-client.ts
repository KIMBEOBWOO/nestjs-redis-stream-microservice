import { Logger } from '@nestjs/common';
import {
  ClientProxy,
  IncomingEvent,
  IncomingRequest,
  ReadPacket,
  WritePacket,
} from '@nestjs/microservices';
import { CONNECT_EVENT, ERROR_EVENT } from '@nestjs/microservices/constants';
import { Redis } from 'ioredis';
import { firstValueFrom, share } from 'rxjs';
import { v4 } from 'uuid';
import { ClientConstructorOptions, RedisInstance } from './interface';
import { RedisStreamManager } from './redis-stream-manager';
import { XReadGroupRawResult } from './redis-stream.interface';
import {
  InboundRedisStreamMessageDeserializer,
  OutboundRedisStreamMessageSerializer,
} from './serializer';

export class RedisStreamClient extends ClientProxy {
  private redis: RedisInstance;
  private client: RedisInstance;

  protected override deserializer: InboundRedisStreamMessageDeserializer;
  protected override serializer: OutboundRedisStreamMessageSerializer;
  protected readonly logger = new Logger(RedisStreamClient.name);
  protected connection: Promise<any> | null = null;

  private callBackMap: Map<string, (packet: WritePacket) => void>;
  private consumerGroup: string;
  private responseStream: string;

  private manager: RedisStreamManager;

  constructor(private readonly options: ClientConstructorOptions) {
    super();
    this.initializeDeserializer({
      deserializer: new InboundRedisStreamMessageDeserializer(),
    });
    this.initializeSerializer({
      serializer: new OutboundRedisStreamMessageSerializer(),
    });
    this.callBackMap = new Map();
    this.consumerGroup = v4();

    this.redis = new Redis(this.options.connection);
    this.client = new Redis(this.options.connection);

    this.responseStream = 'res-stream';

    this.handleConnect(this.redis, async () => {
      this.createConsumerGroup(this.responseStream, this.consumerGroup);
      this.listenToStream();
    });
    this.handleError(this.redis);
  }

  async connect(): Promise<any> {
    if (this.redis) {
      return this.connection;
    }

    this.redis = new Redis(this.options.connection);

    // NOTE : not working with ioredis
    this.connection = await firstValueFrom(
      this.connect$(this.redis, ERROR_EVENT, CONNECT_EVENT).pipe(share()),
    );
    this.handleError(this.redis);

    return this.connection;
  }

  protected publish(packet: ReadPacket, callback: (packet: WritePacket) => any): any {
    const correlationId = v4();
    this.callBackMap.set(correlationId, callback);
    this.sendToStream(packet, correlationId);
  }

  private async sendToStream(packet: ReadPacket, correlationId: string) {
    try {
      const streamDataList = await this.serializer.serialize(packet.data, {
        correlationId,
      });
      await this.client.xadd(packet.pattern, '*', ...streamDataList);
    } catch (err) {
      this.logger.error(err);
      const callback = this.callBackMap.get(correlationId);
      callback?.({ err });
      this.callBackMap.delete(correlationId);
    }
  }

  private async listenToStream(): Promise<any> {
    const streamKeys = ['res-stream'];
    const streamDataList = (await this.redis.xreadgroup(
      'GROUP',
      this.consumerGroup,
      v4(),
      'COUNT',
      1,
      'BLOCK',
      0,
      'STREAMS',
      ...streamKeys,
      ...streamKeys.map(() => '>'),
    )) as XReadGroupRawResult | null;

    if (!streamDataList) return this.listenToStream();

    for (const streamData of streamDataList) {
      const incommingMessage = await this.deserializer.deserialize(streamData);

      if (
        !incommingMessage?.correlationId ||
        !this.callBackMap.get(incommingMessage.correlationId)
      ) {
        continue;
      }

      const correlationId = incommingMessage.correlationId;
      const callback = this.callBackMap.get(correlationId);
      this.callBackMap.delete(correlationId);
      this.sendAck(incommingMessage);

      callback({
        err: null,
        response: incommingMessage.data,
        isDisposed: true,
        status: 'success',
      });
    }

    return this.listenToStream();
  }

  protected async dispatchEvent(packet: ReadPacket): Promise<any> {
    const streamDataList: any = this.serializer.serialize(packet.data);
    const response = await this.client.xadd(packet.pattern, '*', ...streamDataList);
    return response;
  }

  private async createConsumerGroup(stream: string, consumerGroup: string) {
    try {
      await this.redis.xgroup('CREATE', stream, consumerGroup, '$', 'MKSTREAM');
    } catch (e) {
      if (
        e instanceof Error &&
        e.message.includes('BUSYGROUP Consumer Group name already exists')
      ) {
        return;
      }
      throw e;
    }
  }

  public handleConnect(stream: any, cb: () => void) {
    stream.on(CONNECT_EVENT, async () => {
      try {
        this.logger.log(
          'Redis connected successfully on ' +
            (this.options.connection?.host + ':' + this.options.connection?.port),
        );

        cb();
      } catch (e) {
        this.logger.error(e);
      }
    });
  }

  public handleError(stream: any) {
    stream.on(ERROR_EVENT, (e: any) => {
      this.logger.error('Error connecting to Redis : ' + e);
      this.close();
    });
  }

  private async sendAck(incommingMessage: IncomingRequest | IncomingEvent) {
    if (!('id' in incommingMessage)) return;

    const stream = incommingMessage.pattern;
    const res = await this.redis.xack(stream, this.consumerGroup, incommingMessage.id);

    if (res === 0) {
      this.logger.error('Failed to ack message');
    }
  }

  close() {
    this.redis && this.redis.disconnect(); // listener instance.
    this.redis = null;
    this.connection = null;
    this.callBackMap.clear();
  }
}
