import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from './config/index.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import helmet from 'helmet';

//سرور قبل از روشن شدن و شروع به کار کردن کاملا اول پیکر بندی میشود اینجا

export function configureApp(app: INestApplication): void {
  //helmet هدرهای امنیتی استاندارد را می‌گذارد و X-Powered-By را حذف می‌کند
  app.use(helmet());
  //ساختار امن و مرتب را از appconfig میگیره
  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);

  //تمام ادرس های برنامه ما با api شروع میشن
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  //بصروت سراسری اینجا تعریفش کردیم تا هرجا نیزا به تعریف دوبارش نباشه این همون محافظ برنامه ماست که از درخواست های اضافی و مشکلات امینتی مارو باز میداره
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  //تنظیمات مربطو به cors
  const corsOrigin = config.get('corsOrigin', { infer: true });
  if (corsOrigin) {
    app.enableCors({
      origin: corsOrigin.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
    });
  }

  // اگر به هر دلیلی سرور داشت خاموش میشد اول تمام کار های نمیه تموم . تموم میشن و بعد فرآیند خاموش شدن اجرا میشه
  app.enableShutdownHooks();
}