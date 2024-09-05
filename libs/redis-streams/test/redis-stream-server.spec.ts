import { MockRedisStreamManager } from './mocks';

import {
  ConstructorOptions,
  DEFAULT_RESPONSE_STREAM,
  InboundRedisStreamMessageDeserializer,
  OutboundRedisStreamMessageSerializer,
  RedisStreamServer,
  XReadGroupResponse,
} from '@lib/redis-streams';

jest.mock('@lib/redis-streams/redis-stream-manager', () => {
  return {
    RedisStreamManager: MockRedisStreamManager,
  };
});

const options: ConstructorOptions = {
  connection: {
    host: 'localhost',
    port: 6379,
  },
  streams: {
    consumerGroup: 'cg',
    consumer: 'c1',
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

    it('should set responseStream to DEFAULT_RESPONSE_STREAM', () => {
      // when
      const server = new RedisStreamServer(options as any);

      // then
      expect(server['responseStream']).toBe(DEFAULT_RESPONSE_STREAM);
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
        .mockImplementation((callback) => callback());

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
          correlationId: undefined,
        }),
      );

      expect(addSpy).toHaveBeenCalledTimes(xreadGroupResponse.length);
      xreadGroupResponse.forEach(() =>
        expect(addSpy).toHaveBeenCalledWith(DEFAULT_RESPONSE_STREAM, 'key1', 'data1'),
      );
    });
  });

  describe('close', () => {
    it('should call quit on controlManager', async () => {
      // when
      await server.close();

      // then
      expect(server['controlManager'].close).toHaveBeenCalledTimes(1);
      expect(server['clientManager'].close).toHaveBeenCalledTimes(1);
    });
  });
});
