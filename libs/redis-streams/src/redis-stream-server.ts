import { Logger } from '@nestjs/common';
import {
  CustomTransportStrategy,
  IncomingEvent,
  IncomingRequest,
  Server,
  WritePacket,
} from '@nestjs/microservices';
import { CONNECT_EVENT, ERROR_EVENT } from '@nestjs/microservices/constants';
import { Redis } from 'ioredis';
import { ConstructorOptions, RedisInstance } from './interface';
import { RedisStreamManager } from './redis-stream-manager';
import { XReadGroupRawResult } from './redis-stream.interface';
import {
  InboundRedisStreamMessageDeserializer,
  OutboundRedisStreamMessageSerializer,
} from './serializer';

export class RedisStreamServer extends Server implements CustomTransportStrategy {
  // private redis: RedisInstance;
  // private client: RedisInstance;

  private responseStream: string;
  private controlManager: RedisStreamManager;
  private clientManager: RedisStreamManager;

  override readonly deserializer: InboundRedisStreamMessageDeserializer;
  override readonly serializer: OutboundRedisStreamMessageSerializer;

  constructor(private readonly options: ConstructorOptions) {
    super();
    this.responseStream = 'res-stream';
    this.initializeDeserializer({
      deserializer: new InboundRedisStreamMessageDeserializer(),
    });
    this.initializeSerializer({
      serializer: new OutboundRedisStreamMessageSerializer(),
    });
    (this.logger as any) = new Logger(RedisStreamServer.name);

    this.controlManager = RedisStreamManager.init(options.connection);
    this.clientManager = RedisStreamManager.init(options.connection);
  }

  listen(callback: () => void) {
    // this.redis = new Redis(this.options.connection);
    // this.client = new Redis(this.options.connection);

    this.controlManager.onConnect(() => {
      this.bindHandlers();
      this.listenToStream();
      callback();
    });

    this.controlManager.onError((e: Error) => {
      this.logger.error(e);
    });

    // this.handleConnect(this.redis, async () => {
    //   this.bindHandlers();
    //   this.listenToStream();

    //   callback();
    // });
    // this.handleError(this.redis);
  }

  private async bindHandlers() {
    try {
      const streamKeys = Array.from(this.messageHandlers.keys());
      const consumerGroup = this.options.streams.consumerGroup;
      await Promise.all(
        streamKeys.map((stream) => this.createConsumerGroup(stream, consumerGroup)),
      );
    } catch (e) {
      this.logger.error(e);
    }
  }

  private async createConsumerGroup(stream: string, consumerGroup: string) {
    try {
      await this.controlManager.redis.xgroup('CREATE', stream, consumerGroup, '$', 'MKSTREAM');
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

  private async listenToStream() {
    try {
      const streamKeys = Array.from(this.messageHandlers.keys());
      const streamDataList = (await this.controlManager.redis.xreadgroup(
        'GROUP',
        this.options.streams.consumerGroup,
        this.options.streams.consumer,
        'COUNT',
        1,
        'BLOCK',
        this.options?.streams?.block || 0,
        'STREAMS',
        ...streamKeys,
        ...streamKeys.map(() => '>'),
      )) as XReadGroupRawResult | null;

      if (!streamDataList) {
        return this.listenToStream();
      }

      for (const streamData of streamDataList) {
        const ctx = undefined;
        const incommingMessage = await this.deserializer.deserialize(streamData);

        const originHandler = this.messageHandlers.get(incommingMessage.pattern);
        if (!originHandler) return;

        const response$ = this.transformToObservable(originHandler(incommingMessage.data, ctx));

        const respondCallBack = async (packet: WritePacket) => {
          if (!packet) return;

          this.sendAck(incommingMessage);
          const streamDataList = await this.serializer.serialize(packet.response, {
            correlationId: incommingMessage.correlationId,
          });
          await this.clientManager.redis.xadd('res-stream', '*', ...streamDataList);
        };

        response$ && this.send(response$, respondCallBack);
      }

      return this.listenToStream();
    } catch (e) {
      this.logger.error(e);
    }
  }

  private async sendAck(incommingMessage: IncomingRequest | IncomingEvent) {
    if (!('id' in incommingMessage)) return;

    const stream = incommingMessage.pattern;
    const res = await this.clientManager.redis.xack(
      stream,
      this.options.streams.consumerGroup,
      incommingMessage.id,
    );

    if (res === 0) {
      this.logger.error('Failed to ack message');
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

  async close() {
    await this.clientManager.redis.quit();
    await this.controlManager.redis.quit();
  }
}
