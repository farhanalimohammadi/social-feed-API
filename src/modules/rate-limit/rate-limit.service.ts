import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/index.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';
import { CONSUME_ATTEMPT_SCRIPT } from './lua/consume-attempt.lua.js';
//سیستم محدود کننده برای جلوگیری از اسپم

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  degraded: boolean;
}

const KEY_PREFIX = 'ratelimit:posts:create:v1';

@Injectable()
export class RateLimitService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async consumePostCreateAttempt(userId: string, nowMs: number = Date.now()): Promise<RateLimitDecision> {
    const { limit, windowSeconds } = this.config.get('postCreateRateLimit', { infer: true });

    const nowSeconds = Math.floor(nowMs / 1000);
    const windowIndex = Math.floor(nowSeconds / windowSeconds);
    const retryAfterSeconds = Math.max(1, windowSeconds - (nowSeconds % windowSeconds));
    const key = `${KEY_PREFIX}:user:${userId}:window:${windowIndex}`;

    const result = await this.redis.eval(CONSUME_ATTEMPT_SCRIPT, [key], [windowSeconds]);

    //ما تعریف کردیم بودیم که سرویس ردیش کرش نمیکنه بلکه نال بر میگردونه 
    //پس در اینجا سیستم چک میکنه اگر خروجی ردیس عدد نبود یعنی به عبارتی قطع بود درخواست کاربر رو رد نمیکنه بلکه degraded: true میکنه
    if (typeof result !== 'number') {
      return { allowed: true, limit, remaining: limit, retryAfterSeconds, degraded: true };
    }

    return {
      allowed: result <= limit,
      limit,
      remaining: Math.max(0, limit - result),
      retryAfterSeconds,
      degraded: false,
    };
  }
}