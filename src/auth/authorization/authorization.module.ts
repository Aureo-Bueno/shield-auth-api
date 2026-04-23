import { Module } from '@nestjs/common';
import { AuthorizationGuard } from './authorization.guard';

@Module({
  providers: [AuthorizationGuard],
  exports: [AuthorizationGuard],
})
export class AuthorizationModule {}
