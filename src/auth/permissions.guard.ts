import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_ACTIONS_KEY, PERMISSIONS_RESOURCE_KEY } from '@/auth/permissions.decorator';
import { hasResourcePermissions, Action } from '@/auth/permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const resource = this.reflector.getAllAndOverride<string>(PERMISSIONS_RESOURCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const actions =
      this.reflector.getAllAndOverride<Action[]>(PERMISSIONS_ACTIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (!resource || actions.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { permissions?: Map<string, number> | Record<string, number> } | undefined;
    if (!user || user.permissions === undefined) return false;

    return hasResourcePermissions(user.permissions, resource, actions);
  }
}


