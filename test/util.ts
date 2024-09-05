export const getKeysByPattern = async (redis: any, pattern: string): Promise<string[]> => {
  let cursor = '0';
  const keys: string[] = [];

  do {
    const [newCursor, batch] = await redis.scan(cursor, 'MATCH', pattern);
    cursor = newCursor;
    keys.push(...batch);
  } while (cursor !== '0'); // Continue scanning until the cursor is back to 0

  return keys;
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
