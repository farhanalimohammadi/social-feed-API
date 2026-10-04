import type { AppConfig } from './config.types.js';
import { validateEnv } from './env.validation.js';

export default (): AppConfig => {
  const env = validateEnv(process.env);

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    corsOrigin: env.CORS_ORIGIN,
    database: { url: env.DATABASE_URL },
    redis: { url: env.REDIS_URL },
    jwt: { secret: env.JWT_SECRET, expiresInSeconds: env.JWT_EXPIRES_IN },
    feedCache: { ttlSeconds: env.FEED_CACHE_TTL_SECONDS },
    postCreateRateLimit: {
      limit: env.POST_CREATE_RATE_LIMIT,
      windowSeconds: env.POST_CREATE_RATE_WINDOW_SECONDS,
    },
  };
};
