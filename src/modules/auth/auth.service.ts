import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AppConfig } from '../../config/index.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { publicUserSelect } from './auth.select.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { PasswordHasher } from './password-hasher.js';

type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

//پاسخس که بعد لاگین به کاربر داده میشه 
export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  //برای ثبت نام اطلاعات رو میگیره و اینکه رمز رو همون اول هش میکنه یعنی رمز نکاری میکنه
  async register(dto: RegisterDto): Promise<{ user: PublicUser }> {
    const passwordHash = await this.hasher.hash(dto.password);
    try {
      const user = await this.prisma.user.create({
        data: { username: dto.username, email: dto.email, passwordHash },
        select: publicUserSelect,
      });
      return { user };
    } catch (error) {
      throw this.mapUniqueViolation(error) ?? error;
    }
  }

  // اینجا هم که برای لاگینه
  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { ...publicUserSelect, passwordHash: true },
    });

    // علاوه بر رمزی که هش شده میگیره تا مقایسه کنه با ورودی کاربر
    //امده رمز فیک رو هم گرفته برای گمراه سازی هکر 
    const hash = user?.passwordHash ?? (await this.hasher.getDummyHash());
    const matches = await this.hasher.compare(dto.password, hash);

    //اینجا در هر دو حالت اگر کاربر موجود باشه ولی رمز اشتباه باشه یه خطایی میده و همون خطا هم باز داده  میشه وقتی که اگر اصلا کاربر موجود نباشه اینجوری هکری که دنبال همچین اطلاعتی بود گمراه میشه
    if (!user || !matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    //قبل اینکه هم اطلاعات کاربر بره سمت کلاینت پسورد هش دور ریخته میشه تا لو نره
    const { passwordHash: _omit, ...publicUser } = user;
    const { expiresInSeconds } = this.config.get('jwt', { infer: true });
    const accessToken = await this.jwt.signAsync({ sub: user.id });

    return { accessToken, tokenType: 'Bearer', expiresIn: expiresInSeconds, user: publicUser };
  }

  private mapUniqueViolation(error: unknown): ConflictException | null {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return null;
    }
    const haystack = JSON.stringify(error.meta ?? {}).toLowerCase();
    if (haystack.includes('email')) return new ConflictException('Email is already in use');
    if (haystack.includes('username')) return new ConflictException('Username is already in use');
    return new ConflictException('Username or email is already in use');
  }
}