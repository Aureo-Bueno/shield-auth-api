import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { IntegrationsController } from './presentation/controllers/integrations.controller';

@Module({
  imports: [SecurityModule],
  controllers: [IntegrationsController],
})
export class IntegrationsModule {}
