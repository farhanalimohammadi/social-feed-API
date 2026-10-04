import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client.js';

describe('database schema constraints', () => {
  let prisma: PrismaClient | undefined;

  const db = (): PrismaClient => {
    if (!prisma) throw new Error('Prisma client was not initialised');
    return prisma;
  };

  const seed = async () => {
    const user = await db().user.create({
      data: { username: 'ali', email: 'ali@example.com', passwordHash: 'x'.repeat(60) },
    });
    const postA = await db().post.create({ data: { authorId: user.id, content: 'post A' } });
    const postB = await db().post.create({ data: { authorId: user.id, content: 'post B' } });
    return { user, postA, postB };
  };

  beforeAll(() => {
    const url = process.env.DATABASE_URL_TEST;
    if (!url) throw new Error('DATABASE_URL_TEST is required for integration tests');
    if (!/_test(\?|$)/.test(url)) {
      throw new Error('DATABASE_URL_TEST must point to a database whose name ends with _test');
    }
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  });

  beforeEach(async () => {
    await db().$executeRawUnsafe('TRUNCATE TABLE "comments", "posts", "users" CASCADE');
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('rejects a reply whose parent belongs to another post', async () => {
    const { user, postA, postB } = await seed();
    const parent = await db().comment.create({
      data: { postId: postA.id, authorId: user.id, text: 'parent' },
    });

    await expect(
      db().comment.create({
        data: { postId: postB.id, authorId: user.id, parentCommentId: parent.id, text: 'cross' },
      }),
    ).rejects.toThrow();
  });

  it('accepts a reply whose parent belongs to the same post', async () => {
    const { user, postA } = await seed();
    const parent = await db().comment.create({
      data: { postId: postA.id, authorId: user.id, text: 'parent' },
    });

    const reply = await db().comment.create({
      data: { postId: postA.id, authorId: user.id, parentCommentId: parent.id, text: 'reply' },
    });
    expect(reply.parentCommentId).toBe(parent.id);
  });

  it('rejects a comment that is its own parent', async () => {
    const { user, postA } = await seed();
    const id = randomUUID();

    await expect(
      db().comment.create({
        data: { id, postId: postA.id, authorId: user.id, parentCommentId: id, text: 'self' },
      }),
    ).rejects.toThrow();
  });

  it('rejects blank post content and blank comment text', async () => {
    const { user, postA } = await seed();

    await expect(
      db().post.create({ data: { authorId: user.id, content: '   ' } }),
    ).rejects.toThrow();
    await expect(
      db().comment.create({ data: { postId: postA.id, authorId: user.id, text: '  ' } }),
    ).rejects.toThrow();
  });

  it('rejects non-lowercase username and email', async () => {
    await expect(
      db().user.create({
        data: { username: 'Ali', email: 'ali@example.com', passwordHash: 'x'.repeat(60) },
      }),
    ).rejects.toThrow();
    await expect(
      db().user.create({
        data: { username: 'ali', email: 'Ali@Example.com', passwordHash: 'x'.repeat(60) },
      }),
    ).rejects.toThrow();
  });

  it('rejects duplicate username or email', async () => {
    await seed();

    await expect(
      db().user.create({
        data: { username: 'ali', email: 'other@example.com', passwordHash: 'x'.repeat(60) },
      }),
    ).rejects.toThrow();
  });

  it('restricts deleting a user who still has posts', async () => {
    const { user } = await seed();

    await expect(db().user.delete({ where: { id: user.id } })).rejects.toThrow();
  });
});