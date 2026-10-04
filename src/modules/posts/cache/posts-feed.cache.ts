import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../config/index.js';
import { RedisService } from '../../../infrastructure/redis/redis.service.js';
import { parseFeedPage, type FeedPage } from './posts-feed.codec.js';
//مدیر کش اطلاعتت پست هااا
//لیست پست ها در ردیس ذخیره میشه تا دیتا بیس هعی زرتو پرت رفرش نشه


const GENERATION_KEY = 'posts:feed:v1:generation';
const feedKey = (generation: string, page: number, limit: number): string =>
  `posts:feed:v1:g${generation}:page:${page}:limit:${limit}`;

@Injectable()
export class PostsFeedCache {
  private readonly logger = new Logger(PostsFeedCache.name);

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async get(page: number, limit: number): Promise<{ generation: string; payload: FeedPage | null }> {
    const generation = (await this.redis.get(GENERATION_KEY)) ?? '0';
    const key = feedKey(generation, page, limit);
    const raw = await this.redis.get(key);
    if (raw === null) return { generation, payload: null };

    const payload = parseFeedPage(raw);
    if (!payload) {
      this.logger.warn(`Corrupt feed cache entry removed: ${key}`);
      await this.redis.del(key);
    }
    return { generation, payload };
  }

  async set(generation: string, page: number, limit: number, payload: FeedPage): Promise<void> {
    const { ttlSeconds } = this.config.get('feedCache', { infer: true });
    await this.redis.set(feedKey(generation, page, limit), JSON.stringify(payload), ttlSeconds);
  }

  async invalidate(): Promise<void> {
    const next = await this.redis.incr(GENERATION_KEY);
    if (next === null) {
      this.logger.warn('Feed cache invalidation failed; feed may be stale until TTL expires');
    }
  }
}