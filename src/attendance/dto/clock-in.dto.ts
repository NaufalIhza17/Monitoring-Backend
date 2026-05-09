import { IsString } from 'class-validator';

export class ClockInDto {
  @IsString()
  photoUrl!: string;
}
