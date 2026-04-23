import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthorizationGuard } from '../../../auth/authorization/authorization.guard';
import { Permissions } from '../../../auth/authorization/permissions.decorator';
import { Roles } from '../../../auth/authorization/roles.decorator';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { UserRole } from '../../../users/entities/user-role.enum';
import { AuditService } from '../../application/services/audit.service';

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('events')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Permissions('audit:read')
  @ApiOperation({ summary: 'List latest audit events (admin only)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max number of events returned (1-200)',
  })
  @ApiResponse({ status: 200, description: 'Audit events returned' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  listEvents(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.auditService.list(limit);
  }
}
