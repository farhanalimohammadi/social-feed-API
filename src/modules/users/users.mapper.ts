import { excerpt } from '../../common/utils/text.util.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { profileUserSelect, recentCommentSelect, recentPostSelect } from './users.select.js';

type ProfileUserRow = Prisma.UserGetPayload<{ select: typeof profileUserSelect }>;
type RecentPostRow = Prisma.PostGetPayload<{ select: typeof recentPostSelect }>;
type RecentCommentRow = Prisma.CommentGetPayload<{ select: typeof recentCommentSelect }>;

export type ActivityItem =
  | { type: 'post'; id: string; createdAt: Date; excerpt: string; caption: string | null }
  | { type: 'comment'; id: string; createdAt: Date; postId: string; excerpt: string };

export interface UserProfileResponse {
  id: string;
  username: string;
  createdAt: Date;
  stats: { totalPosts: number; totalComments: number };
  recentActivity: ActivityItem[];
}

export const RECENT_ACTIVITY_LIMIT = 5;

function compareNewestFirst(a: ActivityItem, b: ActivityItem): number {
  const diff = b.createdAt.getTime() - a.createdAt.getTime();
  if (diff !== 0) return diff;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

export function mergeRecentActivity(
  posts: RecentPostRow[],
  comments: RecentCommentRow[],
  limit: number = RECENT_ACTIVITY_LIMIT,
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...posts.map((p): ActivityItem => ({
      type: 'post', id: p.id, createdAt: p.createdAt, excerpt: excerpt(p.content), caption: p.caption,
    })),
    ...comments.map((c): ActivityItem => ({
      type: 'comment', id: c.id, createdAt: c.createdAt, postId: c.postId, excerpt: excerpt(c.text),
    })),
  ];
  return items.sort(compareNewestFirst).slice(0, limit);
}

export function toUserProfile(user: ProfileUserRow, recentActivity: ActivityItem[]): UserProfileResponse {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    stats: { totalPosts: user._count.posts, totalComments: user._count.comments },
    recentActivity,
  };
}