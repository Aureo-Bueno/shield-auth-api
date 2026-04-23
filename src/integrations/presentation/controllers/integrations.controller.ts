import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiOAuth2,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyOrOAuth2Guard } from '../../../security/presentation/guards/api-key-or-oauth2.guard';

type IntegrationStatusResponse = {
  status: 'ok';
  timestamp: string;
  authMode: 'api_key_or_oauth2';
};

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  @Get('status')
  @UseGuards(ApiKeyOrOAuth2Guard)
  @ApiSecurity('apiKey')
  @ApiOAuth2(['read:integrations'], 'oauth2')
  @ApiOperation({
    summary:
      'Integration status endpoint protected by API key or OAuth2 bearer token',
  })
  @ApiResponse({
    status: 200,
    description: 'Integration channel is authorized and reachable',
  })
  @ApiResponse({ status: 401, description: 'Invalid API key or OAuth2 token' })
  status(): IntegrationStatusResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      authMode: 'api_key_or_oauth2',
    };
  }
}
