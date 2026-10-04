import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { auth, createUser } from '../helpers/factories.js';
import { closeTestApp, createTestApp, type TestApp } from '../helpers/test-app.js';

describe('Comments (e2e)', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app.app);
  });

  it('creates a comment and a reply, then lists them separately', async () => {
    const user = await createUser(app);

    const postId = (
      await request(app.app.getHttpServer())
        .post('/api/v1/posts')
        .set(auth(user))
        .send({ content: 'post' })
        .expect(201)
    ).body.id;

    const commentId = (
      await request(app.app.getHttpServer())
        .post(`/api/v1/posts/${postId}/comments`)
        .set(auth(user))
        .send({ text: 'parent' })
        .expect(201)
    ).body.id;

    await request(app.app.getHttpServer())
      .post(`/api/v1/posts/${postId}/comments`)
      .set(auth(user))
      .send({ text: 'reply', parentCommentId: commentId })
      .expect(201);

    const topLevel = await request(app.app.getHttpServer())
      .get(`/api/v1/posts/${postId}/comments`)
      .expect(200);

    expect(topLevel.body.data).toHaveLength(1);
    expect(topLevel.body.data[0].totalReplies).toBe(1);

    const replies = await request(app.app.getHttpServer())
      .get(`/api/v1/posts/${postId}/comments/${commentId}/replies`)
      .expect(200);

    expect(replies.body.data).toHaveLength(1);
  });

  it('rejects a reply whose parent is on another post', async () => {
    const user = await createUser(app);

    const makePost = () =>
      request(app.app.getHttpServer()).post('/api/v1/posts').set(auth(user)).send({ content: 'p' });

    const postA = (await makePost().expect(201)).body.id;
    const postB = (await makePost().expect(201)).body.id;

    const parentId = (
      await request(app.app.getHttpServer())
        .post(`/api/v1/posts/${postA}/comments`)
        .set(auth(user))
        .send({ text: 'parent' })
        .expect(201)
    ).body.id;

    await request(app.app.getHttpServer())
      .post(`/api/v1/posts/${postB}/comments`)
      .set(auth(user))
      .send({ text: 'cross', parentCommentId: parentId })
      .expect(400);
  });

  it('requires a token to comment', async () => {
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
      .send({ text: 'x' })
      .expect(401);
  });
});