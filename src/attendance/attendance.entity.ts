import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
}

@Entity()
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'timestamp' })
  clockInTime!: Date;

  @Column({ type: 'timestamp', nullable: true })
  clockOutTime!: Date | null;

  @Column()
  photoUrl!: string;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  approvalStatus!: ApprovalStatus;

  @Column({ type: 'varchar', nullable: true })
  approvedBy!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  totalBreakMinutes!: number;

  @Column({ type: 'int', default: 0 })
  totalWorkingMinutes!: number;

  @Column({ type: 'boolean', default: false })
  isOnBreak!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  breakStartTime!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ default: false })
  isInvalid!: boolean;

  @Column({ type: 'varchar', nullable: true })
  invalidReason!: string | null;
}
