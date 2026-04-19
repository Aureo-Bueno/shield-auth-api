import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '11e8f0f829b9dc8168f30fbc9817ae09d307...' })
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'newS3cr3t123' })
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
