import { Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

const TIMEOUT_MS = 1500;

@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly indicators: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.indicators.check(key);
    let timer: NodeJS.Timeout | undefined;

    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS);
      });
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout]);
      return indicator.up();
    } catch {
      return indicator.down({ message: 'Database is unreachable' });
    } finally {
      clearTimeout(timer);
    }
  }
}