import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'currentS3cr3t123' })
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ example: 'newS3cr3t123' })
  @IsNotEmpty()
  @MinLength(8)
  newPassword!: string;
}
