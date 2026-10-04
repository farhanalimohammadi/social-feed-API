import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CreateCommentDto } from './create-comment.dto.js';

const PARENT_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_ID = '44444444-4444-4444-8444-444444444444';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const validate = (body: Record<string, unknown>): Promise<CreateCommentDto> =>
  pipe.transform(body, { type: 'body', metatype: CreateCommentDto });

describe('CreateCommentDto', () => {
  it('accepts parentCommentId', async () => {
    const dto = await validate({ text: 'hi', parentCommentId: PARENT_ID });
    expect(dto.parentCommentId).toBe(PARENT_ID);
  });

  it('accepts parent_comment_id and exposes it as parentCommentId', async () => {
    const dto = await validate({ text: 'hi', parent_comment_id: PARENT_ID });
    expect(dto.parentCommentId).toBe(PARENT_ID);
  });

  it('leaves parentCommentId undefined for a top-level comment', async () => {
    const dto = await validate({ text: 'hi' });
    expect(dto.parentCommentId).toBeUndefined();
  });

  it('accepts both fields when they are equal', async () => {
    const dto = await validate({
      text: 'hi',
      parentCommentId: PARENT_ID,
      parent_comment_id: PARENT_ID,
    });
    expect(dto.parentCommentId).toBe(PARENT_ID);
  });

  it.each([
    { text: 'hi', parentCommentId: PARENT_ID, parent_comment_id: OTHER_ID },
    { text: 'hi', parent_comment_id: 'not-a-uuid' },
  ])('rejects %j', async (body) => {
    await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
  });
});
