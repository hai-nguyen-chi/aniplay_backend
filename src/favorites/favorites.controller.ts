import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { CreateFavoriteDto } from '@/favorites/dto/create-favorite.dto';
import { JwtAuthGuard } from '@/auth/jwt.guard';
import { PermissionsGuard } from '@/auth/permissions.guard';
import { RequirePermissions } from '@/auth/permissions.decorator';
import { Action, Resource } from '@/auth/permissions';
import { CurrentUser } from '@/auth/types/current-user.decorator';

@Controller('favorites')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post(':animeId')
  @RequirePermissions(Resource.Favorite, Action.Create)
  create(
    @CurrentUser() user: { userId: string },
    @Param('animeId') animeId: string,
    @Body() dto: CreateFavoriteDto,
  ) {
    return this.favoritesService.create(user.userId, animeId, dto);
  }

  @Delete(':animeId')
  @RequirePermissions(Resource.Favorite, Action.Delete)
  remove(@CurrentUser() user: { userId: string }, @Param('animeId') animeId: string) {
    return this.favoritesService.remove(user.userId, animeId);
  }

  @Get()
  @RequirePermissions(Resource.Favorite, Action.View)
  findAll(@CurrentUser() user: { userId: string }) {
    return this.favoritesService.findAll(user.userId);
  }
}

