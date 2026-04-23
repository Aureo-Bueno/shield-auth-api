import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../auth/authorization/authorization.module';
import { UsersController } from './presentation/controllers/users.controller';
import { UsersService } from './application/services/users.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
