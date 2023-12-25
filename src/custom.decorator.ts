import { SetMetadata } from '@nestjs/common';

export const requireLogin = () => SetMetadata('require-login', true);

export const requirePermission = (...permissions: string[]) =>
  SetMetadata('require-permission', permissions);
