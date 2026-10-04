import { Module } from '@nestjs/common';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { PostsFeedCache } from './cache/posts-feed.cache.js';
import { PostCreateRateLimitGuard } from './guards/post-create-rate-limit.guard.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';

@Module({
  imports: [RateLimitModule],
  controllers: [PostsController],
  providers: [PostsService, PostsFeedCache, PostCreateRateLimitGuard],
  exports: [PostsService],
})
export class PostsModule {}