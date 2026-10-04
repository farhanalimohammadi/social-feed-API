import type { Prisma } from '../../generated/prisma/client.js';

export const profileUserSelect = {
  id: true,
  username: true,
  createdAt: true,
  _count: { select: { posts: true, comments: true } },
} satisfies Prisma.UserSelect;

export const recentPostSelect = {
  id: true,
  content: true,
  caption: true,
  createdAt: true,
} satisfies Prisma.PostSelect;

export const recentCommentSelect = {
  id: true,
  postId: true,
  text: true,
  createdAt: true,
} satisfies Prisma.CommentSelect;