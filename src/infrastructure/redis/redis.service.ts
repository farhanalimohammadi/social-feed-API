import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { AppConfig } from '../../config/index.js';
//سرویس مدریت کش با ردیس و مقاوم در برابر خرابی ها همون 

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private errorLogged = false;// تضمین میکند خطا فقط یه یکبار لاگ شود  و فضار سورور با لاگ های تکراری پر نشه

  constructor(config: ConfigService<AppConfig, true>) {
    const { url } = config.get('redis', { infer: true });

    this.client = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 2000,
      commandTimeout: 1000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    this.client.on('error', (error: Error) => {
      if (this.errorLogged) return;
      this.errorLogged = true;
      this.logger.warn(`Redis error: ${error.message}`);
    });
    
    this.client.on('ready', () => {
      this.errorLogged = false;
      this.logger.log('Redis connection ready');
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.warn(`Redis unavailable at startup: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  get(key: string): Promise<string | null> {
    return this.safe('get', () => this.client.get(key));
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    return (await this.safe('set', () => this.client.set(key, value, 'EX', ttlSeconds))) === 'OK';
  }

  async del(key: string): Promise<boolean> {
    return (await this.safe('del', () => this.client.del(key))) !== null;
  }

  incr(key: string): Promise<number | null> {
    return this.safe('incr', () => this.client.incr(key));
  }

  eval(script: string, keys: string[], args: Array<string | number>): Promise<unknown> {
    return this.safe('eval', () => this.client.eval(script, keys.length, ...keys, ...args));
  }

  private async safe<T>(operation: string, run: () => Promise<T>): Promise<T | null> {
    try {
      return await run();
    } catch (error) {
      this.logger.warn(`Redis ${operation} failed: ${(error as Error).message}`);
      return null;
    }
  }
}