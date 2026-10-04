import type { Prisma } from '../../generated/prisma/client.js';

export const commentReadSelect = {
  id: true,
  postId: true,
  parentCommentId: true,
  text: true,
  createdAt: true,
  author: { select: { id: true, username: true } },
  _count: { select: { replies: true } },
} satisfies Prisma.CommentSelect;