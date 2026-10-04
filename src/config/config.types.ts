export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigin: string | undefined;
  database: { url: string };
  redis: { url: string };
  jwt: { secret: string; expiresInSeconds: number };
  feedCache: { ttlSeconds: number };
  postCreateRateLimit: { limit: number; windowSeconds: number };
}
