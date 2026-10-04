import { Injectable, NotFoundException } from '@nestjs/common';
import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import type { Paginated } from '../../common/interfaces/paginated-response.interface.js';
import { buildMeta, toSkipTake } from '../../common/utils/pagination.util.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { PostsFeedCache } from './cache/posts-feed.cache.js';
import type { CreatePostDto } from './dto/create-post.dto.js';
import { toPostResponse, type PostResponse } from './posts.mapper.js';
import { postReadSelect } from './posts.select.js';

@Injectable()
export class PostsService {
  constructor(
    //دوتا منبع 
    //پریسما برای ارتباز با دیتا بیس اصلی و ردیس برای ارتباط با حافظه موقت و پر سرعت 
    private readonly prisma: PrismaService,
    private readonly feedCache: PostsFeedCache,
  ) {}

  //ساخت پست ها بر اساس تمام چیزهایی مه تعریف کردیم بررسی میشه که باید در همون ساختار اصولی و چارچوبی که تعیین کدریم باشه 
  async create(authorId: string, dto: CreatePostDto): Promise<PostResponse> {
    const post = await this.prisma.post.create({
      data: {
        authorId,
        contentType: dto.contentType,
        content: dto.content,
        caption: dto.caption,
      },
      select: postReadSelect,
    });
    await this.feedCache.invalidate();
    return toPostResponse(post);
  }

  async findFeed({ page, limit }: PaginationQueryDto): Promise<Paginated<PostResponse>> {
    const { generation, payload } = await this.feedCache.get(page, limit);
    if (payload) return payload;

    const [totalItems, rows] = await Promise.all([
      this.prisma.post.count(),
      this.prisma.post.findMany({
        select: postReadSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(page, limit),
      }),
    ]);

    const result = { data: rows.map(toPostResponse), meta: buildMeta(page, limit, totalItems) };
    await this.feedCache.set(generation, page, limit, result);
    return result;
  }

  async findByAuthor(
  authorId: string,
  { page, limit }: PaginationQueryDto,
): Promise<Paginated<PostResponse>> {
  const where = { authorId };
  const [totalItems, rows] = await Promise.all([
    this.prisma.post.count({ where }),
    this.prisma.post.findMany({
      where,
      select: postReadSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...toSkipTake(page, limit),
    }),
  ]);
  return { data: rows.map(toPostResponse), meta: buildMeta(page, limit, totalItems) };
}

  async findById(id: string): Promise<PostResponse> {
    const post = await this.prisma.post.findUnique({ where: { id }, select: postReadSelect });
    if (!post) throw new NotFoundException('Post not found');
    return toPostResponse(post);
  }

  invalidateFeedCache(): Promise<void> {
    return this.feedCache.invalidate();
  }
}