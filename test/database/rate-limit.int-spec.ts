import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configuration } from '../../src/config/index.js';
import { RedisModule } from '../../src/infrastructure/redis/redis.module.js';
import { RateLimitModule } from '../../src/modules/rate-limit/rate-limit.module.js';
import { RateLimitService } from '../../src/modules/rate-limit/rate-limit.service.js';
import { connectTestRedis, resetRedis } from '../helpers/redis-reset.js';

const LIMIT = 10;
const WINDOW_SECONDS = 60;

describe('RateLimitService (Redis)', () => {
  let moduleRef: TestingModule;
  let rateLimit: RateLimitService;

  beforeAll(async () => {
    process.env.POST_CREATE_RATE_LIMIT = String(LIMIT);
    process.env.POST_CREATE_RATE_WINDOW_SECONDS = String(WINDOW_SECONDS);

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        RedisModule,
        RateLimitModule,
      ],
    }).compile();
    await moduleRef.init();
    rateLimit = moduleRef.get(RateLimitService);
  });

  beforeEach(async () => {
    await resetRedis();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('allows exactly 10 of 25 concurrent attempts in one window', async () => {
    const userId = randomUUID();
    const now = Date.now();

    const decisions = await Promise.all(
      Array.from({ length: 25 }, () => rateLimit.consumePostCreateAttempt(userId, now)),
    );

    expect(decisions.every((d) => !d.degraded)).toBe(true);
    expect(decisions.filter((d) => d.allowed)).toHaveLength(10);
    expect(decisions.filter((d) => !d.allowed)).toHaveLength(15);
    expect(Math.min(...decisions.map((d) => d.remaining))).toBe(0);
  });

  it('sets a TTL on the window key that never exceeds the window length', async () => {
    const userId = randomUUID();
    const now = Date.now();
    await rateLimit.consumePostCreateAttempt(userId, now);
    await rateLimit.consumePostCreateAttempt(userId, now);

    const windowId = Math.floor(Math.floor(now / 1000) / WINDOW_SECONDS);
    const key = `ratelimit:posts:create:v1:user:${userId}:window:${windowId}`;

    const redis = await connectTestRedis();
    try {
      expect(await redis.get(key)).toBe('2');
      const ttl = await redis.ttl(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(WINDOW_SECONDS);
    } finally {
      await redis.quit();
    }
  });

  it('counts users independently', async () => {
    const now = Date.now();
    const [a, b] = [randomUUID(), randomUUID()];

    for (let i = 0; i < LIMIT; i++) await rateLimit.consumePostCreateAttempt(a, now);

    expect((await rateLimit.consumePostCreateAttempt(a, now)).allowed).toBe(false);
    expect((await rateLimit.consumePostCreateAttempt(b, now)).allowed).toBe(true);
  });

  it('starts a fresh count in the next window', async () => {
    const userId = randomUUID();
    const now = Date.now();

    for (let i = 0; i < LIMIT; i++) await rateLimit.consumePostCreateAttempt(userId, now);
    expect((await rateLimit.consumePostCreateAttempt(userId, now)).allowed).toBe(false);

    const nextWindow = now + WINDOW_SECONDS * 1000;
    const decision = await rateLimit.consumePostCreateAttempt(userId, nextWindow);
    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(LIMIT - 1);
  });
});
