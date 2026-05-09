import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { ClockInDto } from './dto/clock-in.dto';
import { ApproveAttendanceDto } from './dto/approve-attendance.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/user.entity';
import { ApprovalStatus } from './attendance.entity';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Post('clock-in')
  @Roles(Role.STAFF, Role.HRD)
  clockIn(@Request() req, @Body() dto: ClockInDto) {
    return this.attendanceService.clockIn(req.user.id, dto);
  }

  @Patch('clock-out')
  @Roles(Role.STAFF, Role.HRD)
  clockOut(@Request() req) {
    return this.attendanceService.clockOut(req.user.id);
  }

  @Patch('start-break')
  @Roles(Role.STAFF, Role.HRD)
  startBreak(@Request() req) {
    return this.attendanceService.startBreak(req.user.id);
  }

  @Patch('end-break')
  @Roles(Role.STAFF, Role.HRD)
  endBreak(@Request() req) {
    return this.attendanceService.endBreak(req.user.id);
  }

  @Get('today/me')
  @Roles(Role.STAFF, Role.HRD)
  getTodayAttendance(@Request() req) {
    return this.attendanceService.getTodayAttendance(req.user.id);
  }

  @Get('today')
  getToday(@Request() req) {
    return this.attendanceService.getToday(req.user.role);
  }

  @Patch(':id/approve')
  @Roles(Role.HRD)
  approve(@Param('id') id: string, @Request() req) {
    return this.attendanceService.approveOrDeny(
      id,
      req.user.id,
      ApprovalStatus.APPROVED,
    );
  }

  @Patch(':id/deny')
  @Roles(Role.HRD)
  deny(@Param('id') id: string, @Request() req) {
    return this.attendanceService.approveOrDeny(
      id,
      req.user.id,
      ApprovalStatus.DENIED,
    );
  }

  @Get('my-history')
  @Roles(Role.STAFF, Role.HRD)
  getMyHistory(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.attendanceService.getMyHistory(req.user.id, +page, +limit);
  }

  @Get('my-stats')
  @Roles(Role.STAFF, Role.HRD)
  getMyStats(@Request() req) {
    return this.attendanceService.getMyStats(req.user.id);
  }

  @Get('pending')
  @Roles(Role.HRD, Role.ADMIN)
  getPendingApprovals() {
    return this.attendanceService.getPendingApprovals();
  }

  @Get('approval-history')
  @Roles(Role.HRD, Role.ADMIN)
  getApprovalHistory(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.attendanceService.getApprovalHistory(+page, +limit);
  }

  @Get('team')
  getTeamStatus() {
    return this.attendanceService.getTeamStatus();
  }

  @Get('history')
  @Roles(Role.STAFF, Role.HRD, Role.ADMIN)
  getFullHistory(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.attendanceService.getFullHistory(
      req.user.id,
      req.user.role,
      +page,
      +limit,
    );
  }
}
