import { fail } from 'assert';
import axios from 'axios';
import { Redis } from 'ioredis';
import { getKeysByPattern, sleep } from './util';

describe('E2E: App', () => {
  let redis: Redis;

  beforeEach(async () => {
    redis = new Redis({
      host: '127.0.0.1',
      port: 6388,
      password: 'beobwoo',
    });

    const keys = await getKeysByPattern(redis, 'stream-1-data/*');
    await Promise.all(keys.map((key) => redis.del(key)));
  });

  describe('emit Messages', () => {
    const stream = 'stream-1';
    const body = {
      num: 1,
      str: 'string',
      bool: true,
      type: {
        strategy: 'emit',
      },
    };

    it(
      'The message delivered by the requester should be delivered to the respondent.',
      async () => {
        const COUNT = 100;

        // when
        await Promise.all(
          Array.from({ length: COUNT }).map(() =>
            axios.post(`http://localhost:3081/test/emit/${stream}`, body),
          ),
        );
        await sleep(1000);

        // then
        const keys = await getKeysByPattern(redis, 'stream-1-data/*');
        const values = await Promise.all(keys.map(async (key) => JSON.parse(await redis.get(key))));

        expect(values).toHaveLength(COUNT);
        for (const value of values) {
          expect(value).toMatchObject(body);
          expect(value.responder).toMatch(/Responder [12]/);
        }
      },
      1000 * 10,
    );

    it('should not throw an error even if the request stream is invalid.', async () => {
      // when
      const response = await axios.post('http://localhost:3081/test/emit/invalid-stream', {
        ...body,
        type: {
          strategy: 'invalid',
        },
      });

      // then
      expect(response.status).toBe(201);
    });

    it('should not throw an error even if the request body is empty', async () => {
      // when
      const response = await axios.post(`http://localhost:3081/test/emit/${stream}`);

      // then
      expect(response.status).toBe(201);
    });
  });

  describe('send Messages', () => {
    // given
    const stream = 'stream-1';
    const COUNT = 100;
    const body = {
      num: 1,
      str: 'string',
      bool: true,
      type: {
        strategy: 'send ',
      },
    };

    it('should throw an timeout error when the request stream is invalid.', async () => {
      try {
        // when
        await axios.post('http://localhost:3081/test/send/invalid-stream', {
          ...body,
          type: {
            strategy: 'invalid',
          },
        });

        fail('It should throw an error');
      } catch (e: any) {
        // then
        expect(e.response.status).toBe(500);
      }
    });

    it('should throw an error even if the request body is empty.', async () => {
      // when
      const response = await axios.post(`http://localhost:3081/test/send/${stream}`);

      // then
      expect(response.status).toBe(201);
      expect(response.data).toEqual({});
    });

    it(
      'The message delivered by the requester should be delivered to the respondent.',
      async () => {
        // when
        await Promise.all(
          Array.from({ length: COUNT }).map(
            async () => (await axios.post(`http://localhost:3081/test/send/${stream}`, body)).data,
          ),
        );
        await sleep(1000);

        // then
        const keys = await getKeysByPattern(redis, 'stream-1-data/*');
        const values = await Promise.all(keys.map(async (key) => JSON.parse(await redis.get(key))));

        expect(values).toHaveLength(COUNT);

        for (const value of values) {
          expect(value).toMatchObject(body);
          expect(value.responder).toMatch(/Responder [12]/);
        }
      },
      1000 * 10,
    );

    it.skip(
      'The message returned by the respondent should be returned to the requester.',
      async () => {
        // when
        const responsesToRequestor1 = await Promise.all(
          Array.from({ length: COUNT }).map(
            async () =>
              (
                await axios.post(`http://localhost:3081/test/send/${stream}`, {
                  ...body,
                  requestor: 'Requestor 1',
                })
              ).data,
          ),
        );
        const responsesToRequestor2 = await Promise.all(
          Array.from({ length: COUNT }).map(
            async () =>
              (
                await axios.post(`http://localhost:3082/test/send/${stream}`, {
                  ...body,
                  requestor: 'Requestor 2',
                })
              ).data,
          ),
        );

        await sleep(1000);

        // then
        expect(responsesToRequestor1).toHaveLength(COUNT);
        expect(responsesToRequestor2).toHaveLength(COUNT);

        for (const response of responsesToRequestor1) {
          expect(response).toMatchObject(body);
          expect(response.responder).toMatch(/Responder [12]/);
        }

        for (const response of responsesToRequestor2) {
          expect(response).toMatchObject(body);
          expect(response.responder).toMatch(/Responder [12]/);
        }
      },
      1000 * 10,
    );

    describe('Payload Validation', () => {
      const testBody = [
        {
          description: 'JSON Object with a number',
          body: {
            num: 1,
          },
        },
        {
          description: 'JSON Object with a string',
          body: {
            str: 'string',
          },
        },
        {
          description: 'JSON Object with a nested object',
          body: {
            body: {
              body: {
                a: 1,
              },
            },
          },
        },
        {
          description: 'Primitive Array',
          body: [1, 2, 3],
        },
        {
          description: 'JSON Array',
          body: [
            {
              body: {
                body: {
                  a: 1,
                },
              },
            },
            {
              body: {
                body: {
                  b: 1,
                },
              },
            },
          ],
        },
      ];

      it.each(testBody)('should return a response when %s', async ({ body }) => {
        // when
        const response = await axios.post(`http://localhost:3081/test/send/${stream}`, body);

        // then
        expect(response.data).toMatchObject(body);
      });
    });
  });

  afterEach(async () => {
    redis.disconnect();
  });
});
