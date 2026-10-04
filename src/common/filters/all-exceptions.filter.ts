import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';

//فیلتر سراسری برای مدریت خطاها
//اینجا هر خطایی که چه از سمت سرور چه از سمت کاربر رو مرتب و و یک دست میکنیم و اون رو بر اساس نوع ارور به کاربر یا برنامه نویس در ترمینال نمایش میدیم


//فرمت ارور ها
export interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

const INTERNAL_MESSAGE = 'Internal server error';

//بدون استسنا همه خطاها داخل این کلاس میره چون بدون ارگمان هست 
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (response.headersSent) return;

    const { statusCode, message } = this.normalize(exception);


    //خطای رخ داده در سمت سرور باشد فقط در ترمینال به برنامه نویس نمایش داده میشه 
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      statusCode,
      message,
      error: STATUS_CODES[statusCode] ?? 'Error',
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    };

    //خلاصه ارور خیلی شیک و بدون کرش برنماه فقط ارور رو بصورت جیسون بر میگیردونه با قالبی مرتب و تمیز

    response.status(statusCode).json(body);
  }

  //یه تابع نرمال سازی برای خطاها
  private normalize(exception: unknown): { statusCode: number; message: string | string[] } {

    //اگر خطا از نوع http نبود مثلا یه باگعجیب بود که باعث کرش شدن برنماه میشه اون رو به صورت ارور 500 تبدیل میکنه  و پیام اصلی ارور رو مخفی میکنه تا اطلاعات سرور لو نره 
    if (!(exception instanceof HttpException)) {
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: INTERNAL_MESSAGE };
    }

    const statusCode = exception.getStatus();
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return { statusCode, message: INTERNAL_MESSAGE };
    }

    const res = exception.getResponse();
    if (typeof res === 'string') return { statusCode, message: res };

    const raw = (res as { message?: unknown }).message;
    if (typeof raw === 'string') return { statusCode, message: raw };
    if (Array.isArray(raw) && raw.every((m) => typeof m === 'string')) {
      return { statusCode, message: raw as string[] };
    }
    return { statusCode, message: exception.message };
  }
}
