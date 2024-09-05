import { DEFAULT_LIB_MESSAGE_HEADER, OutboundRedisStreamMessageSerializer } from '../src/index';

describe('OutboundRedisStreamMessageSerializer', () => {
  let serializer: OutboundRedisStreamMessageSerializer;

  beforeEach(() => {
    serializer = new OutboundRedisStreamMessageSerializer();
  });

  describe('serialize', () => {
    it('should serialize stream data when Nested JSON Object is provided', async () => {
      // given
      const value = {
        type: 'SEND',
        name: 'beobwoo',
        age: 27,
        profile: {
          company: 'bubblecloud.io',
          position: 'developer',
        },
        isDeveloper: true,
      };

      // when
      const result = serializer.serialize(value);

      // then
      expect(result).toEqual([
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
      ]);
    });

    it('should serialize stream data when JSON Array is provided', async () => {
      // given
      const value = [
        {
          type: 'SEND',
          name: 'beobwoo',
          age: 27,
          profile: {
            company: 'bubblecloud.io',
            position: 'developer',
          },
          isDeveloper: true,
        },
        {
          type: 'SEND',
          name: 'beobwoo',
          age: 27,
          isDeveloper: true,
        },
      ];

      // when
      const result = serializer.serialize(value);

      // then
      expect(result).toEqual([
        '0',
        '{"type":"SEND","name":"beobwoo","age":27,"profile":{"company":"bubblecloud.io","position":"developer"},"isDeveloper":true}',
        '1',
        '{"type":"SEND","name":"beobwoo","age":27,"isDeveloper":true}',
        DEFAULT_LIB_MESSAGE_HEADER,
        '{"isArray":true}',
      ]);
    });

    it('should serialize stream data when Primitive Array is provided', async () => {
      // given
      const value = [1, 2, 3, 4, 5];

      // when
      const result = serializer.serialize(value);

      // then
      expect(result).toEqual([
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
      ]);
    });

    it('should contain correlationId in lib header when correlationId is provided', async () => {
      // given
      const value = {};

      // when
      const result = serializer.serialize(value, { correlationId: 'correlation-id' });

      // then
      expect(result).toEqual([DEFAULT_LIB_MESSAGE_HEADER, '{"correlationId":"correlation-id"}']);
    });

    it('should contain isArray in lib header when value is array', async () => {
      // given
      const value = [];

      // when
      const result = serializer.serialize(value);

      // then
      expect(result).toEqual([DEFAULT_LIB_MESSAGE_HEADER, '{"isArray":true}']);
    });
  });
});
