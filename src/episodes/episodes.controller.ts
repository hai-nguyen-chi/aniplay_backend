import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { EpisodesService } from './episodes.service';
import { CreateEpisodeDto } from '@/episodes/dto/create-episode.dto';
import { UpdateEpisodeDto } from '@/episodes/dto/update-episode.dto';
import { QueryEpisodeDto } from '@/episodes/dto/query-episode.dto';
import { JwtAuthGuard } from '@/auth/jwt.guard';
import { PermissionsGuard } from '@/auth/permissions.guard';
import { RequirePermissions } from '@/auth/permissions.decorator';
import { Action, Resource } from '@/auth/permissions';

@Controller('episodes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EpisodesController {
  constructor(private readonly episodes: EpisodesService) {}

  @Get()
  @RequirePermissions(Resource.Episode, Action.View)
  findAll(@Query() query: QueryEpisodeDto) {
    return this.episodes.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(Resource.Episode, Action.View)
  findOne(@Param('id') id: string) {
    return this.episodes.findOne(id);
  }

  @Post()
  @RequirePermissions(Resource.Episode, Action.Create)
  create(@Body() dto: CreateEpisodeDto) {
    return this.episodes.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Resource.Episode, Action.Update)
  update(@Param('id') id: string, @Body() dto: UpdateEpisodeDto) {
    return this.episodes.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Resource.Episode, Action.Delete)
  remove(@Param('id') id: string) {
    return this.episodes.remove(id);
  }
}


