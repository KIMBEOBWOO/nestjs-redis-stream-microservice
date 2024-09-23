import { Logger } from '@nestjs/common';
import { CustomTransportStrategy, Server, WritePacket } from '@nestjs/microservices';
import { v4 } from 'uuid';
import {
  DEFAULT_LIB_RESPONSE_STREAM,
  ServerConstructorOptions,
  ServerConsumerOption,
} from '../common';
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
  private options: ServerConsumerOption;

  constructor(private readonly constructorOption: ServerConstructorOptions) {
    super();
    this.initializeDeserializer({
      deserializer: new InboundRedisStreamMessageDeserializer(),
    });
    this.initializeSerializer({
      serializer: new OutboundRedisStreamMessageSerializer(),
    });
    (this.logger as unknown) = new Logger(RedisStreamServer.name);

    this.controlManager = RedisStreamManager.init(this.constructorOption.connection);
    this.clientManager = RedisStreamManager.init(this.constructorOption.connection);

    this.options = {
      block: this.constructorOption?.option?.block,
      consumerGroup: this.constructorOption.option.consumerGroup,
      consumer: v4(),
      deleteConsumerGroupOnClose: true,
      deleteConsumerOnClose: true,
    };
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
      await Promise.all(
        streamKeys.map((stream) =>
          this.controlManager.createConsumerGroup(stream, this.options.consumerGroup),
        ),
      );
    } catch (e) {
      this.logger.error(e);
    }
  }

  private async listenToStream() {
    try {
      const rawResults = await this.controlManager.readGroup(
        this.options.consumerGroup,
        this.options.consumer,
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
          this.clientManager.ack(incommingMessage, this.options.consumerGroup);
          if (!packet) return;

          if (incommingMessage.correlationId) {
            const payload = await this.serializer.serialize(packet.response, {
              correlationId: incommingMessage.correlationId,
            });
            await this.clientManager.add(DEFAULT_LIB_RESPONSE_STREAM, ...payload);
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
      this.controlManager.close();
      const streams = Array.from(this.messageHandlers.keys());

      if (this.options.deleteConsumerOnClose) {
        for await (const stream of streams) {
          await this.clientManager.deleteConsumer(
            stream,
            this.options.consumerGroup,
            this.options.consumer,
          );
        }
      }
      this.clientManager.close();
    } catch (e) {
      this.logger.error(e);
    }
  }
}
