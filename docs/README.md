# مستندات فنی Social Feed API

این پوشه مستندات فنی و معماری پروژه **Social Feed API** را در بر می‌گیرد. Social Feed API یک REST API مبتنی بر NestJS، PostgreSQL (از طریق Prisma) و Redis است.

تمام مطالب این مستندات مستقیماً از روی کد فعلی مخزن استخراج و بررسی شده‌اند. هر جا رفتاری از اجرای واقعی برنامه مشاهده شده باشد (و نه صرفاً از خواندن کد)، این موضوع به‌صراحت ذکر شده است. پیشنهادهای آینده نیز همیشه با برچسب «پیاده‌سازی نشده» از واقعیت‌های فعلی جدا شده‌اند.

## هدف این پوشه

| مخاطب | چه چیزی در این مستندات پیدا می‌کند |
|---|---|
| توسعه‌دهنده‌ی تازه‌وارد | ساختار پروژه، نحوه‌ی اجرا، مسیر عبور درخواست‌ها |
| بازبین فنی ارشد | تصمیم‌های معماری، trade-offها، مرزهای امنیتی، یکپارچگی داده |
| مصاحبه‌کننده / مدیر استخدام | خلاصه‌ی معماری، نقاط قوت و محدودیت‌های صادقانه |
| نگه‌دارنده‌ی آینده | دلیل تصمیم‌ها، قواعد تغییر امن migrationها، نقاط حساس کد |

## فهرست اسناد

| فایل | موضوع |
|---|---|
| [۰۱ - معرفی کلی](./01-overview.md) | پروژه چیست، قابلیت‌ها، محدوده، تکنولوژی‌ها، مدل ذهنی |
| [۰۲ - معماری](./02-architecture.md) | لایه‌ها، مرز ماژول‌ها، گراف وابستگی، مرزهای زیرساخت |
| [۰۳ - ساختار پروژه](./03-project-structure.md) | توضیح فایل‌به‌فایل کل مخزن |
| [۰۴ - چرخه‌ی عمر درخواست](./04-request-lifecycle.md) | جریان گام‌به‌گام endpointهای اصلی با نمودار ترتیبی |
| [۰۵ - احراز هویت و امنیت](./05-authentication-security.md) | JWT، bcrypt، validation، Helmet، CORS، محدودیت‌ها |
| [۰۶ - پایگاه داده و Prisma](./06-database-prisma.md) | schema، constraintها، indexها، migrationها |
| [۰۷ - Redis: Cache و Rate Limit](./07-redis-cache-rate-limit.md) | cache فید با generation و rate limit اتمیک با Lua |
| [۰۸ - مرجع API](./08-api-reference.md) | همه‌ی endpointها، ورودی‌ها، خروجی‌ها و خطاها |
| [۰۹ - تست](./09-testing.md) | سه لایه‌ی تست، helperها، اجرای تست‌ها، عیب‌یابی |
| [۱۰ - پیکربندی و زیرساخت](./10-configuration-infrastructure.md) | متغیرهای محیطی، Docker Compose، CI، اجرای محلی |
| [۱۱ - تصمیم‌ها و trade-offها](./11-decisions-tradeoffs.md) | ثبت تصمیم‌های معماری به سبک ADR |
| [۱۲ - راهنمای مصاحبه](./12-interview-guide.md) | ارائه‌ی پروژه در مصاحبه‌ی فنی |

## خلاصه‌ی معماری

```text
             HTTP Client
                  │
                  ▼
   ┌──────────────────────────────────┐
   │ NestJS (Express)                 │
   │  helmet → CORS → /api/v1 routing │
   │  Guards → ValidationPipe         │
   │  Controllers (thin)              │
   │  Services (business logic)       │
   │  Select + Mapper (safe output)   │
   │  AllExceptionsFilter             │
   └───────┬──────────────────┬───────┘
           │                  │
     PrismaService       RedisService
           │                  │
           ▼                  ▼
     PostgreSQL 16        Redis 7
   (source of truth)   (feed cache +
                        post rate limit)
```

## اصول محوری پروژه

1. **PostgreSQL منبع حقیقت (source of truth) است.** همه‌ی داده‌های ماندگار (کاربران، پست‌ها، کامنت‌ها) فقط در PostgreSQL نگه‌داری می‌شوند. یکپارچگی داده با constraintهای خود پایگاه داده تضمین می‌شود (unique، foreign key مرکب، CHECK).
2. **Redis زیرساخت اختیاری برای شتاب‌دهی و کنترل پذیرش است.** Redis فقط برای cache فید عمومی و rate limit ساخت پست استفاده می‌شود. اگر Redis در دسترس نباشد، برنامه بالا می‌آید، فید از PostgreSQL خوانده می‌شود و rate limit به حالت fail-open می‌رود.
3. **ساختار ماژولار مبتنی بر feature.** هر دامنه (`auth`، `posts`، `comments`، `users`، `rate-limit`، `health`) یک ماژول NestJS مستقل در `src/modules/` دارد.
4. **Controllerهای نازک.** Controllerها فقط ورودی را می‌گیرند، Guard و Pipe را اعمال می‌کنند و کار را به Service می‌سپارند.
5. **Prisma select صریح.** هر query فقط فیلدهای مجاز را با یک شیء `select` نام‌دار (مثل `publicUserSelect` و `postReadSelect`) واکشی می‌کند. به همین دلیل `passwordHash` هیچ‌وقت ناخواسته از پایگاه داده خارج نمی‌شود.
6. **خروجی امن مبتنی بر Mapper.** ردیف‌های Prisma پیش از ارسال به کلاینت با توابعی مثل `toPostResponse` و `toCommentResponse` به شکل قرارداد API تبدیل می‌شوند.
7. **راهبرد تست سه‌لایه.** Unit Test برای منطق خالص و Serviceها با mock، Integration Test روی PostgreSQL و Redis واقعی، و E2E Test روی کل برنامه از طریق HTTP.

## ترتیب پیشنهادی مطالعه برای توسعه‌دهنده‌ی جدید

1. [معرفی کلی](./01-overview.md) برای درک اینکه پروژه چه می‌کند.
2. [پیکربندی و زیرساخت](./10-configuration-infrastructure.md) برای بالا آوردن پروژه روی سیستم محلی.
3. [معماری](./02-architecture.md) و [ساختار پروژه](./03-project-structure.md).
4. [چرخه‌ی عمر درخواست](./04-request-lifecycle.md) و [مرجع API](./08-api-reference.md).
5. [پایگاه داده](./06-database-prisma.md) و [Redis](./07-redis-cache-rate-limit.md).
6. [امنیت](./05-authentication-security.md) و [تست](./09-testing.md).
7. [تصمیم‌ها و trade-offها](./11-decisions-tradeoffs.md).
