class MockRedisStreamClient {
  constructor(public readonly option: any) {}
}

jest.mock('../src/requestor', () => ({
  RedisStreamClient: MockRedisStreamClient,
}));

import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRedisStreamClientToken, RedisStreamClientModule } from '../src';

describe('RedisStreamClientModule', () => {
  describe('register', () => {
    it('should register a "RedisStreamClient" instance', async () => {
      const module = await Test.createTestingModule({
        imports: [
          RedisStreamClientModule.register({
            connection: {
              host: 'localhost',
              port: 6379,
              password: 'password',
            },
          }),
        ],
      }).compile();

      const client = module.get(getRedisStreamClientToken());
      expect(client).toBeInstanceOf(MockRedisStreamClient);
      expect(client.option).toEqual({
        connection: {
          host: 'localhost',
          port: 6379,
          password: 'password',
        },
      });
    });
  });

  describe('registerAsync', () => {
    it('should register a "RedisStreamClient" instance when using useFactory', async () => {
      const module = await Test.createTestingModule({
        imports: [
          RedisStreamClientModule.registerAsync({
            useFactory: () => ({
              connection: {
                host: 'localhost',
                port: 6379,
                password: 'password',
              },
            }),
          }),
        ],
      }).compile();

      const client = module.get(getRedisStreamClientToken());
      expect(client).toBeInstanceOf(MockRedisStreamClient);
      expect(client.option).toEqual({
        connection: {
          host: 'localhost',
          port: 6379,
          password: 'password',
        },
      });
    });

    it('should register a "RedisStreamClient" instance when using useClass', async () => {
      class ConfigService {
        create() {
          return {
            connection: {
              host: 'localhost',
              port: 6379,
              password: 'password',
            },
          };
        }
      }

      const module = await Test.createTestingModule({
        imports: [
          RedisStreamClientModule.registerAsync({
            useClass: ConfigService,
          }),
        ],
      }).compile();

      const client = module.get(getRedisStreamClientToken());
      expect(client).toBeInstanceOf(MockRedisStreamClient);
      expect(client.option).toEqual({
        connection: {
          host: 'localhost',
          port: 6379,
          password: 'password',
        },
      });
    });

    it('should throw an error when using an invalid configuration', async () => {
      expect(() =>
        Test.createTestingModule({
          imports: [RedisStreamClientModule.registerAsync({})],
        }).compile(),
      ).toThrow('Invalid configuration. Must provide useFactory, useClass or useExisting');
    });

    /**
     * TODO : Fix the test case
     */
    it.skip('should register a "RedisStreamClient" instance when using useExisting', async () => {
      class ConfigService {
        create() {
          return {
            connection: {
              host: 'localhost',
              port: 6379,
              password: 'password',
            },
          };
        }
      }

      @Module({})
      @Global()
      class ConfigModule {
        providers: [ConfigService];
        exports: [ConfigService];
      }

      const module = await Test.createTestingModule({
        imports: [
          ConfigModule,
          RedisStreamClientModule.registerAsync({
            imports: [ConfigModule],
            useExisting: ConfigService,
          }),
        ],
      }).compile();

      const client = module.get(getRedisStreamClientToken());
      expect(client).toBeInstanceOf(MockRedisStreamClient);
      expect(client.option).toEqual({
        connection: {
          host: 'localhost',
          port: 6379,
          password: 'password',
        },
      });
    });
  });
});
