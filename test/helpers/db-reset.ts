import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service.js';

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "comments", "posts", "users" CASCADE');
}