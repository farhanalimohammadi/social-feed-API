import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PostsService } from './posts.service.js';

const row = {
  id: 'p1', contentType: 'text', content: 'hi', caption: null,
  createdAt: new Date(), author: { id: 'u1', username: 'ali' },
  comments: [], _count: { comments: 0 },
};

function setup() {
  const prisma = {
    post: {
      create: vi.fn().mockResolvedValue(row),
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([row]),
      findUnique: vi.fn().mockResolvedValue(row),
    },
    comment: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const cache = {
    get: vi.fn().mockResolvedValue({ generation: '3', payload: null }),
    set: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
  };
  return { service: new PostsService(prisma as never, cache as never), prisma, cache };
}

describe('PostsService', () => {
  it('returns the cached page without touching the database', async () => {
    const { service, prisma, cache } = setup();
    const cached = { data: [], meta: { currentPage: 1, itemsPerPage: 20, totalItems: 0, totalPages: 0 } };
    cache.get.mockResolvedValue({ generation: '3', payload: cached });

    expect(await service.findFeed({ page: 1, limit: 20 })).toBe(cached);
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });

  it('loads from the database on a miss and stores under the same generation', async () => {
    const { service, cache } = setup();
    const result = await service.findFeed({ page: 2, limit: 10 });

    expect(result.meta).toEqual({ currentPage: 2, itemsPerPage: 10, totalItems: 1, totalPages: 1 });
    expect(cache.set).toHaveBeenCalledWith('3', 2, 10, result);
  });

  it('invalidates the feed cache after creating a post', async () => {
    const { service, cache } = setup();
    await service.create('u1', { contentType: 'text', content: 'hi' } as never);
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
  });

  it('filters posts by author and paginates', async () => {
    const { service, prisma } = setup();
    const result = await service.findByAuthor('u1', { page: 3, limit: 5 });

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { authorId: 'u1' }, skip: 10, take: 5 }),
    );
    expect(result.meta.currentPage).toBe(3);
  });

  it('throws 404 for a missing post', async () => {
    const { service, prisma } = setup();
    prisma.post.findUnique.mockResolvedValue(null);
    await expect(service.findById('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a post thread with a paginated page of top-level comments only', async () => {
    const { service, prisma } = setup();
    prisma.comment.count.mockResolvedValue(7);
    const result = await service.findThread('p1', { page: 2, limit: 5 });

    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { postId: 'p1', parentCommentId: null }, skip: 5, take: 5 }),
    );
    expect(result.id).toBe('p1');
    expect(result.comments.meta).toEqual({
      currentPage: 2,
      itemsPerPage: 5,
      totalItems: 7,
      totalPages: 2,
    });
  });

  it('throws 404 for the thread of a missing post', async () => {
    const { service, prisma } = setup();
    prisma.post.findUnique.mockResolvedValue(null);
    await expect(service.findThread('x', { page: 1, limit: 20 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('truncates the latest comment to a snippet', async () => {
    const { service, prisma } = setup();
    const latest = {
      id: 'c1',
      text: 'z'.repeat(1000),
      createdAt: new Date(),
      author: { id: 'u2', username: 'sara' },
    };
    prisma.post.findUnique.mockResolvedValue({
      ...row,
      comments: [latest],
      _count: { comments: 1 },
    });

    const post = await service.findById('p1');
    expect(post.latestComment?.text).toBe(`${'z'.repeat(280)}…`);
  });
});