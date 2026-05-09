import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, Role } from './user.entity';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';
import { ChangePasswordDto } from './change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async findAll(requestingUserRole: Role, page = 1, limit = 10) {
    const query = this.usersRepo
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.name',
        'user.email',
        'user.role',
        'user.workStatus',
        'user.employmentStatus',
        'user.createdAt',
      ]);

    // HRD can only see staff
    if (requestingUserRole === Role.HRD) {
      query.where('user.role = :role', { role: Role.STAFF });
    }
    // Admin sees staff + HRD
    if (requestingUserRole === Role.ADMIN) {
      query.where('user.role IN (:...roles)', {
        roles: [Role.STAFF, Role.HRD],
      });
    }

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(dto: CreateUserDto) {
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already exists');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({ ...dto, password: hashed });
    const saved = await this.usersRepo.save(user);

    const { password, ...result } = saved;
    return result;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    Object.assign(user, dto);
    const saved = await this.usersRepo.save(user);

    const { password, ...result } = saved;
    return result;
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    user.password = await bcrypt.hash(dto.newPassword, 10);
    await this.usersRepo.save(user);
    return { message: 'Password updated successfully' };
  }

  async remove(id: string, requestingUserRole: Role) {
    if (requestingUserRole !== Role.ADMIN) {
      throw new ForbiddenException('Only admin can delete users');
    }
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.usersRepo.remove(user);
    return { message: 'User deleted successfully' };
  }
}
