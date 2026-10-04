import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt() @Min(1) @Max(65535)
  PORT: number = 3000;

  @IsUrl({ protocols: ['postgres', 'postgresql'], require_tld: false, require_protocol: true })
  DATABASE_URL!: string;

  @IsUrl({ protocols: ['redis', 'rediss'], require_tld: false, require_protocol: true })
  REDIS_URL!: string;

  @IsString() @MinLength(32)
  JWT_SECRET!: string;

  @IsInt() @Min(60) @Max(2_592_000)
  JWT_EXPIRES_IN: number = 3600;

  @IsInt() @Min(1) @Max(3600)
  FEED_CACHE_TTL_SECONDS: number = 30;

  @IsInt() @Min(1) @Max(1000)
  POST_CREATE_RATE_LIMIT: number = 10;

  @IsInt() @Min(1) @Max(3600)
  POST_CREATE_RATE_WINDOW_SECONDS: number = 60;

  @IsOptional() @IsString()
  CORS_ORIGIN?: string;
}

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const instance = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });

  const errors = validateSync(instance, {
    skipMissingProperties: false,
    whitelist: true,
  });

  if (errors.length > 0) {
    const details = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join('; ')}`)
      .join('\n  - ');
    throw new Error(`Invalid environment configuration:\n  - ${details}`);
  }

  return instance;
}