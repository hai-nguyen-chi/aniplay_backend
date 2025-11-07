import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from '@/comments/dto/create-comment.dto';
import { QueryCommentDto } from '@/comments/dto/query-comment.dto';
import { JwtAuthGuard } from '@/auth/jwt.guard';
import { PermissionsGuard } from '@/auth/permissions.guard';
import { RequirePermissions } from '@/auth/permissions.decorator';
import { Action, Resource } from '@/auth/permissions';
import { CurrentUser } from '@/auth/types/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('anime/:id/comments')
  @RequirePermissions(Resource.Comment, Action.View)
  getAnimeComments(@Param('id') animeId: string, @Query() query: QueryCommentDto) {
    return this.commentsService.getAnimeComments(animeId, query);
  }

  @Post('anime/:id/comments')
  @RequirePermissions(Resource.Comment, Action.Create)
  createAnimeComment(
    @CurrentUser() user: { userId: string },
    @Param('id') animeId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createAnimeComment(user.userId, animeId, dto);
  }

  @Get('episodes/:id/comments')
  @RequirePermissions(Resource.Comment, Action.View)
  getEpisodeComments(@Param('id') episodeId: string, @Query() query: QueryCommentDto) {
    return this.commentsService.getEpisodeComments(episodeId, query);
  }

  @Post('episodes/:id/comments')
  @RequirePermissions(Resource.Comment, Action.Create)
  createEpisodeComment(
    @CurrentUser() user: { userId: string },
    @Param('id') episodeId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createEpisodeComment(user.userId, episodeId, dto);
  }

  @Post('comments/:id/like')
  @RequirePermissions(Resource.Comment, Action.Update)
  likeComment(@Param('id') commentId: string) {
    return this.commentsService.likeComment(commentId);
  }
}

