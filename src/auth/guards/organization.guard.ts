import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // If user has no organization, deny access
    if (!user.organizationId) {
      throw new ForbiddenException('User must belong to an organization');
    }

    // Attach organizationId to request for easy access in controllers/services
    request.organizationId = user.organizationId;

    return true;
  }
}
