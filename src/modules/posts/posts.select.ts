import type { Prisma } from '../../generated/prisma/client.js';
// پستی که میخواد خواندع بشه دقیقا باید چه فیلد هایی رو از دیتا بیس استخراج کنه؟
const authorSelect = { select: { id: true, username: true } } as const;

export const postReadSelect = {
  id: true,
  contentType: true,
  content: true,
  caption: true,
  createdAt: true,
  author: authorSelect,
  comments: {
    select: { id: true, text: true, createdAt: true, author: authorSelect },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
  },
  _count: { select: { comments: true } },
} satisfies Prisma.PostSelect;