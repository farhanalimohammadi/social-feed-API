import { Redis } from 'ioredis';

const TEST_URL = process.env.REDIS_URL_TEST ?? 'redis://localhost:6380/15';

export async function connectTestRedis(): Promise<Redis> {
  if (!TEST_URL.endsWith('/15')) throw new Error('REDIS_URL_TEST must use logical DB 15');
  return new Redis(TEST_URL);
}

export async function resetRedis(): Promise<void> {
  if (!TEST_URL.endsWith('/15')) throw new Error('REDIS_URL_TEST must use logical DB 15');
  const client = new Redis(TEST_URL);
  try {
    await client.flushdb();
  } finally {
    await client.quit();
  }
}