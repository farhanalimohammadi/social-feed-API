import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { PostCreateRateLimitGuard } from './guards/post-create-rate-limit.guard.js';
import { PostsService } from './posts.service.js';

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post()
  //قرار گیری اینا رندوم نیست بلکه اول باید توکن کاربر بررسی شود ایا اصلا وجود دارد  سپس بیایم بررسی کنیم که کاربر مجاز به پست گذشاتن است یا نه 
  @UseGuards(JwtAuthGuard, PostCreateRateLimitGuard)
  //به جای اینکه برنامه‌نویس بنویسه request.user.id و کنترلر را به شیءِ سنگینِ Request وابسته کند، از دکوریتورِ سفارشیِ @CurrentUser استفاده کرده .
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePostDto) {
    return this.posts.create(user.id, dto);
  }

  @Get()
  feed(@Query() query: PaginationQueryDto) {
    return this.posts.findFeed(query);
  }

  ///اگر هکری یا حتی یک باگ در فرانت‌اند، درخواستی به آدرس /posts/xx بفرستد، ParseUUIDPipe قبل از اینکه درخواست اصلاً به لایه Service یا دیتابیس برسد، آن را مسدود می‌کند ارور ۴۰۰ می‌ده
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.posts.findById(id);
  }
}