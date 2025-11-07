import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ProgressService } from '@/progress/progress.service';
import { JwtAuthGuard } from '@/auth/jwt.guard';
import { PermissionsGuard } from '@/auth/permissions.guard';
import { RequirePermissions } from '@/auth/permissions.decorator';
import { Action, Resource } from '@/auth/permissions';
import { CurrentUser } from '@/auth/types/current-user.decorator';

@Controller('user')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('continue-watching')
  @RequirePermissions(Resource.Progress, Action.View)
  getContinueWatching(@CurrentUser() user: { userId: string }, @Query('limit') limit?: number) {
    return this.progressService.getContinueWatching(user.userId, limit ? parseInt(limit.toString(), 10) : 10);
  }
}

