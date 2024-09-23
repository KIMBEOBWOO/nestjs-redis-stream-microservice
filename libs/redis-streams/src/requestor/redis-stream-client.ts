import { Logger, OnApplicationShutdown } from '@nestjs/common';
import { ClientProxy, ReadPacket, WritePacket } from '@nestjs/microservices';
import { CONNECT_EVENT, ERROR_EVENT } from '@nestjs/microservices/constants';
import { firstValueFrom, share } from 'rxjs';
import { v4 } from 'uuid';
import {
  ClientConstructorOptions,
  ClientConsumerOption,
  DEFAULT_LIB_RESPONSE_STREAM,
} from '../common';
import { RedisStreamManager } from '../redis-stream-manager';
import {
  InboundRedisStreamMessageDeserializer,
  OutboundRedisStreamMessageSerializer,
} from '../serializer';

export class RedisStreamClient extends ClientProxy implements OnApplicationShutdown {
  protected override deserializer: InboundRedisStreamMessageDeserializer;
  protected override serializer: OutboundRedisStreamMessageSerializer;
  protected readonly logger = new Logger(RedisStreamClient.name);
  protected connection: Promise<any> | null = null;

  private callBackMap: Map<string, (packet: WritePacket) => void>;
  private clientManager: RedisStreamManager;
  private controlManager: RedisStreamManager;
  private options: ClientConsumerOption;

  constructor(private readonly constructorOption: ClientConstructorOptions) {
    super();
    this.initializeDeserializer({
      deserializer: new InboundRedisStreamMessageDeserializer(),
    });
    this.initializeSerializer({
      serializer: new OutboundRedisStreamMessageSerializer(),
    });
    this.callBackMap = new Map();
    this.options = {
      block: this.constructorOption?.option?.block,
      consumerGroup: v4(),
      consumer: v4(),
    };
    this.initManager();
  }

  initManager() {
    this.controlManager = RedisStreamManager.init(this.constructorOption.connection);
    this.clientManager = RedisStreamManager.init(this.constructorOption.connection);

    this.controlManager.onConnect(() => {
      this.controlManager.createConsumerGroup(
        DEFAULT_LIB_RESPONSE_STREAM,
        this.options.consumerGroup,
      );
      this.listenToStream();
    });
    this.controlManager.onError((e: Error) => {
      this.logger.error('Error connecting to Redis : ' + e);
      this.close();
    });
  }

  async connect(): Promise<any> {
    if (this.controlManager) return this.connection;

    this.initManager();
    this.connection = await firstValueFrom(
      this.connect$(this.controlManager, ERROR_EVENT, CONNECT_EVENT).pipe(share()),
    );

    return this.connection;
  }

  protected publish(packet: ReadPacket, callback: (packet: WritePacket) => any): any {
    const correlationId = v4();
    this.callBackMap.set(correlationId, callback);
    this.sendToStream(packet, correlationId);
  }

  private async sendToStream(packet: ReadPacket, correlationId: string) {
    try {
      const payload = await this.serializer.serialize(packet.data, {
        correlationId,
      });
      await this.clientManager.add(packet.pattern, ...payload);
    } catch (err) {
      this.logger.error(err);
      const callback = this.callBackMap.get(correlationId);
      callback?.({ err });
      this.callBackMap.delete(correlationId);
    }
  }

  private async listenToStream(): Promise<any> {
    try {
      const streamKeys = [DEFAULT_LIB_RESPONSE_STREAM];
      const rawResults = await this.controlManager.readGroup(
        this.options.consumerGroup,
        this.options.consumer,
        streamKeys,
      );

      if (!rawResults) return this.listenToStream();

      for (const rawResult of rawResults) {
        const incommingMessage = await this.deserializer.deserialize(rawResult);

        if (
          !incommingMessage?.correlationId ||
          !this.callBackMap.get(incommingMessage.correlationId)
        ) {
          continue;
        }

        const correlationId = incommingMessage.correlationId;
        const callback = this.callBackMap.get(correlationId);

        callback({
          err: null,
          response: incommingMessage.data,
          isDisposed: true,
          status: 'success',
        });

        this.callBackMap.delete(correlationId);
        this.clientManager.ack(incommingMessage, this.options.consumerGroup);
      }

      return this.listenToStream();
    } catch (e) {
      this.logger.error(e);
    }
  }

  protected async dispatchEvent(packet: ReadPacket): Promise<any> {
    const payload = await this.serializer.serialize(packet.data);
    await this.clientManager.add(packet.pattern, ...payload);
  }

  close() {
    this.connection = null;
    this.callBackMap.clear();
  }

  async onApplicationShutdown() {
    try {
      this.controlManager.disconnect();

      // should call deleteConsumer before deleteConsumerGroup
      await this.clientManager.deleteConsumer(
        DEFAULT_LIB_RESPONSE_STREAM,
        this.options.consumerGroup,
        this.options.consumer,
      );

      await this.clientManager.deleteConsumerGroup(
        DEFAULT_LIB_RESPONSE_STREAM,
        this.options.consumerGroup,
      );

      this.clientManager.disconnect();
      this.close();
    } catch (e) {
      this.logger.error(e);
    }
  }
}
