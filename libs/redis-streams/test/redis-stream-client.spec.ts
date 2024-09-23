import { MockRedisStreamManager } from './mocks';
import {
  ClientConstructorOptions,
  DEFAULT_LIB_RESPONSE_STREAM,
  RedisStreamClient,
  RedisStreamManager,
} from '../src/index';

jest.mock('@lib/redis-streams/redis-stream-manager', () => {
  return {
    RedisStreamManager: MockRedisStreamManager,
  };
});

jest.mock('uuid', () => {
  return {
    v4: jest.fn().mockReturnValue('test-uuid'),
  };
});

const options: ClientConstructorOptions = {
  connection: {
    host: 'localhost',
    port: 6379,
  },
};

describe('RedisStreamClient', () => {
  let client: RedisStreamClient;
  let controlManager: RedisStreamManager;
  let clientManager: RedisStreamManager;

  beforeEach(() => {
    client = new RedisStreamClient(options);

    (client as any).logger = {
      log: jest.fn(),
      error: jest.fn(),
    };

    controlManager = new MockRedisStreamManager(options.connection) as any;
    (client as any)['controlManager'] = controlManager;
    clientManager = new MockRedisStreamManager(options.connection) as any;
    (client as any)['clientManager'] = clientManager;
  });

  describe('connect', () => {
    it('should return connection if controlManager is already initialized', async () => {
      // given
      client['connection'] = 'test-connection' as any;

      // when
      const result = await client.connect();

      // then
      expect(result).toBe('test-connection');
    });
  });

  describe('close', () => {
    it('should set connection to null', () => {
      // given
      client['connection'] = 'test-connection' as any;

      // when
      client.close();

      // then
      expect(client['connection']).toBe(null);
    });

    it('should call callBackMap.clear', () => {
      // given
      client['callBackMap'].set('test', () => {});

      // when
      client.close();

      // then
      expect(client['callBackMap'].size).toBe(0);
    });
  });

  describe('publish', () => {
    it('should call sendToStream', async () => {
      // given
      const packet = { pattern: 'pattern', data: 'data' };
      const sendToStreamSpy = jest.spyOn(client as any, 'sendToStream').mockResolvedValue(null);

      // when
      client['publish'](packet, () => {});

      // then
      expect(sendToStreamSpy).toHaveBeenCalled();
      expect(sendToStreamSpy).toHaveBeenCalledWith(packet, 'test-uuid');
    });

    it('should set callback in callBackMap', async () => {
      // given
      const packet = { pattern: 'pattern', data: 'data' };
      const callback = jest.fn();

      // when
      client['publish'](packet, callback);

      // then
      expect(client['callBackMap'].size).toBe(1);
    });
  });

  describe('sendToStream', () => {
    it('should call serializer.serialize', async () => {
      // given
      const packet = { pattern: 'pattern', data: 'data' };
      const serializeSpy = jest
        .spyOn(client['serializer'], 'serialize')
        .mockResolvedValue(['key1', 'value1']);

      // when
      await client['sendToStream'](packet, 'correlationId');

      // then
      expect(serializeSpy).toHaveBeenCalledWith(packet.data, { correlationId: 'correlationId' });
    });

    it('should call clientManager.add', async () => {
      // given
      const packet = { pattern: 'pattern', data: 'data' };
      jest.spyOn(client['serializer'], 'serialize').mockResolvedValue(['key1', 'value1']);
      const addSpy = jest.spyOn(clientManager, 'add').mockResolvedValue(null);

      // when
      await client['sendToStream'](packet, 'correlationId');

      // then
      expect(addSpy).toHaveBeenCalledWith(packet.pattern, 'key1', 'value1');
    });

    it('should call callback with error', async () => {
      // given
      const packet = { pattern: 'pattern', data: 'data' };
      jest.spyOn(client['serializer'], 'serialize').mockRejectedValue('error');
      const callback = jest.fn();
      const correlationId = 'correlationId';
      client['callBackMap'].set(correlationId, callback);

      // when
      await client['sendToStream'](packet, correlationId);

      // then
      expect(callback).toHaveBeenCalledWith({ err: 'error' });
    });
  });

  describe('dispatchEvent', () => {
    it('should call serializer.serialize', async () => {
      // given
      const packet = { pattern: 'pattern', data: 'data' };
      const serializeSpy = jest
        .spyOn(client['serializer'], 'serialize')
        .mockResolvedValue(['key1', 'value1']);

      // when
      await client['dispatchEvent'](packet);

      // then
      expect(serializeSpy).toHaveBeenCalledWith(packet.data);
    });

    it('should call clientManager.add', async () => {
      // given
      const packet = { pattern: 'pattern', data: 'data' };
      jest.spyOn(client['serializer'], 'serialize').mockResolvedValue(['key1', 'value1']);
      const addSpy = jest.spyOn(clientManager, 'add').mockResolvedValue(null);

      // when
      await client['dispatchEvent'](packet);

      // then
      expect(addSpy).toHaveBeenCalledWith(packet.pattern, 'key1', 'value1');
    });
  });

  describe('onApplicationShutdown', () => {
    it('should call disconnect on controlManager', async () => {
      // when
      await client.onApplicationShutdown();

      // then
      expect(client['controlManager'].disconnect).toHaveBeenCalledTimes(1);
    });

    it('should call disconnect on clientManager', async () => {
      // when
      await client.onApplicationShutdown();

      // then
      expect(client['clientManager'].disconnect).toHaveBeenCalledTimes(1);
    });

    it('should call deleteConsumerGroup on clientManager if deleteConsumerGroupOnClose is true', async () => {
      // given
      client['options']['inbound'] = {
        ...client['options']['inbound'],
        deleteConsumerGroupOnClose: true,
      };
      const deleteConsumerGroupSpy = jest.spyOn(client['clientManager'], 'deleteConsumerGroup');

      // when
      await client.onApplicationShutdown();

      // then
      expect(deleteConsumerGroupSpy).toHaveBeenCalledTimes(1);
      expect(deleteConsumerGroupSpy).toHaveBeenCalledWith(DEFAULT_LIB_RESPONSE_STREAM, 'test-uuid');
    });

    it('should call deleteConsumer on clientManager if deleteConsumerOnClose is true', async () => {
      // given
      client['options']['inbound'] = {
        ...client['options']['inbound'],
        deleteConsumerOnClose: true,
      };
      const deleteConsumerSpy = jest.spyOn(client['clientManager'], 'deleteConsumer');

      // when
      await client.onApplicationShutdown();

      // then
      expect(deleteConsumerSpy).toHaveBeenCalledTimes(1);
      expect(deleteConsumerSpy).toHaveBeenCalledWith(
        DEFAULT_LIB_RESPONSE_STREAM,
        'test-uuid',
        'test-uuid',
      );
    });

    it('should call logger.error if any error', async () => {
      // given
      const error = new Error('TEST_ERROR');
      jest.spyOn(client['controlManager'], 'disconnect').mockImplementation(() => {
        throw error;
      });
      const loggerSpy = jest.spyOn(client['logger'], 'error');

      // when
      await client.onApplicationShutdown();

      // then
      expect(loggerSpy).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(error);
    });
  });
});
