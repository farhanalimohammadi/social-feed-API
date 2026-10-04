import { describe, expect, it } from 'vitest';
import { parseFeedPage } from './cache/posts-feed.codec.js';

const post = {
  id: 'p1', contentType: 'text', content: 'hi', caption: null,
  createdAt: '2026-10-03T10:00:00.000Z',
  author: { id: 'u1', username: 'ali' },
  totalComments: 1,
  latestComment: {
    id: 'c1', text: 'yo', createdAt: '2026-10-03T11:00:00.000Z',
    author: { id: 'u2', username: 'sara' },
  },
};
const meta = { currentPage: 1, itemsPerPage: 20, totalItems: 1, totalPages: 1 };

describe('parseFeedPage', () => {
  it('revives dates', () => {
    const page = parseFeedPage(JSON.stringify({ data: [post], meta }));
    expect(page?.data[0]?.createdAt).toBeInstanceOf(Date);
    expect(page?.data[0]?.latestComment?.createdAt).toBeInstanceOf(Date);
  });

  it('accepts a post without latest comment', () => {
    const page = parseFeedPage(JSON.stringify({ data: [{ ...post, latestComment: null }], meta }));
    expect(page?.data[0]?.latestComment).toBeNull();
  });

  it.each([
    ['invalid JSON', '{nope'],
    ['wrong shape', JSON.stringify({ foo: 1 })],
    ['bad date', JSON.stringify({ data: [{ ...post, createdAt: 'x' }], meta })],
    ['missing meta field', JSON.stringify({ data: [], meta: { currentPage: 1 } })],
  ])('rejects %s', (_name, raw) => {
    expect(parseFeedPage(raw)).toBeNull();
  });
});