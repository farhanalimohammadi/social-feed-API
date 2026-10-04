import { Module } from '@nestjs/common';
import { CommentsModule } from '../comments/comments.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [PostsModule, CommentsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}