import {
  DEFAULT_LIB_MESSAGE_HEADER,
  InboundRedisStreamMessageDeserializer,
  RedisStreamData,
} from '@lib/redis-streams';

describe('InboundRedisStreamMessageDeserializer', () => {
  let deserializer: InboundRedisStreamMessageDeserializer;

  beforeEach(() => {
    deserializer = new InboundRedisStreamMessageDeserializer();
  });

  describe('deserialize', () => {
    const invalidValue = [
      [
        [
          'stream-1',
          [
            ['stream-id-1', ['type', '"SEND"']],
            ['stream-id-2', ['type', '"SEND"']],
          ],
        ],
      ],
      [['stream-1', []]],
    ];

    it.each(invalidValue)('should throw an error if stream data length is not 1', async (value) => {
      // when, then
      expect(() => deserializer.deserialize(value as any)).toThrow('Invalid stream data');
    });

    it('should deserialize stream data when Nested JSON Object is provided', async () => {
      // given
      const value: RedisStreamData = [
        'stream-1',
        [
          [
            'stream-id-1',
            [
              'type',
              '"SEND"',
              'name',
              '"beobwoo"',
              'age',
              '27',
              'profile',
              '{"company":"bubblecloud.io","position":"developer"}',
              'isDeveloper',
              'true',
            ],
          ],
        ],
      ];

      // when
      const result = deserializer.deserialize(value);

      // then
      expect(result).toEqual({
        pattern: 'stream-1',
        id: 'stream-id-1',
        data: {
          type: 'SEND',
          name: 'beobwoo',
          age: 27,
          profile: {
            company: 'bubblecloud.io',
            position: 'developer',
          },
          isDeveloper: true,
        },
        correlationId: undefined,
      });
    });

    it('should deserialize stream data when Nested JSON Object is provided with correlationId', async () => {
      // given
      const value: RedisStreamData = [
        'stream-1',
        [
          [
            'stream-id-1',
            [
              'type',
              '"SEND"',
              'name',
              '"beobwoo"',
              'age',
              '27',
              'profile',
              '{"company":"bubblecloud.io","position":"developer"}',
              DEFAULT_LIB_MESSAGE_HEADER,
              '{"correlationId":"correlation-id"}',
            ],
          ],
        ],
      ];

      // when
      const result = deserializer.deserialize(value);

      // then
      expect(result).toEqual({
        pattern: 'stream-1',
        id: 'stream-id-1',
        data: {
          type: 'SEND',
          name: 'beobwoo',
          age: 27,
          profile: {
            company: 'bubblecloud.io',
            position: 'developer',
          },
        },
        correlationId: 'correlation-id',
      });
    });

    it('should deserialize stream data when Primitive Array is provided', async () => {
      // given
      const value: RedisStreamData = [
        'stream-1',
        [
          [
            'stream-id-1',
            [
              '0',
              '1',
              '1',
              '2',
              '2',
              '3',
              '3',
              '4',
              '4',
              '5',
              DEFAULT_LIB_MESSAGE_HEADER,
              '{"isArray":true}',
            ],
          ],
        ],
      ];

      // when
      const result = deserializer.deserialize(value);

      // then
      expect(result).toEqual({
        pattern: 'stream-1',
        id: 'stream-id-1',
        data: [1, 2, 3, 4, 5],
      });
    });

    it('should deserialize stream data when JSON Array is provided', async () => {
      // given
      // NOTE : if Array is provided, isArray header is added to the message
      const value: RedisStreamData = [
        'stream-1',
        [
          [
            'stream-id-1',
            [
              '0',
              '{"name":"A","age":27,"profile":{"position":"dev"}}',
              '1',
              '{"name":"B","profile":{"position":"dev"}}',
              DEFAULT_LIB_MESSAGE_HEADER,
              '{"isArray":true}',
            ],
          ],
        ],
      ];

      // when
      const result = deserializer.deserialize(value);

      // then
      expect(result).toEqual({
        pattern: 'stream-1',
        id: 'stream-id-1',
        data: [
          {
            name: 'A',
            age: 27,
            profile: {
              position: 'dev',
            },
          },
          {
            name: 'B',
            profile: {
              position: 'dev',
            },
          },
        ],
        correlationId: undefined,
      });
    });

    it('should deserialize stream data when JSON Array is provided with correlationId', async () => {
      // given
      // NOTE : if Array is provided, isArray header is added to the message
      const value: RedisStreamData = [
        'stream-1',
        [
          [
            'stream-id-1',
            [
              '0',
              '{"name":"A","age":27,"profile":{"position":"dev"}}',
              '1',
              '{"name":"B","profile":{"position":"dev"}}',
              DEFAULT_LIB_MESSAGE_HEADER,
              '{"correlationId":"correlation-id","isArray":true}',
            ],
          ],
        ],
      ];

      // when
      const result = deserializer.deserialize(value);

      // then
      expect(result).toEqual({
        pattern: 'stream-1',
        id: 'stream-id-1',
        data: [
          {
            name: 'A',
            age: 27,
            profile: {
              position: 'dev',
            },
          },
          {
            name: 'B',
            profile: {
              position: 'dev',
            },
          },
        ],
        correlationId: 'correlation-id',
      });
    });

    it('should set origin data when JSON.parse failed', async () => {
      // given
      const value: RedisStreamData = ['stream-1', [['stream-id-1', ['invalidJson', '{data: 27}']]]];

      // when
      const result = deserializer.deserialize(value);

      // then
      expect(result).toEqual({
        pattern: 'stream-1',
        id: 'stream-id-1',
        data: {
          invalidJson: '{data: 27}',
        },
      });
    });
  });
});
