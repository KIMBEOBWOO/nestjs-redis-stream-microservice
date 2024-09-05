import { MockRedisStreamManager } from './mocks';
import { ConstructorOptions, RedisStreamClient, RedisStreamManager } from '@lib/redis-streams';

jest.mock('@lib/redis-streams/redis-stream-manager', () => {
  return {
    RedisStreamManager: MockRedisStreamManager,
  };
});

jest.mock('uuid', () => {
  return {
    v4: jest.fn().mockReturnValue('test-consumer-group'),
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
    it('should call controlManager.disconnect', async () => {
      const disconnectSpy = jest.spyOn(controlManager, 'disconnect');

      // when
      client.close();

      // then
      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should call clientManager.disconnect', async () => {
      const disconnectSpy = jest.spyOn(clientManager, 'disconnect');

      // when
      client.close();

      // then
      expect(disconnectSpy).toHaveBeenCalled();
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
      expect(sendToStreamSpy).toHaveBeenCalledWith(packet, 'test-consumer-group');
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
});
