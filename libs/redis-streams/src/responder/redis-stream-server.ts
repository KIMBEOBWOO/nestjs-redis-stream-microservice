import { Logger } from '@nestjs/common';
import { CustomTransportStrategy, Server, WritePacket } from '@nestjs/microservices';
import { ServerConstructorOptions } from '../common';
import { RedisStreamManager } from '../redis-stream-manager';
import {
  InboundRedisStreamMessageDeserializer,
  OutboundRedisStreamMessageSerializer,
} from '../serializer';

export class RedisStreamServer extends Server implements CustomTransportStrategy {
  private controlManager: RedisStreamManager;
  private clientManager: RedisStreamManager;

  protected override deserializer: InboundRedisStreamMessageDeserializer;
  protected override serializer: OutboundRedisStreamMessageSerializer;

  constructor(private readonly options: ServerConstructorOptions) {
    super();
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
    this.controlManager.onConnect(() => {
      this.bindHandlers();
      this.listenToStream();
      callback();
    });

    this.controlManager.onError((e: Error) => {
      this.logger.error(e);
    });
    this.clientManager.onError((e: Error) => {
      this.logger.error(e);
    });
  }

  private async bindHandlers() {
    try {
      const streamKeys = Array.from(this.messageHandlers.keys());
      const consumerGroup = this.options.inbound.consumerGroup;
      await Promise.all(
        streamKeys.map((stream) => this.controlManager.createConsumerGroup(stream, consumerGroup)),
      );
    } catch (e) {
      this.logger.error(e);
    }
  }

  private async listenToStream() {
    try {
      const rawResults = await this.controlManager.readGroup(
        this.options.inbound.consumerGroup,
        this.options.inbound.consumer,
        Array.from(this.messageHandlers.keys()),
      );

      if (!rawResults) {
        return this.listenToStream();
      }

      for (const rawResult of rawResults) {
        const ctx = undefined;
        const incommingMessage = await this.deserializer.deserialize(rawResult);

        const originHandler = this.messageHandlers.get(incommingMessage.pattern);
        if (!originHandler) continue;

        const responseCallBack = async (packet: WritePacket) => {
          this.clientManager.ack(incommingMessage, this.options.inbound.consumerGroup);
          if (!packet) return;

          if (incommingMessage.correlationId) {
            const payload = await this.serializer.serialize(packet.response, {
              correlationId: incommingMessage.correlationId,
            });
            await this.clientManager.add(this.options.outbound.stream, ...payload);
          }
        };

        const response$ = this.transformToObservable(originHandler(incommingMessage.data, ctx));
        response$ && this.send(response$, responseCallBack);
      }

      return this.listenToStream();
    } catch (e) {
      this.logger.error(e);
    }
  }

  async close() {
    try {
      this.controlManager.disconnect();
      const streams = Array.from(this.messageHandlers.keys());

      if (this.options.inbound.deleteConsumerOnClose) {
        for await (const stream of streams) {
          await this.clientManager.deleteConsumer(
            stream,
            this.options.inbound.consumerGroup,
            this.options.inbound.consumer,
          );
        }
      }

      if (this.options.inbound.deleteConsumerGroupOnClose) {
        for await (const stream of streams) {
          await this.clientManager.deleteConsumerGroup(stream, this.options.inbound.consumerGroup);
        }
      }

      this.clientManager.disconnect();
    } catch (e) {
      this.logger.error(e);
    }
  }
}
