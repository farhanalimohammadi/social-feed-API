import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { closeTestApp, createTestApp, type TestApp } from '../helpers/test-app.js';

describe('Health (e2e)', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app.app);
  });

  it('reports liveness without touching the database', async () => {
    const res = await request(app.app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('reports readiness when the database is reachable', async () => {
    const res = await request(app.app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200);

    expect(res.body.details.database.status).toBe('up');
  });
});