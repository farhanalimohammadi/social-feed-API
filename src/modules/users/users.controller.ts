import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':userId/profile')
  getProfile(@Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string) {
    return this.users.getProfile(userId);
  }

  @Get(':userId/posts')
  getPosts(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.users.getPosts(userId, query);
  }

  @Get(':userId/comments')
  getComments(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.users.getComments(userId, query);
  }
}