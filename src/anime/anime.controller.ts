import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AnimeService } from './anime.service';
import { CreateAnimeDto } from '@/anime/dto/create-anime.dto';
import { UpdateAnimeDto } from '@/anime/dto/update-anime.dto';
import { QueryAnimeDto } from '@/anime/dto/query-anime.dto';
import { JwtAuthGuard } from '@/auth/jwt.guard';
import { PermissionsGuard } from '@/auth/permissions.guard';
import { RequirePermissions } from '@/auth/permissions.decorator';
import { Action, Resource } from '@/auth/permissions';

@Controller('anime')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AnimeController {
  constructor(private readonly anime: AnimeService) {}

  @Get()
  @RequirePermissions(Resource.Anime, Action.View)
  findAll(@Query() query: QueryAnimeDto) {
    return this.anime.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(Resource.Anime, Action.View)
  findOne(@Param('id') id: string) {
    return this.anime.findOne(id);
  }

  @Post()
  @RequirePermissions(Resource.Anime, Action.Create)
  create(@Body() dto: CreateAnimeDto) {
    return this.anime.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Resource.Anime, Action.Update)
  update(@Param('id') id: string, @Body() dto: UpdateAnimeDto) {
    return this.anime.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Resource.Anime, Action.Delete)
  remove(@Param('id') id: string) {
    return this.anime.remove(id);
  }
}


