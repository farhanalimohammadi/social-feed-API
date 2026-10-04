import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { auth, createUser } from '../helpers/factories.js';
import { closeTestApp, createTestApp, type TestApp } from '../helpers/test-app.js';

describe('Auth (e2e)', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app.app);
  });

  it('registers, logs in and returns the current user', async () => {
    const user = await createUser(app);

    const me = await request(app.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(auth(user))
      .expect(200);

    expect(me.body.user).toMatchObject({
      id: user.id,
      username: user.username,
      email: user.email,
    });
  });

  it('rejects duplicate email and unknown fields', async () => {
    const user = await createUser(app);

    await request(app.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        username: user.username,
        email: user.email,
        password: 'SuperSecret1!',
      })
      .expect(409);

    await request(app.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        username: 'tester_1',
        email: 'tester_1@example.com',
        password: 'SuperSecret1!',
        role: 'admin',
      })
      .expect(400);
  });

  it('returns the same 401 for unknown email and wrong password', async () => {
    const user = await createUser(app);

    const unknown = await request(app.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@example.com', password: 'SuperSecret1!' });

    const badPassword = await request(app.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'WrongPass1!' });

    expect(unknown.status).toBe(401);
    expect(badPassword.status).toBe(401);
    expect(unknown.body.message).toBe(badPassword.body.message);
  });

  it('rejects /me without a token', async () => {
    await request(app.app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });
});