import type { Prisma } from '../../generated/prisma/client.js';
import type { postReadSelect } from './posts.select.js';
//داده های خام دیتا بیس رو دریافت میکنه اونارو دسته بندی میکنه و به شکل استادارد به کلاینت تحویل میده میگه بیا 

type PostRow = Prisma.PostGetPayload<{ select: typeof postReadSelect }>;

export interface AuthorSummary {
  id: string;
  username: string;
}

export interface LatestComment {
  id: string;
  text: string;
  createdAt: Date;
  author: AuthorSummary;
}

export interface PostResponse {
  id: string;
  contentType: string;
  content: string;
  caption: string | null;
  createdAt: Date;
  author: AuthorSummary;
  totalComments: number;
  latestComment: LatestComment | null;
}

export function toPostResponse(row: PostRow): PostResponse {
  const latest = row.comments[0];
  return {
    id: row.id,
    contentType: row.contentType,
    content: row.content,
    caption: row.caption,
    createdAt: row.createdAt,
    author: { id: row.author.id, username: row.author.username },
    totalComments: row._count.comments,
    latestComment: latest
      ? {
          id: latest.id,
          text: latest.text,
          createdAt: latest.createdAt,
          author: { id: latest.author.id, username: latest.author.username },
        }
      : null,
  };
}