import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { User } from './users/user.entity';
import { Attendance } from './attendance/attendance.entity';
import { AttendanceModule } from './attendance/attendance.module';
import { UploadModule } from './upload/upload.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [
        ConfigModule,
        AttendanceModule,
        UsersModule,
        UploadModule,
        ScheduleModule,
      ],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        entities: [User, Attendance],
        synchronize: true, // dev only, disable in production
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    AttendanceModule,
    UploadModule,
    ScheduleModule.forRoot(),
  ],
})
export class AppModule {}
