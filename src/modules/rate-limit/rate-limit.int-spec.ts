import 'dotenv/config';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RedisService } from '../../infrastructure/redis/redis.service.js';
import { RateLimitService } from './rate-limit.service.js';

const TEST_URL = process.env.REDIS_URL_TEST ?? 'redis://localhost:6380/15';
const LIMIT = 10;
const FIXED_NOW = 1_800_000_000_000;

function fakeConfig(url: string) {
  return {
    get: (key: string) =>
      key === 'redis' ? { url } : { limit: LIMIT, windowSeconds: 60 },
  };
}

describe('RateLimitService (real Redis)', () => {
  let redis: RedisService;
  let service: RateLimitService;
  let admin: Redis;

  beforeAll(async () => {
    if (!TEST_URL.endsWith('/15')) throw new Error('REDIS_URL_TEST must use logical DB 15');
    admin = new Redis(TEST_URL);
    redis = new RedisService(fakeConfig(TEST_URL) as never);
    await redis.onModuleInit();
    service = new RateLimitService(redis, fakeConfig(TEST_URL) as never);
  });

  beforeEach(async () => {
    await admin.flushdb();
  });

  afterAll(async () => {
    await redis.onModuleDestroy();
    await admin.quit();
  });

  it('allows exactly LIMIT of 25 parallel attempts', async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, () => service.consumePostCreateAttempt('user-1', FIXED_NOW)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(LIMIT);
    expect(results.filter((r) => !r.allowed)).toHaveLength(25 - LIMIT);
  });

  it('keeps users independent', async () => {
    for (let i = 0; i < LIMIT; i++) await service.consumePostCreateAttempt('user-a', FIXED_NOW);
    const other = await service.consumePostCreateAttempt('user-b', FIXED_NOW);
    expect(other.allowed).toBe(true);
  });

  it('reports a positive Retry-After and starts a fresh window later', async () => {
    for (let i = 0; i <= LIMIT; i++) await service.consumePostCreateAttempt('user-c', FIXED_NOW);
    const blocked = await service.consumePostCreateAttempt('user-c', FIXED_NOW);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);

    const nextWindow = await service.consumePostCreateAttempt('user-c', FIXED_NOW + 61_000);
    expect(nextWindow.allowed).toBe(true);
  });
});