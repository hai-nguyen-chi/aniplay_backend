import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from '@/ratings/dto/create-rating.dto';
import { JwtAuthGuard } from '@/auth/jwt.guard';
import { PermissionsGuard } from '@/auth/permissions.guard';
import { RequirePermissions } from '@/auth/permissions.decorator';
import { Action, Resource } from '@/auth/permissions';
import { CurrentUser } from '@/auth/types/current-user.decorator';

@Controller('anime/:id/rating')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  @RequirePermissions(Resource.Rating, Action.Create)
  create(
    @CurrentUser() user: { userId: string },
    @Param('id') animeId: string,
    @Body() dto: CreateRatingDto,
  ) {
    return this.ratingsService.create(user.userId, animeId, dto);
  }

  @Get()
  @RequirePermissions(Resource.Rating, Action.View)
  getRating(
    @CurrentUser() user: { userId: string } | undefined,
    @Param('id') animeId: string,
  ) {
    const userId = user ? user.userId : undefined;
    return this.ratingsService.getRating(animeId, userId);
  }
}

