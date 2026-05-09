import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum Role {
  STAFF = 'staff',
  HRD = 'hrd',
  ADMIN = 'admin',
}
export enum WorkStatus {
  WORKING = 'working',
  ON_BREAK = 'on break',
  OFF_DUTY = 'off duty',
  PENDING = 'pending',
  PHOTO_REVISION = 'photo revision',
}
export enum EmploymentStatus {
  EMPLOYED = 'employed',
  ON_LEAVE = 'on leave',
  TERMINATED = 'terminated',
  RESIGNED = 'resigned',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column({ type: 'enum', enum: Role, default: Role.STAFF })
  role!: Role;

  @Column({ type: 'enum', enum: WorkStatus, default: WorkStatus.OFF_DUTY })
  workStatus!: WorkStatus;

  @Column({
    type: 'enum',
    enum: EmploymentStatus,
    default: EmploymentStatus.EMPLOYED,
  })
  employmentStatus!: EmploymentStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
