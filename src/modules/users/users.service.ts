import { Injectable, NotFoundException } from '@nestjs/common';
import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { CommentsService } from '../comments/comments.service.js';
import { PostsService } from '../posts/posts.service.js';
import {
  mergeRecentActivity,
  RECENT_ACTIVITY_LIMIT,
  toUserProfile,
  type UserProfileResponse,
} from './users.mapper.js';
import { profileUserSelect, recentCommentSelect, recentPostSelect } from './users.select.js';

const NEWEST_FIRST = [{ createdAt: 'desc' }, { id: 'desc' }] as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly comments: CommentsService,
  ) {}

  async getProfile(userId: string): Promise<UserProfileResponse> {
    const [user, posts, comments] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: profileUserSelect }),
      this.prisma.post.findMany({
        where: { authorId: userId },
        select: recentPostSelect,
        orderBy: [...NEWEST_FIRST],
        take: RECENT_ACTIVITY_LIMIT,
      }),
      this.prisma.comment.findMany({
        where: { authorId: userId },
        select: recentCommentSelect,
        orderBy: [...NEWEST_FIRST],
        take: RECENT_ACTIVITY_LIMIT,
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    return toUserProfile(user, mergeRecentActivity(posts, comments));
  }

  async getPosts(userId: string, query: PaginationQueryDto) {
    await this.ensureUserExists(userId);
    return this.posts.findByAuthor(userId, query);
  }

  async getComments(userId: string, query: PaginationQueryDto) {
    await this.ensureUserExists(userId);
    return this.comments.findByAuthor(userId, query);
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
  }
}