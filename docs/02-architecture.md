# ۰۲ - معماری

این سند معماری واقعی کد را لایه‌به‌لایه توضیح می‌دهد. نام همه‌ی کلاس‌ها، فایل‌ها و importهایی که آمده، در کد منبع تأیید شده‌اند.

## نمودار کامل معماری از کلاینت تا پاسخ HTTP

```text
Client (HTTP)
   │
   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ Express (via @nestjs/platform-express)                                │
│                                                                       │
│  Middleware سراسری (configureApp):                                    │
│    helmet()                       ← هدرهای امنیتی                     │
│    enableCors(...)                ← فقط اگر CORS_ORIGIN تنظیم شده باشد│
│                                                                       │
│  Routing:  setGlobalPrefix('api') + URI versioning (defaultVersion 1) │
│            ⇒ /api/v1/...                                              │
│                                                                       │
│  Guards (در سطح route با @UseGuards):                                 │
│    JwtAuthGuard ──► JwtStrategy.validate ──► PrismaService (users)    │
│    PostCreateRateLimitGuard ──► RateLimitService ──► RedisService     │
│                                                                       │
│  Pipes:                                                               │
│    ValidationPipe سراسری (whitelist, forbidNonWhitelisted, transform) │
│    ParseUUIDPipe({ version: '4' }) روی پارامترهای مسیر                │
│                                                                       │
│  Controllers (نازک)                                                   │
│    AuthController / PostsController / CommentsController /           │
│    UsersController / HealthController                                 │
│                                                                       │
│  Services (منطق کسب‌وکار)                                             │
│    AuthService / PostsService / CommentsService / UsersService /      │
│    RateLimitService / PostsFeedCache / PrismaHealthIndicator          │
│                                                                       │
│  Select + Mapper                                                      │
│    *.select.ts  ⇒ فیلدهای مجاز در query                               │
│    *.mapper.ts  ⇒ شکل نهایی پاسخ                                      │
│                                                                       │
│  AllExceptionsFilter (سراسری)  ⇒ قالب واحد خطا                        │
└───────────────┬───────────────────────────────────────┬───────────────┘
                │                                       │
        PrismaService (@Global)                  RedisService (@Global)
        PrismaClient + PrismaPg                  ioredis client
                │                                       │
                ▼                                       ▼
          PostgreSQL 16                              Redis 7
```

## لایه‌ی Bootstrap

دو فایل در این لایه نقش دارند:

| فایل | مسئولیت |
|---|---|
| `src/main.ts` | ساخت برنامه با `NestFactory.create(AppModule, { abortOnError: false })`، فراخوانی `configureApp(app)`، خواندن `port` از `ConfigService` و `app.listen(port)`. هر خطای bootstrap لاگ می‌شود و برنامه با `process.exit(1)` خارج می‌شود. |
| `src/configure-app.ts` | تابع `configureApp(app)` تمام پیکربندی سراسری HTTP را اعمال می‌کند: `helmet()`، پیشوند `api`، نسخه‌بندی URI، `ValidationPipe` سراسری، `AllExceptionsFilter` سراسری، CORS شرطی و `enableShutdownHooks()`. |

دلیل جدا بودن `configureApp`: تست‌های E2E در `test/helpers/test-app.ts` همین تابع را روی برنامه‌ی تستی صدا می‌زنند. به همین دلیل مسیرها (`/api/v1`)، اعتبارسنجی و قالب خطا در تست دقیقاً مثل production است.

## لایه‌ی پیکربندی سراسری

- `ConfigModule.forRoot({ isGlobal: true, cache: true, load: [configuration] })` در `AppModule` ثبت شده است.
- تابع `configuration` در `src/config/configuration.ts` ابتدا `validateEnv(process.env)` را اجرا می‌کند و سپس یک شیء تایپ‌شده از نوع `AppConfig` می‌سازد.
- `validateEnv` در `src/config/env.validation.ts` با class-validator متغیرها را بررسی می‌کند. اگر متغیری نامعتبر باشد، خطای `Invalid environment configuration` پرتاب می‌شود و برنامه بالا نمی‌آید (fail-fast).
- مصرف‌کننده‌ها همیشه از `ConfigService<AppConfig, true>` و `config.get('<key>', { infer: true })` استفاده می‌کنند. بنابراین در هیچ Service یا Controllerی `process.env` مستقیماً خوانده نمی‌شود. استثنا فقط فایل‌های ابزار و تست هستند، مثل `prisma7.config.ts` و `test/helpers/*`.

جزئیات در [پیکربندی و زیرساخت](./10-configuration-infrastructure.md).

## مرز ماژول‌ها

| ماژول | فایل | imports | providers | exports | controllers |
|---|---|---|---|---|---|
| `AppModule` | `src/app.module.ts` | `ConfigModule.forRoot(...)`، `PrismaModule`، `RedisModule`، `AuthModule`، `PostsModule`، `CommentsModule`، `UsersModule`، `HealthModule` | - | - | - |
| `PrismaModule` (`@Global()`) | `src/infrastructure/prisma/prisma.module.ts` | - | `PrismaService` | `PrismaService` | - |
| `RedisModule` (`@Global()`) | `src/infrastructure/redis/redis.module.ts` | - | `RedisService` | `RedisService` | - |
| `AuthModule` | `src/modules/auth/auth.module.ts` | `PassportModule`، `JwtModule.registerAsync(...)` | `AuthService`، `PasswordHasher`، `JwtStrategy` | - | `AuthController` |
| `RateLimitModule` | `src/modules/rate-limit/rate-limit.module.ts` | - | `RateLimitService` | `RateLimitService` | - |
| `PostsModule` | `src/modules/posts/posts.module.ts` | `RateLimitModule` | `PostsService`، `PostsFeedCache`، `PostCreateRateLimitGuard` | `PostsService` | `PostsController` |
| `CommentsModule` | `src/modules/comments/comments.module.ts` | `PostsModule` | `CommentsService` | `CommentsService` | `CommentsController` |
| `UsersModule` | `src/modules/users/users.module.ts` | `PostsModule`، `CommentsModule` | `UsersService` | - | `UsersController` |
| `HealthModule` | `src/modules/health/health.module.ts` | `TerminusModule` | `PrismaHealthIndicator` | - | `HealthController` |

## گراف وابستگی ماژول‌ها

```text
                        AppModule
     ┌──────────┬──────────┼───────────┬────────────┬───────────┐
     ▼          ▼          ▼           ▼            ▼           ▼
ConfigModule PrismaModule RedisModule AuthModule  HealthModule  UsersModule
 (global)    (@Global)    (@Global)      │            │            │
                                         │            ▼            ├──► CommentsModule ──► PostsModule
                               PassportModule   TerminusModule     │                         │
                               JwtModule                           └──► PostsModule          ▼
                                                                                      RateLimitModule

جهت وابستگی Serviceها (یک‌طرفه، بدون حلقه):

UsersService ──► CommentsService ──► PostsService ──► PostsFeedCache ──► RedisService
     │                │                   │
     └──► PostsService└──► PrismaService  └──► PrismaService
     └──► PrismaService

PostCreateRateLimitGuard ──► RateLimitService ──► RedisService
JwtStrategy ──► PrismaService
PrismaHealthIndicator ──► PrismaService + HealthIndicatorService
```

## ماژول‌های `@Global()`

دو ماژول زیرساختی `@Global()` هستند:

- `PrismaModule` برای `PrismaService`
- `RedisModule` برای `RedisService`

`ConfigModule` هم با `isGlobal: true` سراسری شده است.

**دلیل:** این سه سرویس تقریباً در همه‌ی ماژول‌های feature لازم‌اند. با global بودنشان لازم نیست هر ماژول آن‌ها را جداگانه import کند. ماژول‌های feature هیچ‌کدام global نیستند و وابستگی‌هایشان را صریحاً import می‌کنند، مثلاً `CommentsModule` → `PostsModule`.

## مسئولیت Controllerها

Controllerها **نازک** هستند. هر متد فقط پارامترها را از درخواست می‌گیرد و یک متد Service را صدا می‌زند. منطق کسب‌وکار، query یا تصمیم‌گیری در آن‌ها وجود ندارد. مثلاً متد `create` در `PostsController`:

```ts
@Post()
@UseGuards(JwtAuthGuard, PostCreateRateLimitGuard)
create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePostDto) {
  return this.posts.create(user.id, dto);
}
```

نکته‌های مشترک:
- شناسه‌ی نویسنده همیشه از `@CurrentUser()` (یعنی از JWT) می‌آید، نه از body.
- پارامترهای UUID با `new ParseUUIDPipe({ version: '4' })` اعتبارسنجی می‌شوند.
- کدهای وضعیت به پیش‌فرض‌های NestJS سپرده شده‌اند: `201` برای `@Post()` و `200` برای `@Get()`. تنها استثنا `login` است که با `@HttpCode(HttpStatus.OK)` کد `200` برمی‌گرداند.

## مسئولیت Guardها

| Guard | فایل | کار |
|---|---|---|
| `JwtAuthGuard` | `src/modules/auth/guards/jwt-auth.guard.ts` | زیرکلاس `AuthGuard('jwt')`. استراتژی `jwt` یعنی `JwtStrategy` را اجرا می‌کند و `request.user` را پر می‌کند. اگر توکن نباشد یا نامعتبر باشد، `401` برمی‌گرداند. |
| `PostCreateRateLimitGuard` | `src/modules/posts/guards/post-create-rate-limit.guard.ts` | با `RateLimitService.consumePostCreateAttempt` یک سهمیه مصرف می‌کند، هدرهای `X-RateLimit-*` را تنظیم می‌کند و در صورت عبور از سقف، `429` همراه با `Retry-After` برمی‌گرداند. |

`JwtAuthGuard` از `AuthModule` export نشده است. Controllerهای دیگر کلاس آن را مستقیماً import می‌کنند. این کار عمل می‌کند چون این Guard وابستگی تزریقی ندارد و استراتژی `jwt` در Passport با نام ثبت می‌شود، و ثبت آن با تعریف `JwtStrategy` به‌عنوان provider در `AuthModule` انجام شده است.

## مسئولیت DTOها

DTOها کلاس‌هایی با decoratorهای class-validator و class-transformer هستند:

| DTO | فایل |
|---|---|
| `RegisterDto` | `src/modules/auth/dto/register.dto.ts` |
| `LoginDto` | `src/modules/auth/dto/login.dto.ts` |
| `CreatePostDto` | `src/modules/posts/dto/create-post.dto.ts` |
| `CreateCommentDto` | `src/modules/comments/dto/create-comment.dto.ts` |
| `PaginationQueryDto` | `src/common/dto/pagination-query.dto.ts` |

وظیفه‌ی آن‌ها نرمال‌سازی ورودی (`trim`، `toLowerCase`) و اعمال قواعد شکل و طول است. چون `ValidationPipe` با `whitelist` و `forbidNonWhitelisted` تنظیم شده، هر فیلدی که در DTO تعریف نشده باشد باعث خطای `400` می‌شود.

## مسئولیت Serviceها

Serviceها تنها محل منطق کسب‌وکار هستند:

- `AuthService`: ثبت‌نام، ورود، تبدیل خطای unique پایگاه داده (`P2002`) به `409`.
- `PostsService`: ساخت پست و invalidation فید، خواندن فید با cache-aside، خواندن پست‌های یک نویسنده و خواندن یک پست.
- `CommentsService`: بررسی وجود پست و تعلق والد به همان پست، ساخت کامنت و invalidation فید، و صفحه‌بندی کامنت‌های سطح اول، پاسخ‌ها و کامنت‌های یک نویسنده.
- `UsersService`: پروفایل با سه query موازی، و تاریخچه از طریق واگذاری به `PostsService` و `CommentsService`.
- `RateLimitService`: محاسبه‌ی پنجره و کلید و اجرای اسکریپت Lua.
- `PostsFeedCache`: خواندن، نوشتن و باطل‌کردن cache فید.
- `PrismaHealthIndicator`: اجرای `SELECT 1` با timeout برابر ۱۵۰۰ میلی‌ثانیه.

## مسئولیت Select و Mapper

```text
query ──(select صریح)──► ردیف تایپ‌شده‌ی Prisma ──(mapper)──► شیء پاسخ API
```

| ماژول | select | mapper |
|---|---|---|
| auth | `publicUserSelect` (`id`، `username`، `email`، `createdAt`) | - (ردیف مستقیم برگردانده می‌شود. در `login` فیلد `passwordHash` صریحاً جدا می‌شود) |
| posts | `postReadSelect` (به‌همراه author، آخرین کامنت و `_count.comments`) | `toPostResponse` |
| comments | `commentReadSelect` (به‌همراه author و `_count.replies`) | `toCommentResponse` |
| users | `profileUserSelect`، `recentPostSelect`، `recentCommentSelect` | `toUserProfile`، `mergeRecentActivity` |

انواع ردیف با `Prisma.XGetPayload<{ select: typeof ... }>` از روی خود شیء select مشتق می‌شوند. بنابراین اگر فیلدی از select حذف شود، mapper در زمان کامپایل خطا می‌دهد.

## مرز زیرساخت Prisma

- `PrismaService` از `PrismaClient` (کلاینت تولیدشده در `src/generated/prisma/client.js`) ارث می‌برد و با `new PrismaPg({ connectionString: url })` ساخته می‌شود.
- این تنها کلاینت پایگاه داده در کد برنامه است. تنها استثنا تست Integration مربوط به schema است (`test/database/schema.int-spec.ts`) که عمداً یک `PrismaClient` مستقل روی `DATABASE_URL_TEST` می‌سازد.
- چرخه‌ی عمر: در `onModuleInit` تابع `$connect()` و در `onModuleDestroy` تابع `$disconnect()` صدا زده می‌شود.

## مرز زیرساخت Redis

- `RedisService` تنها مالک کلاینت ioredis است و فقط عملیات محدود و مشخص را عرضه می‌کند: `get`، `set` (با `EX`)، `del`، `incr` و `eval`.
- همه‌ی عملیات از متد خصوصی `safe` عبور می‌کنند. این متد خطا را لاگ می‌کند و `null` برمی‌گرداند. بنابراین هیچ خطای Redis به لایه‌ی بالاتر پرتاب نمی‌شود.
- مصرف‌کننده‌ها فقط `PostsFeedCache` و `RateLimitService` هستند.

## مسئولیت فیلتر خطا

`AllExceptionsFilter` در `src/common/filters/all-exceptions.filter.ts` با `@Catch()` بدون آرگومان همه‌ی خطاها را می‌گیرد و قالب واحد زیر را برمی‌گرداند:

```json
{
  "statusCode": 400,
  "message": ["..."],
  "error": "Bad Request",
  "path": "/api/v1/...",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

- خطای غیر `HttpException` به `500` با پیام `Internal server error` تبدیل می‌شود.
- برای هر `HttpException` با وضعیت ۵۰۰ یا بیشتر هم پیام با `Internal server error` جایگزین می‌شود.
- خطاهای ۵xx همراه با stack در لاگ سرور ثبت می‌شوند.
- اگر هدرهای پاسخ قبلاً ارسال شده باشند (`response.headersSent`)، فیلتر کاری نمی‌کند.

## چرا لایه‌ی Repository وجود ندارد؟

در کد هیچ کلاس Repository وجود ندارد. Serviceها مستقیماً از `PrismaService` استفاده می‌کنند. دلیل‌ها:

1. خود `PrismaClient` یک API تایپ‌شده و سطح بالاست. یک لایه‌ی Repository نازک روی آن معمولاً فقط متدها را تکرار می‌کند.
2. شیءهای select نام‌دار (`*.select.ts`) و mapperها همان جداسازی‌ای را که از Repository انتظار می‌رود فراهم می‌کنند، یعنی کنترل فیلدها و شکل خروجی.
3. برای Unit Test، Serviceها با یک شیء ساختگی شبیه Prisma تست می‌شوند (`prisma as never`). نمونه‌اش در `posts.service.spec.ts` و `comments.service.spec.ts` دیده می‌شود.

هزینه‌ی این تصمیم: Serviceها به API خاص Prisma وابسته‌اند و تعویض ORM نیازمند تغییر Serviceهاست.

## جلوگیری از وابستگی حلقوی

- جهت وابستگی همیشه یک‌طرفه است: `Users → Comments → Posts → RateLimit`. هیچ `forwardRef` در کد وجود ندارد.
- `CommentsService` برای باطل‌کردن cache فید به‌جای دسترسی مستقیم به `PostsFeedCache` متد عمومی `PostsService.invalidateFeedCache()` را صدا می‌زند. به این ترتیب `PostsFeedCache` درون `PostsModule` خصوصی می‌ماند و فقط `PostsService` export می‌شود.
- `UsersService` تاریخچه را به `PostsService.findByAuthor` و `CommentsService.findByAuthor` واگذار می‌کند و منطق صفحه‌بندی را تکرار نمی‌کند.
- زیرساخت (`PrismaModule`، `RedisModule`) به هیچ ماژول featureی وابسته نیست.

## تفکیک لایه‌ها

| لایه | مسئولیت | نمونه در کد | چه کاری نباید بکند |
|---|---|---|---|
| انتقال (Transport) | دریافت HTTP، مسیریابی، Guard، Pipe، Controller، قالب خطا | `configure-app.ts`، `*.controller.ts`، `JwtAuthGuard`، `PostCreateRateLimitGuard`، DTOها، `AllExceptionsFilter` | query زدن به پایگاه داده، تصمیم کسب‌وکار |
| منطق کسب‌وکار | قواعد دامنه، هماهنگی query و cache، تبدیل خطای پایگاه داده | `AuthService`، `PostsService`، `CommentsService`، `UsersService`، `RateLimitService`، `PostsFeedCache` | دسترسی به `Request`/`Response` یا تنظیم هدر HTTP |
| شکل‌دهی داده | تعریف فیلدهای مجاز و شکل پاسخ | `*.select.ts`، `*.mapper.ts`، `posts-feed.codec.ts` | اجرای query یا عوارض جانبی |
| زیرساخت | مدیریت اتصال و کلاینت‌ها، ایزوله‌سازی خطا | `PrismaService`، `RedisService`، `PrismaHealthIndicator` | دانستن قواعد کسب‌وکار |
| پایداری داده (Persistence) | ذخیره‌ی ماندگار و اجرای یکپارچگی | `prisma/schema.prisma`، `prisma/migrations/**` | اعتماد به اینکه برنامه همیشه درست رفتار کند. constraintها در خود پایگاه داده‌اند |

یک استثنای آگاهانه: `PostCreateRateLimitGuard` در لایه‌ی انتقال قرار دارد، اما تصمیم سهمیه را به `RateLimitService` واگذار می‌کند و خودش فقط هدر و کد وضعیت HTTP را تنظیم می‌کند.
