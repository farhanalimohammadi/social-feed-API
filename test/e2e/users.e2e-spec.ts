import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { auth, createUser } from '../helpers/factories.js';
import { closeTestApp, createTestApp, type TestApp } from '../helpers/test-app.js';

describe('Users (e2e)', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app.app);
  });

  it('returns profile with stats and paginated history', async () => {
    const user = await createUser(app);

    const postId = (
      await request(app.app.getHttpServer())
        .post('/api/v1/posts')
        .set(auth(user))
        .send({ content: 'p' })
        .expect(201)
    ).body.id;

    await request(app.app.getHttpServer())
      .post(`/api/v1/posts/${postId}/comments`)
      .set(auth(user))
      .send({ text: 'c' })
      .expect(201);

    const profile = await request(app.app.getHttpServer())
      .get(`/api/v1/users/${user.id}/profile`)
      .expect(200);

    expect(profile.body.stats).toEqual({ totalPosts: 1, totalComments: 1 });
    expect(profile.body.recentActivity).toHaveLength(2);

    const posts = await request(app.app.getHttpServer())
      .get(`/api/v1/users/${user.id}/posts?limit=10`)
      .expect(200);
    expect(posts.body.meta.totalItems).toBe(1);

    const comments = await request(app.app.getHttpServer())
      .get(`/api/v1/users/${user.id}/comments?limit=10`)
      .expect(200);
    expect(comments.body.meta.totalItems).toBe(1);
  });

  it('returns 404 for an unknown user and 400 for a bad uuid', async () => {
    await request(app.app.getHttpServer())
      .get('/api/v1/users/11111111-1111-4111-8111-111111111111/profile')
      .expect(404);

    await request(app.app.getHttpServer()).get('/api/v1/users/not-a-uuid/profile').expect(400);
  });
});