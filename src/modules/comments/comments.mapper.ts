import type { Prisma } from '../../generated/prisma/client.js';
import type { commentReadSelect } from './comments.select.js';

type CommentRow = Prisma.CommentGetPayload<{ select: typeof commentReadSelect }>;

export interface CommentResponse {
  id: string;
  postId: string;
  parentCommentId: string | null;
  text: string;
  createdAt: Date;
  author: { id: string; username: string };
  totalReplies: number;
}

export function toCommentResponse(row: CommentRow): CommentResponse {
  return {
    id: row.id,
    postId: row.postId,
    parentCommentId: row.parentCommentId,
    text: row.text,
    createdAt: row.createdAt,
    author: { id: row.author.id, username: row.author.username },
    totalReplies: row._count.replies,
  };
}