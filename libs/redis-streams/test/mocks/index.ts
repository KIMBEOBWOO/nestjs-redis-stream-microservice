export class MockRedisStreamManager {
  protected redis: any;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(option: any) {
    this.redis = {
      xgroup: jest.fn(),
      xack: jest.fn(),
      xadd: jest.fn(),
      xreadgroup: jest.fn(),
      on: jest.fn().mockImplementation((_, callback) => {
        callback();
      }),
      quit: jest.fn(),
      disconnect: jest.fn(),
    } as any;
  }

  static init(option: any): MockRedisStreamManager {
    return new MockRedisStreamManager(option);
  }

  onConnect = jest.fn();
  onError = jest.fn();

  createConsumerGroup = jest.fn().mockResolvedValue(null);
  deleteConsumerGroup = jest.fn().mockResolvedValue(null);
  deleteConsumer = jest.fn().mockResolvedValue(null);
  close = jest.fn().mockResolvedValue(null);
  disconnect = jest.fn().mockResolvedValue(null);
  ack = jest.fn().mockResolvedValue(null);
  add = jest.fn().mockResolvedValue(null);
  readGroup = jest.fn().mockResolvedValue(null);
}
