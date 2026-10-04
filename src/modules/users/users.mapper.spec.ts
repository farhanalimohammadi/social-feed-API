import { describe, expect, it } from 'vitest';
import { mergeRecentActivity } from './users.mapper.js';

const at = (iso: string) => new Date(iso);

describe('mergeRecentActivity', () => {
  it('merges posts and comments newest first and keeps only the limit', () => {
    const posts = [
      { id: 'p1', content: 'a', caption: null, createdAt: at('2026-01-01T10:00:00Z') },
      { id: 'p2', content: 'b', caption: 'c', createdAt: at('2026-01-03T10:00:00Z') },
    ];
    const comments = [
      { id: 'c1', postId: 'p1', text: 'x', createdAt: at('2026-01-02T10:00:00Z') },
      { id: 'c2', postId: 'p1', text: 'y', createdAt: at('2026-01-04T10:00:00Z') },
    ];

    const result = mergeRecentActivity(posts, comments, 3);
    expect(result.map((i) => i.id)).toEqual(['c2', 'p2', 'c1']);
  });

  it('breaks createdAt ties by id descending', () => {
    const same = at('2026-01-01T10:00:00Z');
    const result = mergeRecentActivity(
      [{ id: 'a', content: 'x', caption: null, createdAt: same }],
      [{ id: 'b', postId: 'a', text: 'y', createdAt: same }],
    );
    expect(result.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('truncates long text to an excerpt', () => {
    const [item] = mergeRecentActivity(
      [{ id: 'p', content: 'z'.repeat(1000), caption: null, createdAt: at('2026-01-01T00:00:00Z') }],
      [],
    );
    expect(item?.excerpt.length).toBeLessThanOrEqual(281);
  });
});