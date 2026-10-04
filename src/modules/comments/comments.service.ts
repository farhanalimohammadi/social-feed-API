import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import type { Paginated } from '../../common/interfaces/paginated-response.interface.js';
import { buildMeta, toSkipTake } from '../../common/utils/pagination.util.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { PostsService } from '../posts/posts.service.js';
import { toCommentResponse, type CommentResponse } from './comments.mapper.js';
import { commentReadSelect } from './comments.select.js';
import type { CreateCommentDto } from './dto/create-comment.dto.js';
import type { Prisma } from '../../generated/prisma/client.js';

const NEWEST_FIRST = [{ createdAt: 'desc' }, { id: 'desc' }] as const;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
  ) {}

  async create(postId: string, authorId: string, dto: CreateCommentDto): Promise<CommentResponse> {
    await this.ensurePostExists(postId);
    if (dto.parentCommentId) {
      await this.ensureParentBelongsToPost(dto.parentCommentId, postId);
    }

    const comment = await this.prisma.comment.create({
      data: { postId, authorId, parentCommentId: dto.parentCommentId ?? null, text: dto.text },
      select: commentReadSelect,
    });

    await this.posts.invalidateFeedCache();
    return toCommentResponse(comment);
  }

  findByAuthor(authorId: string, query: PaginationQueryDto): Promise<Paginated<CommentResponse>> {
  return this.paginate({ authorId }, query);
}

  async findTopLevel(postId: string, query: PaginationQueryDto): Promise<Paginated<CommentResponse>> {
    await this.ensurePostExists(postId);
    return this.paginate({ postId, parentCommentId: null }, query);
  }

  

  async findReplies(
    postId: string,
    commentId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<CommentResponse>> {
    const parent = await this.prisma.comment.findFirst({
      where: { id: commentId, postId },
      select: { id: true },
    });
    if (!parent) throw new NotFoundException('Comment not found');

    return this.paginate({ postId, parentCommentId: commentId }, query);
  }

  

private async paginate(
  where: Prisma.CommentWhereInput,
  { page, limit }: PaginationQueryDto,
): Promise<Paginated<CommentResponse>> {
    const [totalItems, rows] = await Promise.all([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        select: commentReadSelect,
        orderBy: [...NEWEST_FIRST],
        ...toSkipTake(page, limit),
      }),
    ]);
    return { data: rows.map(toCommentResponse), meta: buildMeta(page, limit, totalItems) };
  }

  private async ensurePostExists(postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) throw new NotFoundException('Post not found');
  }

  private async ensureParentBelongsToPost(parentId: string, postId: string): Promise<void> {
    const parent = await this.prisma.comment.findUnique({
      where: { id: parentId },
      select: { postId: true },
    });
    if (!parent) throw new NotFoundException('Parent comment not found');
    if (parent.postId !== postId) {
      throw new BadRequestException('Parent comment does not belong to this post');
    }
  }
}