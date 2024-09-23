import { MockRedisStreamManager } from './mocks';

import {
  DEFAULT_LIB_RESPONSE_STREAM,
  InboundRedisStreamMessageDeserializer,
  OutboundRedisStreamMessageSerializer,
  RedisStreamServer,
  ServerConstructorOptions,
  XReadGroupResponse,
} from '../src/index';

jest.mock('@lib/redis-streams/redis-stream-manager', () => {
  return {
    RedisStreamManager: MockRedisStreamManager,
  };
});

jest.mock('uuid', () => {
  return {
    v4: jest.fn().mockReturnValue('c1'),
  };
});

const options: ServerConstructorOptions = {
  connection: {
    host: 'localhost',
    port: 6379,
  },
  option: {
    consumerGroup: 'cg',
  },
};

describe('RedisStreamServer', () => {
  let server: RedisStreamServer;
  let messageHandlers: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();
    server = new RedisStreamServer(options);

    messageHandlers = new Map();
    messageHandlers.set('stream1', jest.fn());
    messageHandlers.set('stream2', jest.fn());

    (server as any).messageHandlers = messageHandlers;
    (server as any).logger = {
      log: jest.fn(),
      error: jest.fn(),
    };
  });

  describe('constructor', () => {
    it('should initialize deserializer and serializer', () => {
      // when
      const server = new RedisStreamServer(options as any);

      // then
      expect(server['deserializer']).toBeInstanceOf(InboundRedisStreamMessageDeserializer);
      expect(server['serializer']).toBeInstanceOf(OutboundRedisStreamMessageSerializer);
    });

    it('should initialize controlManager and clientManager', () => {
      // given
      const initSpy = jest.spyOn(MockRedisStreamManager, 'init');

      // when
      new RedisStreamServer(options);

      // then
      expect(initSpy).toHaveBeenCalledTimes(2);
      expect(initSpy).toHaveBeenCalledWith(options.connection);
    });

    it('should set logger', () => {
      // when
      const server = new RedisStreamServer(options as any);

      // then
      expect(server['logger']).toBeDefined();
    });
  });

  describe('listen', () => {
    const callback = jest.fn();

    it('should bind onError callback on controlManager and clientManager', () => {
      jest.spyOn(server as any, 'listenToStream').mockResolvedValue(null);

      // when
      server.listen(callback);

      // then
      expect(server['controlManager'].onError).toHaveBeenCalledTimes(1);
      expect(server['clientManager'].onError).toHaveBeenCalledTimes(1);
    });

    it('should bind onConnect callback on controlManager', () => {
      // given
      const bindHandlersSpy = jest.spyOn(server as any, 'bindHandlers').mockResolvedValue(null);
      const listenToStreamSpy = jest.spyOn(server as any, 'listenToStream').mockResolvedValue(null);
      const onConnectSpy = jest
        .spyOn(server['controlManager'], 'onConnect')
        .mockImplementation((callback: any) => callback());

      // when
      server.listen(callback);

      // then
      expect(onConnectSpy).toHaveBeenCalledTimes(1);

      expect(bindHandlersSpy).toHaveBeenCalledTimes(1);
      expect(listenToStreamSpy).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('bindHandlers', () => {
    it('should create consumer group for each stream', async () => {
      // given
      const createConsumerGroupSpy = jest.spyOn(
        server['controlManager'] as any,
        'createConsumerGroup',
      );

      // when
      await (server as any).bindHandlers();

      // then
      expect(createConsumerGroupSpy).toHaveBeenCalledTimes(messageHandlers.size);
      expect(createConsumerGroupSpy).toHaveBeenCalledWith('stream1', 'cg');
      expect(createConsumerGroupSpy).toHaveBeenCalledWith('stream2', 'cg');
    });

    it('should log error if any', async () => {
      // given
      const error = new Error('TEST_ERROR');
      jest.spyOn(server['controlManager'] as any, 'createConsumerGroup').mockRejectedValue(error);
      const loggerSpy = jest.spyOn(server['logger'], 'error');

      // when
      await (server as any).bindHandlers();

      // then
      expect(loggerSpy).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('listenToStream', () => {
    it('should read group for each stream', async () => {
      // given
      const readGroupSpy = jest
        .spyOn(server['controlManager'] as any, 'readGroup')
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error('STOP'));

      // when
      await server['listenToStream']();

      // then
      expect(readGroupSpy).toHaveBeenCalledWith('cg', 'c1', ['stream1', 'stream2']);
    });

    it('should call itself if no results', async () => {
      // given
      jest
        .spyOn(server['controlManager'] as any, 'readGroup')
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error('STOP'));
      const listenToStreamSpy = jest.spyOn(server as any, 'listenToStream');

      // when
      await server['listenToStream']();

      // then
      expect(listenToStreamSpy).toHaveBeenCalledTimes(2);
    });

    it('should call get handler for each deserialized message', async () => {
      // given
      const xreadGroupResponse: XReadGroupResponse = [
        ['stream1', [['message1', ['key1', 'data1']]]],
        ['stream1', [['message2', ['key1', 'data1']]]],
      ];
      jest
        .spyOn(server['controlManager'] as any, 'readGroup')
        .mockResolvedValueOnce(xreadGroupResponse)
        .mockRejectedValueOnce(new Error('STOP'));
      const getSpy = jest.spyOn(server['messageHandlers'], 'get');
      const deserializeSpy = jest.spyOn(server['deserializer'], 'deserialize').mockReturnValue({
        id: 'message1',
        pattern: 'stream1',
        data: 'data1',
      });
      jest.spyOn(server as any, 'transformToObservable').mockReturnValue(null);

      // when
      await server['listenToStream']();

      // then
      expect(getSpy).toHaveBeenCalledTimes(xreadGroupResponse.length);
      xreadGroupResponse.forEach((xRes) => expect(getSpy).toHaveBeenCalledWith(xRes[0]));

      expect(deserializeSpy).toHaveBeenCalledTimes(xreadGroupResponse.length);
      xreadGroupResponse.forEach((xRes) => expect(deserializeSpy).toHaveBeenCalledWith(xRes));
    });

    it('should not call super.send if originHandler is not found', async () => {
      // given
      const xreadGroupResponse: XReadGroupResponse = [
        ['stream1', [['message1', ['key1', 'data1']]]],
        ['stream1', [['message2', ['key1', 'data1']]]],
      ];
      jest
        .spyOn(server['controlManager'] as any, 'readGroup')
        .mockResolvedValueOnce(xreadGroupResponse)
        .mockRejectedValueOnce(new Error('STOP'));
      jest.spyOn(server['deserializer'], 'deserialize').mockReturnValue({
        id: 'message1',
        pattern: 'stream1',
        data: 'data1',
      });
      jest.spyOn(server['messageHandlers'], 'get').mockReturnValue(undefined);
      const sendSpy = jest.spyOn(server as any, 'send');

      // when
      await server['listenToStream']();

      // then
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('If there is no packet from the respondent, only ACK is sent and xadd should not be called. ', async () => {
      const xreadGroupResponse: XReadGroupResponse = [
        ['stream1', [['message1', ['key1', 'data1']]]],
        ['stream1', [['message2', ['key1', 'data1']]]],
      ];
      jest
        .spyOn(server['controlManager'] as any, 'readGroup')
        .mockResolvedValueOnce(xreadGroupResponse)
        .mockRejectedValueOnce(new Error('STOP'));
      jest.spyOn(server['messageHandlers'], 'get').mockReturnValue(jest.fn());
      const incommingMessage = {
        id: 'message1',
        pattern: 'stream1',
        data: 'data1',
      };
      jest.spyOn(server['deserializer'], 'deserialize').mockReturnValue(incommingMessage);
      const ackSpy = jest.spyOn(server['clientManager'], 'ack');
      const addSpy = jest.spyOn(server['clientManager'], 'add');

      jest
        .spyOn(server as any, 'send')
        .mockImplementation((stream$, respond: any) => respond(undefined));

      // when
      await server['listenToStream']();

      // then
      expect(ackSpy).toHaveBeenCalledTimes(xreadGroupResponse.length);
      xreadGroupResponse.forEach(() => expect(ackSpy).toHaveBeenCalledWith(incommingMessage, 'cg'));

      expect(addSpy).not.toHaveBeenCalled();
    });

    it('If there is packet from the respondent, send ACK and response Message', async () => {
      // given
      const xreadGroupResponse: XReadGroupResponse = [
        ['stream1', [['message1', ['key1', 'data1']]]],
        ['stream1', [['message2', ['key1', 'data1']]]],
      ];
      jest
        .spyOn(server['controlManager'] as any, 'readGroup')
        .mockResolvedValueOnce(xreadGroupResponse)
        .mockRejectedValueOnce(new Error('STOP'));
      jest.spyOn(server['messageHandlers'], 'get').mockReturnValue(jest.fn());
      const incommingMessage = {
        id: 'message1',
        pattern: 'stream1',
        data: 'data1',
        correlationId: 'correlationId',
      };
      jest.spyOn(server['deserializer'], 'deserialize').mockReturnValue(incommingMessage);
      const ackSpy = jest.spyOn(server['clientManager'], 'ack');
      const addSpy = jest.spyOn(server['clientManager'], 'add');
      const serializerSpy = jest
        .spyOn(server['serializer'], 'serialize')
        .mockResolvedValue(['key1', 'data1']);

      const writePacket = {
        response: {
          type: 'response from responder',
          name: 'test',
        },
      };
      const sendSpy = jest
        .spyOn(server as any, 'send')
        .mockImplementation((_, respond: any) => respond(writePacket));

      // when
      await server['listenToStream']();

      // then
      expect(sendSpy).toHaveBeenCalledTimes(xreadGroupResponse.length);

      expect(ackSpy).toHaveBeenCalledTimes(xreadGroupResponse.length);
      xreadGroupResponse.forEach(() => expect(ackSpy).toHaveBeenCalledWith(incommingMessage, 'cg'));

      expect(serializerSpy).toHaveBeenCalledTimes(xreadGroupResponse.length);
      xreadGroupResponse.forEach(() =>
        expect(serializerSpy).toHaveBeenCalledWith(writePacket.response, {
          correlationId: 'correlationId',
        }),
      );

      expect(addSpy).toHaveBeenCalledTimes(xreadGroupResponse.length);
      xreadGroupResponse.forEach(() =>
        expect(addSpy).toHaveBeenCalledWith(DEFAULT_LIB_RESPONSE_STREAM, 'key1', 'data1'),
      );
    });
  });

  describe('close', () => {
    it('should call close on controlManager', async () => {
      // when
      await server.close();

      // then
      expect(server['controlManager'].close).toHaveBeenCalledTimes(1);
    });

    it('should call close on clientManager', async () => {
      // when
      await server.close();

      // then
      expect(server['clientManager'].close).toHaveBeenCalledTimes(1);
    });

    it.skip('should call deleteConsumerGroup on clientManager if deleteConsumerGroupOnClose is true', async () => {
      // given
      server['options']['inbound'] = {
        ...server['options']['inbound'],
        deleteConsumerGroupOnClose: true,
      };
      const deleteConsumerGroupSpy = jest.spyOn(server['clientManager'], 'deleteConsumerGroup');

      // when
      await server.close();

      // then
      expect(deleteConsumerGroupSpy).toHaveBeenCalledTimes(messageHandlers.size);
      Array.from(messageHandlers.keys()).forEach((val) =>
        expect(deleteConsumerGroupSpy).toHaveBeenCalledWith(val, 'cg'),
      );
    });

    it('should call deleteConsumer on clientManager if deleteConsumerOnClose is true', async () => {
      // given
      server['options']['inbound'] = {
        ...server['options']['inbound'],
        deleteConsumerOnClose: true,
      };
      const deleteConsumerSpy = jest.spyOn(server['clientManager'], 'deleteConsumer');

      // when
      await server.close();

      // then
      expect(deleteConsumerSpy).toHaveBeenCalledTimes(messageHandlers.size);
      Array.from(messageHandlers.keys()).forEach((val) =>
        expect(deleteConsumerSpy).toHaveBeenCalledWith(val, 'cg', 'c1'),
      );
    });

    it('should call logger.error if any error', async () => {
      // given
      const error = new Error('TEST_ERROR');
      jest.spyOn(server['controlManager'], 'close').mockImplementation(() => {
        throw error;
      });
      const loggerSpy = jest.spyOn(server['logger'], 'error');

      // when
      await server.close();

      // then
      expect(loggerSpy).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(error);
    });
  });
});
