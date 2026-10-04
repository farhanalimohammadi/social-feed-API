# ۰۱ - معرفی کلی پروژه

## Social Feed API چیست؟

Social Feed API یک سرویس backend از نوع REST است که هسته‌ی یک شبکه‌ی اجتماعی ساده را پیاده‌سازی می‌کند. کاربران ثبت‌نام و ورود می‌کنند، پست منتشر می‌کنند، زیر پست‌ها کامنت و پاسخ می‌گذارند و فید عمومی پست‌ها را به‌صورت صفحه‌بندی‌شده می‌خوانند. پروفایل عمومی هر کاربر همراه با آمار و فعالیت‌های اخیر او نیز قابل مشاهده است.

توضیح `package.json` پروژه:

```text
Social feed REST API built with NestJS, PostgreSQL (Prisma) and Redis
```

پروژه با رویکرد «production-minded» نوشته شده است. یعنی به‌جای تعداد زیاد قابلیت، روی درستی داده، امنیت ورودی، رفتار در زمان خرابی زیرساخت و تست‌پذیری تمرکز دارد.

## قابلیت‌های اصلی کسب‌وکار

| قابلیت | توضیح | ماژول |
|---|---|---|
| ثبت‌نام | ساخت کاربر با `username`، `email` و `password` (هش‌شده با bcrypt) | `AuthModule` |
| ورود | صدور JWT دسترسی (access token) | `AuthModule` |
| کاربر جاری | `GET /api/v1/auth/me` با توکن Bearer | `AuthModule` |
| ساخت پست | فقط برای کاربر احراز هویت‌شده، با rate limit برای هر کاربر | `PostsModule` + `RateLimitModule` |
| فید عمومی | لیست صفحه‌بندی‌شده‌ی پست‌ها از جدیدترین به قدیمی‌ترین، با cache در Redis | `PostsModule` |
| مشاهده‌ی یک پست | با شناسه‌ی UUID نسخه‌ی ۴ | `PostsModule` |
| کامنت و پاسخ | کامنت سطح اول یا پاسخ به کامنتی از همان پست | `CommentsModule` |
| لیست کامنت‌ها | کامنت‌های سطح اول یک پست، و پاسخ‌های مستقیم یک کامنت | `CommentsModule` |
| پروفایل عمومی | اطلاعات عمومی، آمار و حداکثر ۵ فعالیت اخیر | `UsersModule` |
| تاریخچه‌ی کاربر | لیست صفحه‌بندی‌شده‌ی همه‌ی پست‌ها و همه‌ی کامنت‌های یک کاربر | `UsersModule` |
| سلامت سرویس | liveness بدون وابستگی و readiness با بررسی پایگاه داده | `HealthModule` |

## حوزه‌های API

همه‌ی مسیرها با پیشوند سراسری `api` و نسخه‌بندی URI با نسخه‌ی پیش‌فرض `1` ثبت می‌شوند، یعنی با `/api/v1` شروع می‌شوند.

| حوزه | مسیرها |
|---|---|
| Auth | `POST /api/v1/auth/register`، `POST /api/v1/auth/login`، `GET /api/v1/auth/me` |
| Posts | `POST /api/v1/posts`، `GET /api/v1/posts`، `GET /api/v1/posts/:id` |
| Comments | `POST /api/v1/posts/:postId/comments`، `GET /api/v1/posts/:postId/comments`، `GET /api/v1/posts/:postId/comments/:commentId/replies` |
| Users | `GET /api/v1/users/:userId/profile`، `GET /api/v1/users/:userId/posts`، `GET /api/v1/users/:userId/comments` |
| Health | `GET /api/v1/health`، `GET /api/v1/health/ready` |

جزئیات کامل در [مرجع API](./08-api-reference.md) آمده است.

## محدوده و موارد خارج از محدوده

### آنچه پیاده‌سازی شده است

- احراز هویت با JWT فقط از نوع access token
- ساخت و خواندن پست، کامنت و پاسخ
- فید عمومی با cache-aside در Redis و invalidation مبتنی بر generation
- rate limit ثابت-پنجره (fixed window) برای ساخت پست، با اسکریپت Lua
- پروفایل و تاریخچه‌ی عمومی کاربر
- health check از نوع liveness و readiness
- تست‌های Unit، Integration و E2E

### آنچه عمداً یا فعلاً پیاده‌سازی نشده است

موارد زیر در کد فعلی **وجود ندارند**:

| مورد | وضعیت |
|---|---|
| refresh token، logout، لغو توکن | وجود ندارد |
| OAuth / ورود اجتماعی | وجود ندارد |
| نقش‌ها و مجوزها (RBAC) | وجود ندارد |
| ویرایش یا حذف پست، کامنت یا کاربر | هیچ endpoint ویرایش یا حذفی وجود ندارد |
| لایک، فالو، نوتیفیکیشن | وجود ندارد |
| آپلود و ذخیره‌سازی رسانه | وجود ندارد. `contentType` فقط یک برچسب enum است و `content` یک رشته‌ی متنی است |
| صفحه‌بندی cursor-based | وجود ندارد. صفحه‌بندی از نوع offset است |
| rate limit برای login، register یا کامنت | وجود ندارد. فقط ساخت پست محدود شده است |
| Swagger / OpenAPI | وجود ندارد |
| Dockerfile برای خود برنامه | وجود ندارد. Docker Compose فقط PostgreSQL و Redis را اجرا می‌کند |
| metrics و tracing | وجود ندارد |

## پشته‌ی تکنولوژی

نسخه‌ها از بازه‌های اعلام‌شده در `package.json`، فایل `.nvmrc` و imageهای `docker-compose.yml` گرفته شده‌اند.

| لایه | تکنولوژی | نسخه‌ی اعلام‌شده در مخزن |
|---|---|---|
| Runtime | Node.js | `engines.node: ">=22"` و `.nvmrc: 22` |
| زبان | TypeScript (strict) | `typescript: ^6.0.2` |
| نوع ماژول | ESM | `"type": "module"` و `module: nodenext` |
| فریم‌ورک | NestJS (روی Express) | `@nestjs/core: ^12.0.1`، `@nestjs/platform-express: ^12.0.1` |
| پیکربندی | `@nestjs/config` | `^12.0.1` |
| پایگاه داده | PostgreSQL | image `postgres:16-alpine` |
| ORM | Prisma | `prisma` و `@prisma/client`: `^7.10.0` |
| درایور | `@prisma/adapter-pg` | `^7.10.0` |
| Cache / Rate limit | Redis | image `redis:7-alpine` |
| کلاینت Redis | ioredis | `^6.0.0` |
| احراز هویت | Passport، `passport-jwt`، `@nestjs/passport`، `@nestjs/jwt` | `^0.7.0`، `^4.0.1`، `^12.0.0`، `^12.0.2` |
| هش رمز عبور | bcrypt | `^6.0.0` |
| اعتبارسنجی | class-validator، class-transformer | `^0.15.1`، `^0.5.1` |
| هدرهای امنیتی | helmet | `^8.3.0` |
| Health check | `@nestjs/terminus` | `^12.1.0` |
| تست | Vitest، Supertest، `@nestjs/testing` | `^4.1.2`، `^7.3.1`، `^12.0.1` |
| Lint | oxlint (type-aware) | `^1.58.0` |
| فرمت | Prettier | `^3.4.2` |
| زیرساخت محلی | Docker Compose | سرویس‌های `postgres` و `redis` |
| CI | GitHub Actions | `.github/workflows/ci.yml` |

## چرا PostgreSQL برای ذخیره‌سازی ماندگار؟

داده‌های این دامنه ذاتاً رابطه‌ای هستند: کاربر ← پست ← کامنت ← پاسخ. قواعد یکپارچگی مهمی هم بین آن‌ها وجود دارد. PostgreSQL این قواعد را در سطح خود پایگاه داده اجرا می‌کند، صرف‌نظر از اینکه کد برنامه چه کند:

- `UNIQUE` روی `username` و `email`
- foreign key مرکب `(parent_comment_id, post_id)` که پاسخ بین‌پستی را غیرممکن می‌کند
- `CHECK` برای حروف کوچک بودن شناسه‌ها، خالی نبودن متن‌ها و جلوگیری از اینکه کامنتی والد خودش باشد
- `ON DELETE RESTRICT` برای جلوگیری از حذف آبشاری ناخواسته
- index مرکب `(created_at DESC, id DESC)` برای مرتب‌سازی پایدار فید

جزئیات در [پایگاه داده و Prisma](./06-database-prisma.md).

## چرا Redis منبع حقیقت نیست؟

- **Cache فید:** Redis فقط کپی سریال‌شده‌ی صفحات فید را با TTL محدود نگه می‌دارد. اگر Redis خالی، قطع یا خراب باشد، فید از PostgreSQL ساخته می‌شود. داده‌ی خراب cache هم شناسایی و حذف می‌شود.
- **Rate limit:** شمارنده‌های Redis موقتی‌اند و با `EXPIRE` خودبه‌خود پاک می‌شوند. از دست رفتن آن‌ها فقط باعث می‌شود محدودیت موقتاً اعمال نشود (fail-open)، اما داده‌ی کسب‌وکار از بین نمی‌رود.
- `RedisService` همه‌ی خطاهای Redis را می‌گیرد و `null` برمی‌گرداند. بنابراین خطای Redis هرگز به خطای HTTP تبدیل نمی‌شود.

## نمای کلی مدل داده

```text
┌──────────────┐ 1      * ┌──────────────┐ 1      * ┌──────────────────┐
│    users     │──────────│    posts     │──────────│     comments     │
│ id (uuid)    │ author   │ id (uuid)    │ post     │ id (uuid)        │
│ username  U  │          │ author_id    │          │ post_id          │
│ email     U  │          │ content_type │          │ author_id ───────┼──► users.id
│ password_hash│          │ content      │          │ parent_comment_id│
│ created_at   │          │ caption?     │          │ text             │
│ updated_at   │          │ created_at   │          │ created_at       │
└──────────────┘          │ updated_at   │          │ updated_at       │
                          └──────────────┘          └────────┬─────────┘
                                                             │ (parent_comment_id, post_id)
                                                             └──► comments(id, post_id)
```

- هر پست یک نویسنده دارد.
- هر کامنت به یک پست و یک نویسنده تعلق دارد و می‌تواند والد اختیاری داشته باشد.
- والد باید کامنتی از **همان پست** باشد. این قاعده با foreign key مرکب تضمین می‌شود.

## مدل ذهنی

```text
         نوشتن (POST)                              خواندن (GET)
              │                                         │
   ┌──────────▼──────────┐                   ┌──────────▼──────────┐
   │ JWT + validation     │                  │ validation (query)  │
   │ (+ rate limit پست)   │                  └──────────┬──────────┘
   └──────────┬──────────┘                              │
              │                              فقط GET /posts:
   ┌──────────▼──────────┐                  ┌───────────▼──────────┐
   │ PostgreSQL (write)   │                 │ Redis HIT? → پاسخ    │
   └──────────┬──────────┘                  │ MISS → PostgreSQL    │
              │                             │        → ذخیره در    │
   ┌──────────▼──────────┐                  │          Redis       │
   │ INCR generation      │ ── باطل‌کردن ──► └──────────────────────┘
   │ (پست یا کامنت جدید)  │   cache فید
   └─────────────────────┘
```

قاعده‌ی کلی: **نوشتن همیشه به PostgreSQL می‌رود. خواندن فقط برای فید عمومی ممکن است از Redis سرو شود. Redis هیچ‌وقت شرط درستی سیستم نیست.**
