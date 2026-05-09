import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Role, EmploymentStatus, WorkStatus } from './user.entity';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @IsOptional()
  @IsEnum(WorkStatus)
  workStatus?: WorkStatus;
}
