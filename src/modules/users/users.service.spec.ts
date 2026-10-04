import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service.js';

const QUERY = { page: 2, limit: 10 };

function setup(user: unknown) {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(user) },
    post: { findMany: vi.fn().mockResolvedValue([]) },
    comment: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const posts = { findByAuthor: vi.fn().mockResolvedValue({ data: [], meta: {} }) };
  const comments = { findByAuthor: vi.fn().mockResolvedValue({ data: [], meta: {} }) };
  const service = new UsersService(prisma as never, posts as never, comments as never);
  return { service, prisma, posts, comments };
}

const existingUser = {
  id: 'u1', username: 'ali', createdAt: new Date(), _count: { posts: 3, comments: 7 },
};

describe('UsersService.getProfile', () => {
  it('throws 404 for an unknown user', async () => {
    const { service } = setup(null);
    await expect(service.getProfile('u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns stats and limits each source query to 5 rows', async () => {
    const { service, prisma } = setup(existingUser);
    const profile = await service.getProfile('u1');

    expect(profile.stats).toEqual({ totalPosts: 3, totalComments: 7 });
    expect(prisma.post.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    expect(prisma.comment.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });
});

describe('UsersService full history', () => {
  it('delegates paginated posts to PostsService for an existing user', async () => {
    const { service, posts } = setup({ id: 'u1' });
    await service.getPosts('u1', QUERY as never);
    expect(posts.findByAuthor).toHaveBeenCalledWith('u1', QUERY);
  });

  it('delegates paginated comments to CommentsService for an existing user', async () => {
    const { service, comments } = setup({ id: 'u1' });
    await service.getComments('u1', QUERY as never);
    expect(comments.findByAuthor).toHaveBeenCalledWith('u1', QUERY);
  });

  it('returns 404 and skips the query for an unknown user', async () => {
    const { service, posts, comments } = setup(null);
    await expect(service.getPosts('u1', QUERY as never)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getComments('u1', QUERY as never)).rejects.toBeInstanceOf(NotFoundException);
    expect(posts.findByAuthor).not.toHaveBeenCalled();
    expect(comments.findByAuthor).not.toHaveBeenCalled();
  });
});