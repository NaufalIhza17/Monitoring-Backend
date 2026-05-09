import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { Role, EmploymentStatus, WorkStatus } from './user.entity';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsEnum(Role)
  role!: Role;

  @IsEnum(EmploymentStatus)
  employmentStatus!: EmploymentStatus;

  @IsEnum(WorkStatus)
  workStatus!: WorkStatus;
}
