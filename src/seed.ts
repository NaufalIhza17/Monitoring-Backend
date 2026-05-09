import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, Role, WorkStatus, EmploymentStatus } from './users/user.entity';
import { Attendance, ApprovalStatus } from './attendance/attendance.entity';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

// --- Helper ---
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function timeOnDate(dateStr: string, hour: number, minute = 0): Date {
  const d = new Date(dateStr);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersRepo = app.get<Repository<User>>(getRepositoryToken(User));
  const attendanceRepo = app.get<Repository<Attendance>>(
    getRepositoryToken(Attendance),
  );

  // -------------------------------------------------------
  // USERS
  // -------------------------------------------------------
  const staffNames = [
    'Budi Santoso',
    'Siti Rahayu',
    'Agus Prasetyo',
    'Dewi Lestari',
    'Eko Wahyudi',
    'Fitri Handayani',
    'Gunawan Saputra',
    'Hana Pertiwi',
    'Irwan Kusuma',
    'Joko Widodo',
    'Kartika Sari',
    'Lukman Hakim',
    'Maya Indah',
    'Nanang Fauzi',
    'Oky Pratama',
    'Putri Wulandari',
    'Rizky Maulana',
    'Sari Dewi',
    'Taufik Hidayat',
    'Ulfah Nuraini',
  ];

  const hrdNames = ['Diana Puspita', 'Herman Wijaya', 'Ratna Sari'];

  const usersData = [
    // Admin
    {
      name: 'Admin Master',
      email: 'admin@company.com',
      password: await bcrypt.hash('admin123', 10),
      role: Role.ADMIN,
      workStatus: WorkStatus.OFF_DUTY,
      employmentStatus: EmploymentStatus.EMPLOYED,
    },
    // HRD
    ...hrdNames.map((name, i) => ({
      name,
      email: `hrd${i + 1}@company.com`,
      password: bcrypt.hashSync('hrd123', 10),
      role: Role.HRD,
      workStatus: WorkStatus.OFF_DUTY,
      employmentStatus: EmploymentStatus.EMPLOYED,
    })),
    // Staff
    ...staffNames.map((name, i) => ({
      name,
      email: `staff${i + 1}@company.com`,
      password: bcrypt.hashSync('staff123', 10),
      role: Role.STAFF,
      workStatus: WorkStatus.OFF_DUTY,
      employmentStatus:
        i < 17
          ? EmploymentStatus.EMPLOYED
          : i === 17
            ? EmploymentStatus.ON_LEAVE
            : EmploymentStatus.RESIGNED,
    })),
  ];

  const savedUsers: User[] = [];

  for (const userData of usersData) {
    const existing = await usersRepo.findOne({
      where: { email: userData.email },
    });
    if (existing) {
      // UPSERT — update existing with new seed data
      await usersRepo.update(
        { email: userData.email },
        {
          name: userData.name,
          role: userData.role,
          workStatus: WorkStatus.OFF_DUTY,
          employmentStatus: userData.employmentStatus,
        },
      );
      const updated = await usersRepo.findOne({
        where: { email: userData.email },
      });
      savedUsers.push(updated!);
      console.log(`🔄 Updated: ${userData.email}`);
    } else {
      const created = await usersRepo.save(usersRepo.create(userData));
      savedUsers.push(created);
      console.log(`✅ Created: ${userData.email}`);
    }
  }

  // -------------------------------------------------------
  // ATTENDANCE — generate 30 days of history
  // -------------------------------------------------------

  // only generate for staff + hrd
  const workingUsers = savedUsers.filter((u) => u.role !== Role.ADMIN);
  const hrdUsers = savedUsers.filter((u) => u.role === Role.HRD);

  // clear existing attendance before reseeding
  await attendanceRepo.clear();
  console.log('🗑️  Cleared existing attendance records');

  for (const user of workingUsers) {
    // skip resigned/terminated users — fewer records
    const maxDays =
      user.employmentStatus === EmploymentStatus.EMPLOYED
        ? 30
        : user.employmentStatus === EmploymentStatus.ON_LEAVE
          ? 15
          : 5;

    for (let daysAgo = maxDays; daysAgo >= 1; daysAgo--) {
      // skip weekends
      const dateStr = pastDate(daysAgo);
      const dayOfWeek = new Date(dateStr).getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      // 85% chance of showing up
      if (Math.random() > 0.85) continue;

      const clockInHour = randomInt(7, 9);
      const clockInMin = randomInt(0, 59);
      const clockInTime = timeOnDate(dateStr, clockInHour, clockInMin);

      // working minutes: 7-10 hours
      const totalWorkingMinutes = randomInt(420, 600);
      const clockOutTime = new Date(
        clockInTime.getTime() + totalWorkingMinutes * 60 * 1000,
      );

      const totalBreakMinutes = randomInt(15, 60);
      const overtimeMinutes = Math.max(totalWorkingMinutes - 480, 0);

      // pick a random HRD approver
      const approver = hrdUsers[randomInt(0, hrdUsers.length - 1)];
      const approvedAt = new Date(
        clockInTime.getTime() + randomInt(5, 30) * 60 * 1000,
      );

      const attendance = attendanceRepo.create({
        userId: user.id,
        date: dateStr,
        clockInTime,
        clockOutTime,
        photoUrl: `/uploads/approved/seed-photo-${user.id}-${daysAgo}.jpg`,
        approvalStatus: ApprovalStatus.APPROVED,
        approvedBy: approver?.id ?? null,
        approvedAt,
        totalBreakMinutes,
        totalWorkingMinutes,
        isOnBreak: false,
        breakStartTime: null,
        isInvalid: false,
        invalidReason: null,
      });

      await attendanceRepo.save(attendance);
    }
  }

  console.log('✅ Attendance records seeded');

  // -------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------
  const totalUsers = await usersRepo.count();
  const totalAttendance = await attendanceRepo.count();
  console.log(`\n📊 Seed complete:`);
  console.log(`   Users: ${totalUsers}`);
  console.log(`   Attendance records: ${totalAttendance}`);

  await app.close();
}

seed();
