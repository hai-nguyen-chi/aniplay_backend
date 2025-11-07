import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from './request.interface';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return {
      userId: request.user.sub,
      email: request.user.email,
      username: request.user.username,
      permissions: request.user.permissions,
    };
  },
);

