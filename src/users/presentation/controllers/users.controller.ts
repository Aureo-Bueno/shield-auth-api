import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { UsersService } from '../../application/services/users.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../../auth/types/authenticated-user';
import { AuthorizationGuard } from '../../../auth/authorization/authorization.guard';
import { Permissions } from '../../../auth/authorization/permissions.decorator';
import { CheckPolicies } from '../../../auth/authorization/policies.decorator';
import { UserRole } from '../../entities/user-role.enum';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @Get('/me')
  @Permissions('users:read:self')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  me(@Req() request: AuthenticatedRequest) {
    const userId = request.user.userId;
    return this.usersService.findOne(userId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get user by ID (ABAC: users can read themselves, admins can read any)',
  })
  @ApiParam({ name: 'id', type: Number, required: true })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @CheckPolicies(
    (user, request) =>
      user.role === UserRole.ADMIN ||
      user.userId === Number(request.params.id ?? -1),
  )
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }
}
