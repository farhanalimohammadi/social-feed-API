import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';


//تمام درخوایت های auth به اینجا ارسال مشه
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  //درخواست های برای ثبت نام 
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  //درخواست های برای لاگین
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  //اینجا با یه دیتگتور سفارسی راحت با یه کلمه  اطلاعتت امن کاربر رو دریافت کردیم 
  me(@CurrentUser() user: AuthenticatedUser): { user: AuthenticatedUser } {
    //در نهایت اطلاعت کاربر رو بدون پیورد و به عنوان پروفایل بهش نشون میده
    return { user };
  }
}