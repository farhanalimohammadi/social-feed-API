import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { auth, createUser } from '../helpers/factories.js';
import { closeTestApp, createTestApp, type TestApp } from '../helpers/test-app.js';

describe('Posts (e2e)', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app.app);
  });

  it('creates a post and returns it in the feed', async () => {
    const user = await createUser(app);

    const created = await request(app.app.getHttpServer())
      .post('/api/v1/posts')
      .set(auth(user))
      .send({ content: 'hello world', caption: 'first' })
      .expect(201);

    expect(created.body.author.username).toBe(user.username);
    expect(created.body.totalComments).toBe(0);

    const feed = await request(app.app.getHttpServer())
      .get('/api/v1/posts?page=1&limit=5')
      .expect(200);

    expect(feed.body.data.some((post: { id: string }) => post.id === created.body.id)).toBe(true);
  });

  it('rejects authorId in the body with 400', async () => {
    const user = await createUser(app);

    await request(app.app.getHttpServer())
      .post('/api/v1/posts')
      .set(auth(user))
      .send({ content: 'x', authorId: user.id })
      .expect(400);
  });

  it('returns the post thread with paginated top-level comments and their reply counts', async () => {
    const user = await createUser(app);
    const server = app.app.getHttpServer();

    const postId = (
      await request(server)
        .post('/api/v1/posts')
        .set(auth(user))
        .send({ content: 'thread' })
        .expect(201)
    ).body.id;
    const first = (
      await request(server)
        .post(`/api/v1/posts/${postId}/comments`)
        .set(auth(user))
        .send({ text: 'first' })
        .expect(201)
    ).body.id;
    await request(server)
      .post(`/api/v1/posts/${postId}/comments`)
      .set(auth(user))
      .send({ text: 'second' })
      .expect(201);
    await request(server)
      .post(`/api/v1/posts/${postId}/comments`)
      .set(auth(user))
      .send({ text: 'reply', parentCommentId: first })
      .expect(201);

    const thread = await request(server).get(`/api/v1/posts/${postId}?page=1&limit=1`).expect(200);

    expect(thread.body.author.username).toBe(user.username);
    expect(thread.body.totalComments).toBe(3);
    expect(thread.body.comments.meta).toEqual({
      currentPage: 1,
      itemsPerPage: 1,
      totalItems: 2,
      totalPages: 2,
    });
    expect(thread.body.comments.data[0].text).toBe('second');
    expect(thread.body.comments.data[0].author.username).toBe(user.username);

    const page2 = await request(server).get(`/api/v1/posts/${postId}?page=2&limit=1`).expect(200);
    expect(page2.body.comments.data[0]).toMatchObject({ id: first, totalReplies: 1 });
  });

  it('returns 404 for an unknown post id', async () => {
    await request(app.app.getHttpServer())
      .get('/api/v1/posts/11111111-1111-4111-8111-111111111111')
      .expect(404);
  });

  it('rate-limits the 11th attempt with Retry-After', async () => {
    const user = await createUser(app);
    const post = () =>
      request(app.app.getHttpServer()).post('/api/v1/posts').set(auth(user)).send({ content: 'spam' });

    for (let i = 0; i < 10; i += 1) {
      await post().expect(201);
    }

    const blocked = await post().expect(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThanOrEqual(1);
  });
});