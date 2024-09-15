import { Logger } from '@nestjs/common';
import { ClientProxy, ReadPacket, WritePacket } from '@nestjs/microservices';
import { CONNECT_EVENT, ERROR_EVENT } from '@nestjs/microservices/constants';
import { firstValueFrom, share } from 'rxjs';
import { v4 } from 'uuid';
import { ClientConstructorOptions } from '../common';
import { RedisStreamManager } from '../redis-stream-manager';
import {
  InboundRedisStreamMessageDeserializer,
  OutboundRedisStreamMessageSerializer,
} from '../serializer';

export class RedisStreamClient extends ClientProxy {
  protected override deserializer: InboundRedisStreamMessageDeserializer;
  protected override serializer: OutboundRedisStreamMessageSerializer;
  protected readonly logger = new Logger(RedisStreamClient.name);
  protected connection: Promise<any> | null = null;

  private callBackMap: Map<string, (packet: WritePacket) => void>;

  private clientManager: RedisStreamManager;
  private controlManager: RedisStreamManager;

  constructor(private readonly options: ClientConstructorOptions) {
    super();

    this.initializeDeserializer({
      deserializer: new InboundRedisStreamMessageDeserializer(),
    });
    this.initializeSerializer({
      serializer: new OutboundRedisStreamMessageSerializer(),
    });

    this.callBackMap = new Map();

    this.initManager();
  }

  initManager() {
    this.controlManager = RedisStreamManager.init(this.options.connection);
    this.controlManager.onConnect(() => {
      this.controlManager.createConsumerGroup(
        this.options.inboundStream.stream,
        this.options.inboundStream.consumerGroup,
      );
      this.listenToStream();
    });
    this.controlManager.onError((e: Error) => {
      this.logger.error('Error connecting to Redis : ' + e);
      this.close();
    });
    this.clientManager = RedisStreamManager.init(this.options.connection);
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
      const streamKeys = [this.options.inboundStream.stream];
      const rawResults = await this.controlManager.readGroup(
        this.options.inboundStream.consumerGroup,
        this.options.inboundStream.consumer,
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
        this.clientManager.ack(incommingMessage, this.options.inboundStream.consumerGroup);
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
    this.controlManager.disconnect();
    this.clientManager.disconnect();
    this.controlManager = null;
    this.connection = null;
    this.callBackMap.clear();
  }
}
