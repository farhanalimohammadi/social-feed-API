import { describe, expect, it } from 'vitest';
import { EXCERPT_LENGTH, excerpt } from './text.util.js';

describe('excerpt', () => {
  it('returns short text unchanged', () => {
    expect(excerpt('hello')).toBe('hello');
    expect(excerpt('z'.repeat(EXCERPT_LENGTH))).toBe('z'.repeat(EXCERPT_LENGTH));
  });

  it('cuts long text at the limit and appends an ellipsis', () => {
    expect(excerpt('z'.repeat(EXCERPT_LENGTH + 1))).toBe(`${'z'.repeat(EXCERPT_LENGTH)}…`);
  });

  it('never splits a surrogate pair at the cut boundary', () => {
    expect(excerpt('ab😀cd', 3)).toBe('ab…');
    expect(excerpt('ab😀cd', 4)).toBe('ab😀…');
  });
});
