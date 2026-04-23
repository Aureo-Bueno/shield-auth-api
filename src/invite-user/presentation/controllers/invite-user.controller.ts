import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InviteUserService } from '../../application/services/invite-user.service';
import { CreateInviteUserDto } from '../../dto/create-invite-user.dto';
import { CompleteInviteSignUpDto } from '../../dto/complete-invite-sign-up.dto';
import { ValidateInviteDto } from '../../dto/validate-invite.dto';
import { ResendInviteDto } from '../../dto/resend-invite.dto';
import { CancelInviteDto } from '../../dto/cancel-invite.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { AuthorizationGuard } from '../../../auth/authorization/authorization.guard';
import { Roles } from '../../../auth/authorization/roles.decorator';
import { UserRole } from '../../../users/entities/user-role.enum';
import { Permissions } from '../../../auth/authorization/permissions.decorator';

@ApiTags('invite-user')
@Controller('invite-user')
export class InviteUserController {
  constructor(private readonly inviteUserService: InviteUserService) {}

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Permissions('invites:manage')
  @Post('invite')
  @ApiOperation({ summary: 'Send user invite email' })
  @ApiBody({ type: CreateInviteUserDto })
  @ApiResponse({ status: 201, description: 'Invite sent' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  invite(@Body() body: CreateInviteUserDto) {
    return this.inviteUserService.invite(body.email);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Permissions('invites:manage')
  @Post('resend')
  @ApiOperation({ summary: 'Resend user invite email' })
  @ApiBody({ type: ResendInviteDto })
  @ApiResponse({ status: 201, description: 'Invite resent' })
  @ApiResponse({ status: 400, description: 'Invite not found for email' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  resend(@Body() body: ResendInviteDto) {
    return this.inviteUserService.resendInvite(body.email);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate invite token before sign-up flow' })
  @ApiBody({ type: ValidateInviteDto })
  @ApiResponse({ status: 201, description: 'Invite is valid' })
  @ApiResponse({
    status: 400,
    description: 'Invalid token, expired token, or inactive invite',
  })
  validate(@Body() body: ValidateInviteDto) {
    return this.inviteUserService.validateInvite(body.email, body.token);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Permissions('invites:manage')
  @Post('cancel')
  @ApiOperation({ summary: 'Cancel invite token' })
  @ApiBody({ type: CancelInviteDto })
  @ApiResponse({ status: 201, description: 'Invite canceled' })
  @ApiResponse({ status: 400, description: 'Invalid invite token' })
  cancel(@Body() body: CancelInviteDto) {
    return this.inviteUserService.cancelInvite(body.email, body.token);
  }

  @Post('complete-sign-up')
  @ApiOperation({ summary: 'Complete sign-up from invite token' })
  @ApiBody({ type: CompleteInviteSignUpDto })
  @ApiResponse({ status: 201, description: 'User registered from invite' })
  @ApiResponse({
    status: 400,
    description: 'Invalid token, expired token, or inactive invite',
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  completeSignUp(@Body() body: CompleteInviteSignUpDto) {
    return this.inviteUserService.completeSignUp(
      body.email,
      body.password,
      body.token,
    );
  }
}
