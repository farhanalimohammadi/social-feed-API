import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CommentsService } from './comments.service.js';

const POST_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_POST_ID = '22222222-2222-4222-8222-222222222222';
const PARENT_ID = '33333333-3333-4333-8333-333333333333';

const row = {
  id: 'c1', postId: POST_ID, parentCommentId: null, text: 'hi',
  createdAt: new Date(), author: { id: 'u1', username: 'ali' }, _count: { replies: 0 },
};

function setup() {
  const prisma = {
    post: { findUnique: vi.fn().mockResolvedValue({ id: POST_ID }) },
    comment: {
      findUnique: vi.fn().mockResolvedValue({ postId: POST_ID }),
      findFirst: vi.fn().mockResolvedValue({ id: PARENT_ID }),
      create: vi.fn().mockResolvedValue(row),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const posts = { invalidateFeedCache: vi.fn().mockResolvedValue(undefined) };
  return { service: new CommentsService(prisma as never, posts as never), prisma, posts };
}

describe('CommentsService', () => {
  it('creates a top-level comment and invalidates the feed cache', async () => {
    const { service, posts } = setup();
    await service.create(POST_ID, 'u1', { text: 'hi' });
    expect(posts.invalidateFeedCache).toHaveBeenCalledTimes(1);
  });

  it('rejects commenting on a missing post and does not invalidate', async () => {
    const { service, prisma, posts } = setup();
    prisma.post.findUnique.mockResolvedValue(null);
    await expect(service.create(POST_ID, 'u1', { text: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    expect(posts.invalidateFeedCache).not.toHaveBeenCalled();
  });

  it('rejects a reply whose parent belongs to another post', async () => {
    const { service, prisma } = setup();
    prisma.comment.findUnique.mockResolvedValue({ postId: OTHER_POST_ID });
    await expect(
      service.create(POST_ID, 'u1', { text: 'x', parentCommentId: PARENT_ID }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  it('rejects a reply to a missing parent', async () => {
    const { service, prisma } = setup();
    prisma.comment.findUnique.mockResolvedValue(null);
    await expect(
      service.create(POST_ID, 'u1', { text: 'x', parentCommentId: PARENT_ID }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists every comment of an author, replies included', async () => {
  const { service, prisma } = setup();
  await service.findByAuthor('u1', { page: 1, limit: 20 });
  expect(prisma.comment.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { authorId: 'u1' } }),
  );
});

  it('lists only top-level comments', async () => {
    const { service, prisma } = setup();
    await service.findTopLevel(POST_ID, { page: 1, limit: 20 });
    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { postId: POST_ID, parentCommentId: null } }),
    );
  });

  it('lists only direct replies of a comment on the same post', async () => {
    const { service, prisma } = setup();
    await service.findReplies(POST_ID, PARENT_ID, { page: 1, limit: 20 });
    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { postId: POST_ID, parentCommentId: PARENT_ID } }),
    );
  });

  it('returns 404 for replies of a comment that is not on this post', async () => {
    const { service, prisma } = setup();
    prisma.comment.findFirst.mockResolvedValue(null);
    await expect(
      service.findReplies(POST_ID, PARENT_ID, { page: 1, limit: 20 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});