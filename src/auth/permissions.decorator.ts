import { SetMetadata } from '@nestjs/common';
import { Action } from '@/auth/permissions';

export const PERMISSIONS_RESOURCE_KEY = 'perm_resource';
export const PERMISSIONS_ACTIONS_KEY = 'perm_actions';

export const RequirePermissions = (resource: string, ...actions: Action[]) => {
  return (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    SetMetadata(PERMISSIONS_RESOURCE_KEY, resource)(target, key, descriptor);
    SetMetadata(PERMISSIONS_ACTIONS_KEY, actions)(target, key, descriptor);
  };
};


