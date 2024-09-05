const mockRedis = {
  xgroup: jest.fn(),
  xack: jest.fn(),
  xadd: jest.fn(),
  xreadgroup: jest.fn(),
  on: jest.fn().mockImplementation((_, callback) => {
    callback();
  }),
  quit: jest.fn(),
  disconnect: jest.fn(),
};

import { RedisStreamManager } from '../src/index';

jest.mock('ioredis', () => ({
  __esModule: true,
  Redis: jest.fn().mockImplementation(() => mockRedis),
}));

const option = {
  host: 'localhost',
  port: 6379,
};

describe('RedisStreamManager', () => {
  let manager: RedisStreamManager;

  beforeEach(() => {
    manager = RedisStreamManager.init(option);
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should create RedisStreamManager instance', () => {
      expect(manager).toBeInstanceOf(RedisStreamManager);
    });
  });

  describe('onConnect', () => {
    it('should call onConnect callback', () => {
      const callback = jest.fn();

      // when
      manager.onConnect(callback);

      // then
      expect(callback).toHaveBeenCalled();
      expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });
  });

  describe('onError', () => {
    it('should call onError callback', () => {
      const callback = jest.fn();

      // when
      manager.onError(callback);

      // then
      expect(callback).toHaveBeenCalled();
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('close', () => {
    it('should call redis.quit', async () => {
      // when
      await manager.close();

      // then
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should call redis.disconnect', () => {
      // when
      manager.disconnect();

      // then
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });
  });

  describe('createConsumerGroup', () => {
    it('should call redis.xgroup', async () => {
      // given
      const stream = 'stream';
      const consumerGroup = 'consumerGroup';

      // when
      await manager.createConsumerGroup(stream, consumerGroup);

      // then
      expect(mockRedis.xgroup).toHaveBeenCalledWith(
        'CREATE',
        stream,
        consumerGroup,
        '$',
        'MKSTREAM',
      );
    });

    it('should not throw BUSYGROUP error', async () => {
      // given
      const stream = 'stream';
      const consumerGroup = 'consumerGroup';
      mockRedis.xgroup.mockRejectedValue(new Error('BUSYGROUP Consumer Group name already exists'));

      // when
      expect(() => manager.createConsumerGroup(stream, consumerGroup)).not.toThrow();
    });

    it('should throw error when redis.xgroup throws unexpected error', async () => {
      // given
      const stream = 'stream';
      const consumerGroup = 'consumerGroup';
      mockRedis.xgroup.mockRejectedValue(new Error('Unexpected error'));

      // when
      expect(() => manager.createConsumerGroup(stream, consumerGroup)).rejects.toThrowError(
        'Unexpected error',
      );
    });
  });

  describe('ack', () => {
    it('should call redis.xack', async () => {
      // given
      const incommingMessage = { id: 'id', pattern: 'pattern' } as any;
      const consumerGroup = 'consumerGroup';

      // when
      await manager.ack(incommingMessage, consumerGroup);

      // then
      expect(mockRedis.xack).toHaveBeenCalledWith(
        incommingMessage.pattern,
        consumerGroup,
        incommingMessage.id,
      );
    });

    it('should not call redis.xack when incommingMessage does not have id', async () => {
      // given
      const incommingMessage = { pattern: 'pattern' } as any;
      const consumerGroup = 'consumerGroup';

      // when
      await manager.ack(incommingMessage, consumerGroup);

      // then
      expect(mockRedis.xack).not.toHaveBeenCalled();
    });
  });

  describe('add', () => {
    it('should call redis.xadd', () => {
      // given
      const stream = 'stream';
      const data = ['key', 'value'];

      // when
      manager.add(stream, ...data);

      // then
      expect(mockRedis.xadd).toHaveBeenCalledWith(stream, '*', ...data);
    });
  });

  describe('xreadgroup', () => {
    it('should call redis.xreadgroup', async () => {
      // given
      const consumerGroup = 'consumerGroup';
      const consumerName = 'consumerName';
      const streams = ['stream1', 'stream2'];

      // when
      await manager.readGroup(consumerGroup, consumerName, streams);

      // then
      expect(mockRedis.xreadgroup).toHaveBeenCalledWith(
        'GROUP',
        consumerGroup,
        consumerName,
        'COUNT',
        1,
        'BLOCK',
        0,
        'STREAMS',
        streams[0],
        streams[1],
        '>',
        '>',
      );
    });

    it('should call redis.xreadgroup with option', async () => {
      // given
      const consumerGroup = 'consumerGroup';
      const consumerName = 'consumerName';
      const streams = ['stream1', 'stream2'];
      const option = {
        block: 1000,
        count: 10,
      };

      // when
      await manager.readGroup(consumerGroup, consumerName, streams, option);

      // then
      expect(mockRedis.xreadgroup).toHaveBeenCalledWith(
        'GROUP',
        consumerGroup,
        consumerName,
        'COUNT',
        option.count,
        'BLOCK',
        option.block,
        'STREAMS',
        streams[0],
        streams[1],
        '>',
        '>',
      );
    });
  });
});
