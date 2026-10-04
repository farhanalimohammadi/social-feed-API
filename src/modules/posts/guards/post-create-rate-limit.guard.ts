import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface.js';
import { RateLimitService } from '../../rate-limit/rate-limit.service.js';
//محاقظت از مسیر ساخت پست جدید 

@Injectable()
export class PostCreateRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimit: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ user?: AuthenticatedUser }>();
    const response = http.getResponse<Response>();

  
    //این گارد فرض بر این گذاشته که یعنی به حق یقین اینطوره که جی دبلیو تی اجرا شده و توکن بررسی شده پس اگه به هر دلیلیکاربر وجود نداشته باشهدر جا دسترسی رو میبنده
    if (!request.user) throw new UnauthorizedException();

    const decision = await this.rateLimit.consumePostCreateAttempt(request.user.id);

    //اینحا هم برای راحتی فرانت اند نوشته شده که در هدر گارد میگه که سقف مجازپست گذشاتنتون چنداست یا مثلا چندتا دیگه هم میتونین بزارین
    if (!decision.degraded) {
      response.setHeader('X-RateLimit-Limit', String(decision.limit));
      response.setHeader('X-RateLimit-Remaining', String(decision.remaining));
    }

    //تایمری ست میشه میشه که کلاینت بدونن کاربر کی از مسدودیت در میاد و اینکه ارور ۴۲۹ داده میشه
    if (decision.allowed) return true;

    response.setHeader('Retry-After', String(decision.retryAfterSeconds));
    throw new HttpException(
      'Too many posts created. Please try again later.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}