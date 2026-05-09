import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance, ApprovalStatus } from './attendance.entity';
import { User, WorkStatus, Role } from '../users/user.entity';
import { ClockInDto } from './dto/clock-in.dto';
import * as fs from 'fs';
import * as path from 'path';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  async clockIn(userId: string, dto: ClockInDto) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.workStatus !== WorkStatus.OFF_DUTY) {
      throw new BadRequestException('Already clocked in');
    }

    const today = new Date().toISOString().split('T')[0];
    const existing = await this.attendanceRepo.findOne({
      where: { userId, date: today },
    });
    if (existing)
      throw new BadRequestException('Already have attendance record for today');

    const isHrd = user.role === Role.HRD;
    const attendance = this.attendanceRepo.create({
      userId,
      date: today,
      clockInTime: new Date(),
      photoUrl: dto.photoUrl,
      approvalStatus: isHrd ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING,
    });

    await this.attendanceRepo.save(attendance);

    user.workStatus = isHrd ? WorkStatus.WORKING : WorkStatus.PENDING;
    await this.usersRepo.save(user);

    return attendance;
  }

  async clockOut(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (
      user.workStatus === WorkStatus.OFF_DUTY ||
      user.workStatus === WorkStatus.PENDING
    ) {
      throw new BadRequestException('Not clocked in');
    }

    const today = new Date().toISOString().split('T')[0];
    const attendance = await this.attendanceRepo.findOne({
      where: { userId, date: today },
    });
    if (!attendance) throw new NotFoundException('No attendance record found');

    const now = new Date();

    // end break if on break
    if (attendance.isOnBreak && attendance.breakStartTime) {
      const breakMins = Math.floor(
        (now.getTime() - new Date(attendance.breakStartTime).getTime()) / 60000,
      );
      attendance.totalBreakMinutes += breakMins;
      attendance.isOnBreak = false;
      attendance.breakStartTime = null;
    }

    attendance.clockOutTime = now;
    const totalMins = Math.floor(
      (now.getTime() - new Date(attendance.clockInTime).getTime()) / 60000,
    );
    attendance.totalWorkingMinutes = totalMins;

    await this.attendanceRepo.save(attendance);

    user.workStatus = WorkStatus.OFF_DUTY;
    await this.usersRepo.save(user);

    return attendance;
  }

  async startBreak(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.workStatus !== WorkStatus.WORKING) {
      throw new BadRequestException('Must be working to start a break');
    }

    const today = new Date().toISOString().split('T')[0];
    const attendance = await this.attendanceRepo.findOne({
      where: { userId, date: today },
    });
    if (!attendance) throw new NotFoundException('No attendance record found');

    if (attendance.isOnBreak) throw new BadRequestException('Already on break');
    if (attendance.totalBreakMinutes >= 60)
      throw new BadRequestException('Break limit reached (1 hour max)');

    attendance.isOnBreak = true;
    attendance.breakStartTime = new Date();
    await this.attendanceRepo.save(attendance);

    user.workStatus = WorkStatus.ON_BREAK;
    await this.usersRepo.save(user);

    return attendance;
  }

  async endBreak(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.workStatus !== WorkStatus.ON_BREAK) {
      throw new BadRequestException('Not on break');
    }

    const today = new Date().toISOString().split('T')[0];
    const attendance = await this.attendanceRepo.findOne({
      where: { userId, date: today },
    });
    if (!attendance) throw new NotFoundException('No attendance record found');

    const now = new Date();
    const breakMins = Math.floor(
      (now.getTime() - new Date(attendance.breakStartTime!).getTime()) / 60000,
    );
    attendance.totalBreakMinutes = Math.min(
      attendance.totalBreakMinutes + breakMins,
      60,
    );
    attendance.isOnBreak = false;
    attendance.breakStartTime = null;
    await this.attendanceRepo.save(attendance);

    user.workStatus = WorkStatus.WORKING;
    await this.usersRepo.save(user);

    return attendance;
  }

  async getTodayAttendance(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    return this.attendanceRepo.findOne({ where: { userId, date: today } });
  }

  async approveOrDeny(
    attendanceId: string,
    approverId: string,
    status: ApprovalStatus,
  ) {
    const attendance = await this.attendanceRepo.findOne({
      where: { id: attendanceId },
    });
    if (!attendance) throw new NotFoundException('Attendance not found');

    if (status === ApprovalStatus.APPROVED) {
      // move file from temp to approved
      const filename = path.basename(attendance.photoUrl);
      const oldPath = path.join('./uploads/temp', filename);
      const newPath = path.join('./uploads/approved', filename);

      if (fs.existsSync(oldPath)) {
        fs.mkdirSync('./uploads/approved', { recursive: true });
        fs.renameSync(oldPath, newPath);
      }

      attendance.photoUrl = `/uploads/approved/${filename}`;
      attendance.approvalStatus = ApprovalStatus.APPROVED;
      attendance.approvedBy = approverId;
      attendance.approvedAt = new Date();
      await this.attendanceRepo.save(attendance);

      await this.usersRepo.update(
        { id: attendance.userId },
        { workStatus: WorkStatus.WORKING },
      );
    } else if (status === ApprovalStatus.DENIED) {
      // delete file from temp
      const filename = path.basename(attendance.photoUrl);
      const tempPath = path.join('./uploads/temp', filename);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

      // delete attendance record so user can re-clock in today
      await this.attendanceRepo.remove(attendance);
      await this.usersRepo.update(
        { id: attendance.userId },
        { workStatus: WorkStatus.PHOTO_REVISION },
      );
    }

    return { message: `Attendance ${status}` };
  }

  async getMyHistory(userId: string, page = 1, limit = 10) {
    const [data, total] = await this.attendanceRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getToday(requestingRole: string) {
    const today = new Date().toISOString().split('T')[0];
    return this.attendanceRepo.find({
      where: { date: today },
      relations: ['user'],
    });
  }

  async getMyStats(userId: string) {
    const records = await this.attendanceRepo.find({
      where: { userId, approvalStatus: ApprovalStatus.APPROVED },
    });

    const totalWorkingDays = records.filter((r) => r.clockOutTime).length;
    const totalWorkingMinutes = records.reduce(
      (acc, r) => acc + (r.totalWorkingMinutes ?? 0),
      0,
    );
    const totalOvertimeMinutes = records.reduce((acc, r) => {
      const overtime = Math.max((r.totalWorkingMinutes ?? 0) - 480, 0); // 480 = 8hrs
      return acc + overtime;
    }, 0);

    return {
      totalWorkingDays,
      totalWorkingHours: Math.floor(totalWorkingMinutes / 60),
      totalWorkingMinutes: totalWorkingMinutes % 60,
      totalOvertimeHours: Math.floor(totalOvertimeMinutes / 60),
      totalOvertimeMinutes: totalOvertimeMinutes % 60,
    };
  }

  async getPendingApprovals() {
    return this.attendanceRepo.find({
      where: { approvalStatus: ApprovalStatus.PENDING },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredShifts() {
    const today = new Date().toISOString().split('T')[0];

    // find all pending or photo_revision attendance older than 8 hours
    const records = await this.attendanceRepo.find({
      where: [{ date: today, approvalStatus: ApprovalStatus.PENDING }],
    });

    for (const record of records) {
      const elapsed =
        (Date.now() - new Date(record.clockInTime).getTime()) / 1000 / 60 / 60;
      if (elapsed >= 8) {
        // mark as invalid
        const filename = path.basename(record.photoUrl);
        const tempPath = path.join('./uploads/temp', filename);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

        record.isInvalid = true;
        record.invalidReason = 'Shift expired without valid photo approval';
        record.clockOutTime = new Date();
        record.approvalStatus = ApprovalStatus.DENIED;
        await this.attendanceRepo.save(record);

        await this.usersRepo.update(
          { id: record.userId },
          { workStatus: WorkStatus.OFF_DUTY },
        );
      }
    }
  }

  async getApprovalHistory(page = 1, limit = 10) {
    const [data, total] = await this.attendanceRepo.findAndCount({
      where: [
        { approvalStatus: ApprovalStatus.APPROVED },
        { approvalStatus: ApprovalStatus.DENIED },
      ],
      relations: ['user'],
      order: { approvedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getTeamStatus() {
    const users = await this.usersRepo.find({
      where: [{ role: Role.STAFF }, { role: Role.HRD }],
      select: ['id', 'name', 'role', 'workStatus', 'employmentStatus'],
      order: { name: 'ASC' },
    });
    return users;
  }

  async getFullHistory(
    requestingUserId: string,
    requestingRole: Role,
    page = 1,
    limit = 10,
  ) {
    const query = this.attendanceRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.user', 'user')
      .where('a.approvalStatus = :status', { status: ApprovalStatus.APPROVED });

    if (requestingRole === Role.STAFF) {
      query.andWhere('a.user_id = :id', { id: requestingUserId });
    }

    const [data, total] = await query
      .orderBy('a.clockInTime', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const mapped = data.map((r) => {
      const overtimeMinutes = Math.max((r.totalWorkingMinutes ?? 0) - 480, 0);
      return {
        id: r.id,
        date: r.date,
        clockInTime: r.clockInTime,
        clockOutTime: r.clockOutTime,
        totalWorkingMinutes: r.totalWorkingMinutes,
        totalBreakMinutes: r.totalBreakMinutes,
        overtimeMinutes,
        approvalStatus: r.approvalStatus,
        isInvalid: r.isInvalid,
        user: {
          id: r.user.id,
          name: r.user.name,
          role: r.user.role,
        },
      };
    });

    return {
      data: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
