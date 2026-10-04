import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CommentsService } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';

@Controller('posts/:postId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Param('postId', new ParseUUIDPipe({ version: '4' })) postId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(postId, user.id, dto);
  }

  @Get()
  findTopLevel(
    @Param('postId', new ParseUUIDPipe({ version: '4' })) postId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.comments.findTopLevel(postId, query);
  }

  @Get(':commentId/replies')
  findReplies(
    @Param('postId', new ParseUUIDPipe({ version: '4' })) postId: string,
    @Param('commentId', new ParseUUIDPipe({ version: '4' })) commentId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.comments.findReplies(postId, commentId, query);
  }
}