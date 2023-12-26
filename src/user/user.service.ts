import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { RedisService } from 'src/redis/redis.service';
import { md5 } from 'src/util';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { LoginUserDto } from './dto/login-user.dto';
import { LoginUserVo } from './vo/login-user.vo';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';

@Injectable()
export class UserService {
  private logger = new Logger();

  @InjectRepository(User)
  private readonly userRepository: Repository<User>;

  @InjectRepository(Role)
  private roleRepository: Repository<Role>;

  @InjectRepository(Permission)
  private permissionRepository: Repository<Permission>;

  @Inject()
  private redisService: RedisService;

  async register(user: RegisterUserDto) {
    const captcha = await this.redisService.get(`captcha_${user.email}`);

    if (!captcha) {
      throw new HttpException('验证码已失效', HttpStatus.BAD_REQUEST);
    }

    if (user.captcha !== captcha) {
      throw new HttpException('验证码不正确', HttpStatus.BAD_REQUEST);
    }

    const foundUser = await this.userRepository.findOneBy({
      username: user.username,
    });

    if (foundUser) {
      throw new HttpException('用户名已存在', HttpStatus.BAD_REQUEST);
    }

    const newUser = new User();
    newUser.username = user.username;
    newUser.password = md5(user.password);
    newUser.nickName = user.nickName;
    newUser.email = user.email;

    try {
      await this.userRepository.save(newUser);
      return {
        status: 200,
        msg: '注册成功',
      };
    } catch (e) {
      this.logger.error(e, UserService);
      return {
        status: 401,
        msg: '注册失败',
      };
    }
  }

  async login(loginUser: LoginUserDto, isAdmin: boolean) {
    const user = await this.userRepository.findOne({
      where: {
        username: loginUser.username,
        isAdmin,
      },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new HttpException('用户不存在', HttpStatus.BAD_REQUEST);
    }

    if (user.password !== md5(loginUser.password)) {
      throw new HttpException('密码错误', HttpStatus.BAD_REQUEST);
    }

    const vo = new LoginUserVo();
    vo.userInfo = {
      id: user.id,
      username: user.username,
      nickName: user.nickName,
      avatar: user.avatar,
      email: user.email,
      isAdmin: user.isAdmin,
      phone: user.phone,
      isFrozen: user.isFrozen,
      createTime: user.createTime.getTime(),
      roles: user.roles.map((item) => item.name),
      permissions: user.roles.reduce((arr, item) => {
        item.permissions.map((permission) => {
          if (arr.indexOf(permission) === -1) arr.push(permission);
        });
        return arr;
      }, []),
    };

    return vo;
  }

  async findUserById(userId: number, isAdmin: boolean) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        isAdmin,
      },
      relations: ['roles', 'roles.permissions'],
    });

    return {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      roles: user.roles.map((item) => item.name),
      permissions: user.roles.reduce((arr, item) => {
        item.permissions.map((permission) => {
          if (arr.indexOf(permission) === -1) arr.push(permission);
        });
        return arr;
      }, []),
    };
  }

  async findUserDetailById(userId: number) {
    return await this.userRepository.findOne({ where: { id: userId } });
  }

  async updatePassword(userId: number, passwordDto: UpdateUserPasswordDto) {
    const captcha = await this.redisService.get(
      `update_password_captcha_${passwordDto.email}`,
    );

    if (!captcha) {
      throw new HttpException('验证码已过期', HttpStatus.BAD_REQUEST);
    }

    if (passwordDto.captcha !== captcha) {
      throw new HttpException('验证码错误', HttpStatus.BAD_REQUEST);
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    user.password = md5(passwordDto.password);

    try {
      await this.userRepository.save(user);
      return '密码修改成功';
    } catch (error) {
      this.logger.error(error.UserService);
      return '密码修改失败';
    }
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const captcha = await this.redisService.get(
      `update_user_captcha_${updateUserDto.email}`,
    );

    if (!captcha) {
      throw new HttpException('验证码已过期', HttpStatus.BAD_REQUEST);
    }

    if (captcha !== updateUserDto.captcha) {
      throw new HttpException('验证码错误', HttpStatus.BAD_REQUEST);
    }

    const user = await this.userRepository.findOne({ where: { id: id } });
    if (updateUserDto.nickName) {
      user.nickName = updateUserDto.nickName;
    }
    if (updateUserDto.avatar) {
      user.avatar = updateUserDto.avatar;
    }

    try {
      await this.userRepository.save(user);
      return '修改成功';
    } catch (error) {
      this.logger.error(error.UserService);
      return '修改失败';
    }
  }
}
