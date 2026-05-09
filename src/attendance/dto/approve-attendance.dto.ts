import { IsEnum } from 'class-validator';
import { ApprovalStatus } from '../attendance.entity';

export class ApproveAttendanceDto {
  @IsEnum(ApprovalStatus)
  status!: ApprovalStatus;
}
