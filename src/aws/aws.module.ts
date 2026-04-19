import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AwsSesService } from './services/aws-ses.service';

@Module({
  imports: [ConfigModule],
  providers: [AwsSesService],
  exports: [AwsSesService],
})
export class AwsModule {}
