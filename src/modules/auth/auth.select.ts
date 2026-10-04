import type { Prisma } from '../../generated/prisma/client.js';
//اطلاعت حساس کاربران عمدا اینجا قرار نگرفتن تا لو نرن 
//یعنی اینجا یه لیست مجاز از اطلاعات قابل نمایش کاربر داریم 
export const publicUserSelect = {
  id: true,
  username: true,
  email: true,
  createdAt: true,
} satisfies Prisma.UserSelect;