import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { CreateProgressDto } from '@/progress/dto/create-progress.dto';
import { QueryProgressDto } from '@/progress/dto/query-progress.dto';
import { JwtAuthGuard } from '@/auth/jwt.guard';
import { PermissionsGuard } from '@/auth/permissions.guard';
import { RequirePermissions } from '@/auth/permissions.decorator';
import { Action, Resource } from '@/auth/permissions';
import { CurrentUser } from '@/auth/types/current-user.decorator';

@Controller('progress')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post()
  @RequirePermissions(Resource.Progress, Action.Create)
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateProgressDto) {
    return this.progressService.create(user.userId, dto);
  }

  @Get()
  @RequirePermissions(Resource.Progress, Action.View)
  findAll(@CurrentUser() user: { userId: string }, @Query() query: QueryProgressDto) {
    return this.progressService.findAll(user.userId, query);
  }
}

