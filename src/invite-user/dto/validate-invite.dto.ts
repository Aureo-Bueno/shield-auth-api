import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ValidateInviteDto {
  @ApiProperty({ example: 'new-user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '11e8f0f829b9dc8168f30fbc9817ae09d307...' })
  @IsNotEmpty()
  token!: string;
}
