# Social Feed API

## ۱. معرفی

یک REST API برای یک شبکه‌ی اجتماعی ساده که با **NestJS**، **PostgreSQL** (از طریق Prisma) و **Redis** ساخته شده است. کاربران ثبت‌نام می‌کنند، پست می‌گذارند، روی پست‌ها کامنت و ریپلای می‌نویسند و پروفایل و تاریخچه‌ی فعالیت یکدیگر را می‌بینند.

- **PostgreSQL منبع حقیقت (source of truth) است.** همه‌ی داده‌ها و قیود یکپارچگی در دیتابیس نگه‌داری و اعمال می‌شوند.
- **Redis منبع حقیقت نیست.** فقط برای cache فید و rate limit استفاده می‌شود؛ اگر در دسترس نباشد، API همچنان با PostgreSQL کار می‌کند.

## ۲. ویژگی‌ها

- ثبت‌نام، ورود و دریافت کاربر فعلی با JWT
- ایجاد پست (text / image / video) با rate limit به‌ازای هر کاربر
- فید صفحه‌بندی‌شده با تعداد کامنت‌ها و خلاصه‌ی آخرین کامنت هر پست، همراه با cache در Redis
- جزئیات پست (thread) همراه با لیست صفحه‌بندی‌شده‌ی کامنت‌های سطح‌اول، نویسنده و تعداد ریپلای هر کامنت
- کامنت‌های سطح‌اول و ریپلای‌ها با تضمین هم‌پست بودن والد و فرزند در سطح دیتابیس (composite foreign key)
- پروفایل کاربر با آمار و آخرین فعالیت‌ها، و تاریخچه‌ی صفحه‌بندی‌شده‌ی پست‌ها و کامنت‌ها
- Health check جداگانه برای liveness و readiness
- قالب خطای یکسان برای همه‌ی پاسخ‌های خطا
- تست‌های integration و e2e روی PostgreSQL و Redis واقعی

## ۳. معماری

```
                 ┌──────────────────────────────────────────────────────┐
  HTTP client ──▶│  NestJS  (/api/v1)                                   │
                 │  Helmet → CORS → Guards → ValidationPipe → Controller │
                 │                                   │                  │
                 │   ┌──────────┬──────────┬─────────┴──┬──────────┐    │
                 │   │  auth    │  posts   │  comments  │  users   │    │
                 │   └────┬─────┴────┬─────┴─────┬──────┴────┬─────┘    │
                 │        │          │ feed cache│           │          │
                 │        │          │ rate limit│           │          │
                 │   ┌────▼──────────▼───────────▼───────────▼─────┐    │
                 │   │ infrastructure: PrismaService | RedisService │    │
                 │   └──────────────┬───────────────────┬──────────┘    │
                 └──────────────────┼───────────────────┼───────────────┘
                                    ▼                   ▼
                          PostgreSQL 16           Redis 7
                          (source of truth)       (cache + rate limit, optional)
```

- `PrismaService` و `RedisService` تنها نقطه‌ی اتصال به دیتابیس و Redis هستند و در ماژول‌های `@Global` ارائه می‌شوند. هیچ feature service‌ای اتصال جدید نمی‌سازد.
- ماژول‌های feature فقط از طریق سرویس‌های export‌شده با هم حرف می‌زنند (مثلاً `CommentsModule` از `PostsService` برای invalidate کردن cache فید استفاده می‌کند).

## ۴. تکنولوژی‌ها

| بخش           | ابزار                                   |
| ------------- | --------------------------------------- |
| Runtime       | Node.js 22 (ESM)                        |
| Framework     | NestJS 12                               |
| زبان          | TypeScript 6 (strict)                   |
| دیتابیس       | PostgreSQL 16                           |
| ORM           | Prisma 7 با `@prisma/adapter-pg`        |
| Cache / Limit | Redis 7 با ioredis                      |
| Auth          | Passport JWT، bcrypt                    |
| Validation    | class-validator، class-transformer      |
| Health        | @nestjs/terminus                        |
| امنیت HTTP    | helmet                                  |
| تست           | Vitest، Supertest                       |
| کیفیت کد      | oxlint (type-aware)، Prettier           |
| زیرساخت محلی  | Docker Compose و Dockerfile چندمرحله‌ای |

## ۵. ساختار پوشه‌ها

```
.github/workflows/ci.yml        پایپ‌لاین CI
Dockerfile                      image چندمرحله‌ای اپلیکیشن (build و runtime)
docker/postgres/init-test-db.sql ساخت دیتابیس تست در اولین راه‌اندازی volume
prisma/
  schema.prisma                 مدل‌های User، Post، Comment و enum ContentType
  migrations/
    <ts>_init/                  جداول، enum، FKها و ایندکس‌های Prisma
    <ts>_add_checks_and_partial_indexes/  CHECKها و partial indexها (SQL دستی)
src/
  config/                       قرارداد env (class-validator) و نگاشت به AppConfig تایپ‌شده
  common/                       decorator، DTO صفحه‌بندی، exception filter، interfaceها، util صفحه‌بندی
  infrastructure/
    prisma/                     PrismaService (PrismaClient + PrismaPg)
    redis/                      RedisService (تنها اتصال ioredis، با شکست نرم)
  modules/
    auth/                       ثبت‌نام، ورود، JWT strategy و guard
    posts/                      پست‌ها، فید، cache فید، guard محدودیت نرخ
    comments/                   کامنت‌ها و ریپلای‌ها
    users/                      پروفایل و تاریخچه
    rate-limit/                 سرویس rate limit و اسکریپت Lua
    health/                     liveness و readiness
  generated/prisma/             خروجی prisma generate (commit نمی‌شود)
  app.module.ts | configure-app.ts | main.ts
test/
  database/                     تست‌های integration (schema، rate limit)
  e2e/                          تست‌های end-to-end هر ماژول
  helpers/                      بارگذاری env، ساخت اپ، reset دیتابیس/Redis، factoryها
```

## ۶. پیش‌نیازها

- Node.js 22 (نسخه در `.nvmrc`)
- npm 10 یا بالاتر
- Docker و Docker Compose
- آزاد بودن پورت‌های `5434` (PostgreSQL)، `6380` (Redis) و `3001` (API)

## ۷. راه‌اندازی محلی

```bash
cp .env.example .env            # سپس JWT_SECRET را با یک رشته‌ی تصادفی حداقل ۳۲ کاراکتری جایگزین کنید
npm ci
docker compose up -d
npm run prisma:generate
npm run prisma:migrate:deploy   # اعمال migrationها روی دیتابیس توسعه
npm run db:test:migrate         # اعمال migrationها روی دیتابیس تست
npm run start:dev
```

API روی `http://localhost:3001/api/v1` در دسترس است. برای ساخت یک `JWT_SECRET` تصادفی:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

## ۸. متغیرهای محیطی

همه‌ی متغیرها هنگام بوت توسط `src/config/env.validation.ts` اعتبارسنجی می‌شوند و در صورت نامعتبر بودن، برنامه با پیام واضح متوقف می‌شود.

| متغیر                                                 | پیش‌فرض / نمونه                                         | توضیح                                              |
| ----------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| `NODE_ENV`                                            | `development`                                           | `development`، `test` یا `production`              |
| `PORT`                                                | `3001`                                                  | پورت HTTP                                          |
| `CORS_ORIGIN`                                         | `http://localhost:5173`                                 | یک یا چند origin جداشده با کاما؛ خالی = CORS خاموش |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `app` / `change_me` / `social_feed`                     | فقط برای Docker Compose                            |
| `POSTGRES_PORT` / `REDIS_PORT`                        | `5434` / `6380`                                         | پورت‌های host در Docker Compose                    |
| `DATABASE_URL`                                        | `postgresql://app:change_me@localhost:5434/social_feed` | اتصال دیتابیس اصلی                                 |
| `REDIS_URL`                                           | `redis://localhost:6380/0`                              | اتصال Redis                                        |
| `DATABASE_URL_TEST`                                   | `.../social_feed_test`                                  | دیتابیس تست؛ نامش باید به `_test` ختم شود          |
| `REDIS_URL_TEST`                                      | `redis://localhost:6380/15`                             | Redis تست؛ باید DB شماره‌ی 15 باشد                 |
| `JWT_SECRET`                                          | (الزامی، حداقل ۳۲ کاراکتر)                              | کلید امضای HS256                                   |
| `JWT_EXPIRES_IN`                                      | `3600`                                                  | عمر توکن به ثانیه (۶۰ تا ۳۰ روز)                   |
| `FEED_CACHE_TTL_SECONDS`                              | `30`                                                    | TTL صفحات cache‌شده‌ی فید                          |
| `POST_CREATE_RATE_LIMIT`                              | `10`                                                    | حداکثر ایجاد پست در هر پنجره                       |
| `POST_CREATE_RATE_WINDOW_SECONDS`                     | `60`                                                    | طول پنجره‌ی rate limit                             |

فایل `.env` در `.gitignore` است و نباید منتشر شود. مقادیر `.env.example` فقط placeholder هستند.

## ۹. Docker

`docker-compose.yml` به‌طور پیش‌فرض فقط **PostgreSQL 16** و **Redis 7** (با AOF) را اجرا می‌کند و هر دو healthcheck دارند. این حالت برای توسعه است و API با `npm run start:dev` روی میزبان اجرا می‌شود.

```bash
docker compose up -d      # اجرای PostgreSQL و Redis
docker compose ps         # وضعیت و health
docker compose down       # توقف (داده‌ها در volume باقی می‌مانند)
docker compose down -v    # توقف و حذف کامل داده‌ها
```

اسکریپت `docker/postgres/init-test-db.sql` فقط در **اولین** راه‌اندازی یک volume خالی اجرا می‌شود و دیتابیس `social_feed_test` را می‌سازد.

### اجرای کامل در Docker (profile `app`)

```bash
cp .env.example .env                       # JWT_SECRET را جایگزین کنید
docker compose --profile app up --build -d # PostgreSQL، Redis، migrate و app
docker compose --profile app ps
docker compose --profile app down
```

- `Dockerfile` دو مرحله دارد: `build` (نصب کامل وابستگی‌ها، `prisma generate` و `nest build`) و `runtime` (فقط وابستگی‌های production و `dist/`، اجرا با کاربر غیر root `node`).
- سرویس یک‌بارمصرف `migrate` روی image مرحله‌ی `build` اجرا می‌شود و `prisma migrate deploy` را بعد از healthy شدن PostgreSQL انجام می‌دهد. `app` فقط بعد از موفقیت آن و healthy شدن Redis بالا می‌آید.
- `app` به‌جای `localhost` به نام سرویس‌ها (`postgres:5432` و `redis:6379`) وصل می‌شود؛ `DATABASE_URL` و `REDIS_URL` از `POSTGRES_*` ساخته می‌شوند و بقیه‌ی متغیرها از `.env` خوانده می‌شوند. اگر `POSTGRES_PASSWORD` کاراکتر خاص URL (مثل `@` یا `:`) داشته باشد، باید percent-encode شود.
- API روی پورت `PORT` میزبان (همان مقدار `.env`) در دسترس است و healthcheck کانتینر `GET /api/v1/health` را بررسی می‌کند.
- چون سرویس‌های `migrate` و `app` در profile `app` هستند، `docker compose up -d` معمولی رفتار قبلی را حفظ می‌کند.

## ۱۰. Prisma

تنظیمات CLI در `prisma7.config.ts` است و همه‌ی اسکریپت‌ها آن را با `--config` پاس می‌دهند. کلاینت در `src/generated/prisma` تولید می‌شود و commit نمی‌شود.

```bash
npm run prisma:generate        # تولید کلاینت (بعد از هر npm ci و هر تغییر schema)
npm run prisma:validate        # اعتبارسنجی schema
npm run prisma:migrate:dev     # ساخت/اعمال migration در توسعه
npm run prisma:migrate:deploy  # اعمال migrationهای موجود (بدون ساخت جدید)
npm run db:test:migrate        # اعمال migrationها روی DATABASE_URL_TEST
npm run prisma:studio          # رابط گرافیکی دیتابیس
```

migration دوم شامل SQL دستی است (CHECKها و partial indexها) که Prisma مستقیماً از schema تولید نمی‌کند. migrationهای اعمال‌شده نباید ویرایش شوند؛ هر تغییری باید یک migration جدید باشد.

## ۱۱. API

همه‌ی مسیرها با پیشوند `/api/v1` هستند.

| متد  | مسیر                                                | Auth | توضیح                                       |
| ---- | --------------------------------------------------- | ---- | ------------------------------------------- |
| POST | `/api/v1/auth/register`                             | -    | ثبت‌نام (201)                               |
| POST | `/api/v1/auth/login`                                | -    | ورود و دریافت توکن (200)                    |
| GET  | `/api/v1/auth/me`                                   | JWT  | کاربر فعلی                                  |
| POST | `/api/v1/posts`                                     | JWT  | ایجاد پست (با rate limit)                   |
| GET  | `/api/v1/posts?page=&limit=`                        | -    | فید صفحه‌بندی‌شده (cache‌شده)               |
| GET  | `/api/v1/posts/:id?page=&limit=`                    | -    | جزئیات پست + کامنت‌های سطح‌اول صفحه‌بندی‌شده |
| POST | `/api/v1/posts/:postId/comments`                    | JWT  | کامنت یا ریپلای (`parent_comment_id` یا `parentCommentId` اختیاری) |
| GET  | `/api/v1/posts/:postId/comments?page=&limit=`       | -    | کامنت‌های سطح‌اول                           |
| GET  | `/api/v1/posts/:postId/comments/:commentId/replies` | -    | فرزندان مستقیم یک کامنت                     |
| GET  | `/api/v1/users/:userId/profile`                     | -    | پروفایل، آمار و آخرین فعالیت‌ها             |
| GET  | `/api/v1/users/:userId/posts?page=&limit=`          | -    | تاریخچه‌ی پست‌های کاربر                     |
| GET  | `/api/v1/users/:userId/comments?page=&limit=`       | -    | تاریخچه‌ی کامنت‌های کاربر                   |
| GET  | `/api/v1/health`                                    | -    | liveness                                    |
| GET  | `/api/v1/health/ready`                              | -    | readiness (PostgreSQL)                      |

شناسه‌ها UUID v4 هستند؛ شناسه‌ی نامعتبر خطای 400 و شناسه‌ی ناموجود خطای 404 می‌دهد. نمونه:

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","email":"alice@example.com","password":"a-strong-password"}'
```

### جزئیات پست (`GET /posts/:id`)

پاسخ همان فیلدهای آیتم فید (`author`، `totalComments`، `latestComment`) را دارد و علاوه بر آن یک فیلد `comments` با قالب صفحه‌بندی استاندارد (`data` و `meta`) برمی‌گرداند. `page` و `limit` در این endpoint کامنت‌های **سطح‌اول** را صفحه‌بندی می‌کنند. هر کامنت نویسنده (`author.id`، `author.username`) و `totalReplies` دارد. ریپلای‌های هر کامنت از `/comments/:commentId/replies` خوانده می‌شوند.

```json
{
  "id": "…", "content": "…", "author": { "id": "…", "username": "alice" },
  "totalComments": 3, "latestComment": { "…": "…" },
  "comments": {
    "data": [{ "id": "…", "text": "…", "author": { "id": "…", "username": "bob" }, "totalReplies": 1 }],
    "meta": { "currentPage": 1, "itemsPerPage": 20, "totalItems": 2, "totalPages": 1 }
  }
}
```

پست و صفحه‌ی کامنت‌ها با سه query موازی خوانده می‌شوند (پست، `count` و `findMany` روی partial index کامنت‌های سطح‌اول)، پس N+1 ندارد. پست ناموجود 404 می‌دهد.

### قرارداد نام‌گذاری (camelCase)

**تصمیم:** همه‌ی فیلدهای JSON پاسخ‌ها **camelCase** هستند. صورت تسک برای مقادیر محاسبه‌شده snake_case نوشته است (`total_comments`)، اما برای `meta` صفحه‌بندی camelCase (`currentPage`). یک API نباید دو قرارداد را با هم داشته باشد. camelCase با TypeScript، خروجی Prisma و `meta` خود تسک یکسان است و نیاز به لایه‌ی تبدیل ندارد. ستون‌های دیتابیس snake_case هستند و نگاشت با `@map` در schema انجام می‌شود.

| نام در صورت تسک        | فیلد در API                                           |
| ---------------------- | ----------------------------------------------------- |
| `total_comments`       | `totalComments` (شامل ریپلای‌ها)                       |
| `total_replies`        | `totalReplies` (فقط فرزندان مستقیم)                    |
| `total_posts_created`  | `stats.totalPosts` در پروفایل                          |
| `total_comments_made`  | `stats.totalComments` در پروفایل                       |
| `parent_comment_id`    | ورودی: هر دو نام پذیرفته می‌شوند؛ خروجی: `parentCommentId` |

**استثنای ورودی:** چون تسک نام `parent_comment_id` را صریحاً برای body کامنت تعیین کرده، این نام به‌عنوان **alias ورودی** پذیرفته می‌شود و در DTO به `parentCommentId` نگاشت می‌شود. ارسال هر دو با مقدار متفاوت 400 می‌دهد. سرویس فقط یک فیلد (`parentCommentId`) می‌بیند.

### خلاصه‌ی آخرین کامنت

`latestComment.text` در فید (و هر جایی که `PostResponse` برمی‌گردد) **snippet** است: حداکثر ۲۸۰ کاراکتر و در صورت کوتاه شدن با `…` در انتها. همان تابع `excerpt` پروفایل (`src/common/utils/text.util.ts`) استفاده می‌شود و برش هیچ‌وقت یک surrogate pair (مثل ایموجی) را نصف نمی‌کند. متن کامل در لیست کامنت‌ها برمی‌گردد.

## ۱۲. احراز هویت و امنیت

- **JWT (HS256)** با payload حداقلی `{ sub: userId }`. `JwtStrategy` در هر درخواست کاربر را از دیتابیس می‌خواند، پس توکنِ کاربرِ حذف‌شده بلافاصله 401 می‌گیرد.
- `JWT_SECRET` الزامی است، حداقل ۳۲ کاراکتر دارد و هرگز در کد، لاگ یا پاسخ‌ها ظاهر نمی‌شود.
- **bcrypt با cost 10**. طول رمز با محدودیت ۷۲ بایتی bcrypt اعتبارسنجی می‌شود.
- **جلوگیری از user enumeration:** اگر ایمیل وجود نداشته باشد، مقایسه با یک hash ساختگی انجام می‌شود تا زمان پاسخ یکسان بماند و پیام خطا همیشه `Invalid credentials` است.
- `passwordHash` هرگز در پاسخ‌ها برنمی‌گردد. همه‌ی queryها `select` صریح دارند و `SELECT *` استفاده نمی‌شود.
- `authorId` همیشه از JWT می‌آید؛ ارسال آن در body با `forbidNonWhitelisted` خطای 400 می‌دهد.
- username و email قبل از ذخیره trim و lowercase می‌شوند و CHECK دیتابیس هم این را تضمین می‌کند.
- **Helmet** هدرهای امنیتی را تنظیم می‌کند. CORS فقط برای originهای `CORS_ORIGIN` فعال است.
- خطاهای 5xx با پیام عمومی `Internal server error` برمی‌گردند؛ جزئیات فقط در لاگ سرور ثبت می‌شود.

## ۱۳. Cache فید

الگوی **cache-aside** با **invalidation مبتنی بر generation**:

- کلید شمارنده: `posts:feed:v1:generation`
- کلید هر صفحه: `posts:feed:v1:g{generation}:page:{page}:limit:{limit}` با TTL برابر `FEED_CACHE_TTL_SECONDS`
- با ایجاد هر پست یا کامنت، شمارنده با `INCR` بالا می‌رود. همه‌ی صفحات قبلی فوراً بی‌اعتبار می‌شوند و بعداً با TTL حذف می‌شوند. نیازی به `KEYS` یا `SCAN` نیست.
- آنچه cache می‌شود **DTO نهایی** است، نه مدل خام Prisma. هنگام خواندن، شکل داده بررسی و تاریخ‌ها به `Date` تبدیل می‌شوند.
- ورودی خراب یا ناسازگار حذف و از PostgreSQL بازسازی می‌شود.
- اگر Redis در دسترس نباشد، همه‌ی عملیات cache بی‌صدا `null` برمی‌گردانند و فید مستقیماً از PostgreSQL خوانده می‌شود (بدون 500).

### چرا generation به‌جای حذف (`DEL`) کلید cache؟

صورت تسک می‌گوید با ایجاد پست، «کلید cache فید حذف شود». هدف آن، یعنی دیدن داده‌ی تازه توسط بازدیدکننده‌ی بعدی، کاملاً برآورده می‌شود، اما با یک `INCR` به‌جای `DEL`:

- **فید یک کلید نیست.** به ازای هر ترکیب `page` و `limit` یک کلید جدا وجود دارد. با `DEL` باید همه‌ی این کلیدها پیدا شوند: `KEYS` در production، Redis را مسدود می‌کند و `SCAN` چند round-trip، کند و غیراتمیک است. نگه‌داشتن لیست کلیدها در یک Set هم یک ساختار اضافه است که خودش باید همگام بماند.
- **`INCR` اتمیک و O(1) است.** چون generation بخشی از نام کلید هر صفحه است، بعد از `INCR` هیچ خواننده‌ای به کلیدهای قبلی نمی‌رسد. invalidation همه‌ی صفحات با یک فرمان انجام می‌شود.
- **race شرایط حذف را ندارد.** با `DEL`، درخواستی که قبل از ایجاد پست داده را از PostgreSQL خوانده، می‌تواند بعد از `DEL` داده‌ی کهنه را دوباره در همان کلید بنویسد. در این طراحی، خواننده generation را **قبل از** query می‌گیرد و زیر همان generation می‌نویسد؛ پس نتیجه‌ی کهنه در کلیدی می‌نشیند که دیگر خوانده نمی‌شود.
- **پاک‌سازی خودکار:** کلیدهای generationهای قبلی با TTL (`FEED_CACHE_TTL_SECONDS`) حذف می‌شوند.
- **هزینه:** تا پایان TTL کمی حافظه‌ی اضافه مصرف می‌شود که با TTL کوتاه ناچیز است.

## ۱۴. Rate limit و Lua

- **Fixed window** به‌ازای هر کاربر؛ پیش‌فرض ۱۰ پست در ۶۰ ثانیه.
- کلید: `ratelimit:posts:create:v1:user:{userId}:window:{windowId}` که `windowId = floor(nowSeconds / windowSeconds)`.
- اسکریپت Lua (`src/modules/rate-limit/lua/consume-attempt.lua.ts`) به‌صورت اتمیک `INCR` می‌کند و `EXPIRE` را **فقط وقتی count == 1** است تنظیم می‌کند. پس درخواست‌های همزمان race ندارند و پنجره تمدید نمی‌شود. تست integration نشان می‌دهد از ۲۵ درخواست همزمان دقیقاً ۱۰ تا پذیرفته می‌شوند.
- Guard **بعد از JWT و قبل از validation** اجرا می‌شود؛ پس درخواست‌های با body نامعتبر هم از سهمیه کم می‌کنند (جلوی سوءاستفاده از validation را می‌گیرد).
- هدرها: `X-RateLimit-Limit` و `X-RateLimit-Remaining` در هر پاسخ، و `Retry-After` همراه با 429.
- **Fail-open:** اگر Redis در دسترس نباشد، درخواست پذیرفته می‌شود و هیچ هدر rate limit گمراه‌کننده‌ای ارسال نمی‌شود.

## ۱۵. کامنت‌ها و composite foreign key

- کامنت سطح‌اول یعنی `parentCommentId = null`. endpoint ریپلای‌ها فقط **فرزندان مستقیم** را برمی‌گرداند و `totalReplies` هم فقط فرزندان مستقیم را می‌شمارد.
- قید `(parent_comment_id, post_id) → comments(id, post_id)` در سطح دیتابیس تضمین می‌کند ریپلای و والدش روی یک پست باشند. این قید روی یک `UNIQUE (id, post_id)` بنا شده است.
- در لایه‌ی سرویس هم بررسی می‌شود تا پیام خطای واضح برگردد: والد ناموجود → 404، والد روی پست دیگر → 400.
- CHECKها: متن خالی ممنوع، کامنت نمی‌تواند والد خودش باشد.
- همه‌ی FKها `ON DELETE RESTRICT` هستند؛ حذف آبشاری تصادفی ممکن نیست.
- ایندکس‌ها: `(post_id, created_at DESC, id DESC)` به‌صورت partial برای سطح‌اول (`WHERE parent_comment_id IS NULL`) و `(parent_comment_id, created_at DESC, id DESC)` به‌صورت partial برای ریپلای‌ها.
- ایجاد کامنت cache فید را invalidate می‌کند، چون `totalComments` و `latestComment` تغییر می‌کنند.

## ۱۶. صفحه‌بندی و tradeoff آن

- **Offset pagination** با `page` (پیش‌فرض 1) و `limit` (پیش‌فرض 20، حداکثر 100).
- مرتب‌سازی پایدار `createdAt DESC, id DESC`؛ `id` گره‌ی رکوردهای هم‌زمان را باز می‌کند.
- قالب پاسخ:

```json
{
  "data": [],
  "meta": { "currentPage": 1, "itemsPerPage": 20, "totalItems": 0, "totalPages": 0 }
}
```

- **Tradeoff:** offset ساده است، شماره‌ی صفحه و تعداد کل را می‌دهد و با cache مبتنی بر شماره‌ی صفحه سازگار است. اما در صفحات خیلی عمیق کندتر می‌شود و با درج رکورد جدید ممکن است آیتمی بین صفحات جابه‌جا شود. برای infinite scroll در مقیاس بالا، **cursor pagination** روی `(created_at, id)` گزینه‌ی بهتری است و ایندکس‌های فعلی از آن پشتیبانی می‌کنند.

## ۱۷. پروفایل و تاریخچه

- `GET /users/:userId/profile` شامل `id`، `username`، `createdAt`، `stats.totalPosts`، `stats.totalComments` و `recentActivity` است. ایمیل برنمی‌گردد.
- `recentActivity`: سه query موازی (کاربر با `_count`، ۵ پست آخر، ۵ کامنت آخر). سپس ادغام، مرتب‌سازی بر اساس `createdAt DESC, id DESC` و انتخاب ۵ آیتم اول. هر آیتم `type` (`post` یا `comment`) و یک `excerpt` حداکثر ۲۸۰ کاراکتری دارد.
- `GET /users/:userId/posts` و `/comments` تاریخچه‌ی کامل و صفحه‌بندی‌شده هستند. کاربر ناموجود 404 می‌دهد.
- از N+1 با `select` تودرتو و `_count` جلوگیری شده است.

## ۱۸. Health check

- `GET /api/v1/health` (**liveness**): فقط نشان می‌دهد پروسه زنده است و به هیچ وابستگی‌ای سر نمی‌زند.
- `GET /api/v1/health/ready` (**readiness**): یک `SELECT 1` با timeout ۱.۵ ثانیه روی PostgreSQL اجرا می‌کند. در صورت خطا 503 برمی‌گرداند.
- **Redis عمداً در readiness نیست:** Redis اختیاری است و API بدون آن هم درست کار می‌کند (cache bypass و rate limit fail-open). اگر Redis در readiness بود، قطعی آن کل سرویس را از load balancer خارج می‌کرد، در حالی که سرویس هنوز قادر به پاسخ‌گویی است.

## ۱۹. قالب خطا

همه‌ی خطاها توسط `AllExceptionsFilter` با یک شکل برمی‌گردند:

```json
{
  "statusCode": 400,
  "message": ["limit must not be greater than 100"],
  "error": "Bad Request",
  "path": "/api/v1/posts?limit=101",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

`message` برای خطاهای validation آرایه و در بقیه‌ی موارد رشته است. خطاهای 5xx همیشه پیام عمومی دارند.

## ۲۰. تست

```bash
npm test             # unit (src/**/*.spec.ts)
npm run test:int     # integration روی PostgreSQL و Redis واقعی
npm run test:e2e     # end-to-end از طریق HTTP
npm run test:all     # هر سه
```

- **Integration** (`test/database`): قیود schema (composite FK، CHECKها، unique، Restrict delete) و همزمانی rate limit (۲۵ درخواست همزمان → دقیقاً ۱۰ پذیرفته، ۱۵ رد).
- **E2E** (`test/e2e`): auth، posts (شامل cache فید و rate limit)، comments، users و health.
- در حال حاضر فایل unit test جداگانه‌ای وجود ندارد و پوشش رفتاری از طریق integration و e2e است. `npm test` در این حالت بدون خطا تمام می‌شود.
- `test/helpers/load-env.ts` قبل از اجرا `DATABASE_URL` و `REDIS_URL` را با مقادیر تست جایگزین می‌کند. اگر نام دیتابیس به `_test` ختم نشود یا Redis روی DB 15 نباشد، تست‌ها اجرا نمی‌شوند. reset دیتابیس فقط روی دیتابیس `_test` و flush فقط روی Redis DB 15 انجام می‌شود.
- پیش از اولین اجرا: `docker compose up -d` و `npm run db:test:migrate`.

## ۲۱. Build و اجرای production

```bash
npm ci
npm run prisma:generate
npm run build                    # خروجی در dist/
npm run prisma:migrate:deploy    # با DATABASE_URL محیط production
NODE_ENV=production npm run start:prod   # node dist/main.js
```

- در production متغیرها باید از محیط (نه فایل `.env`) تأمین شوند.
- برنامه سیگنال‌های توقف را دریافت می‌کند (`enableShutdownHooks`) و اتصال‌های دیتابیس و Redis را می‌بندد.
- اگر env نامعتبر باشد، بوت با پیام خطای خوانا و exit code 1 متوقف می‌شود. در دسترس بودن دیتابیس را با `/api/v1/health/ready` بررسی کنید.

## ۲۲. CI

`.github/workflows/ci.yml` روی هر push به `main` و هر pull request اجرا می‌شود:

1. Node از `.nvmrc` و `npm ci`
2. `prisma generate` و `prisma validate`
3. سرویس‌های PostgreSQL 16 و Redis 7 به‌صورت service container
4. اعمال migrationها روی دیتابیس تست
5. format check، lint، typecheck
6. تست‌های unit، integration و e2e
7. build

به هیچ GitHub Secret‌ای نیاز ندارد؛ همه‌ی مقادیر فقط مخصوص تست و containerهای یک‌بارمصرف هستند.

## ۲۳. Tradeoffها

- **Offset به‌جای cursor:** سادگی و سازگاری با cache، به قیمت کارایی صفحات عمیق.
- **Generation-based invalidation:** invalidation با یک `INCR` و بدون اسکن کلیدها؛ در عوض هر ایجاد پست یا کامنت کل cache فید را بی‌اعتبار می‌کند و تا پایان TTL کمی حافظه‌ی اضافه مصرف می‌شود.
- **Fixed window:** پیاده‌سازی ساده و یک round-trip، اما در مرز دو پنجره تا دو برابر limit ممکن است پذیرفته شود. sliding window دقیق‌تر ولی پرهزینه‌تر است.
- **Fail-open در rate limit:** در دسترس بودن سرویس به سخت‌گیری ترجیح داده شده است.
- **خواندن کاربر از DB در هر درخواست احرازشده:** یک query اضافه، در عوض ابطال فوری توکن کاربر حذف‌شده.
- **قیود در دیتابیس و سرویس:** تکرار عمدی؛ دیتابیس یکپارچگی را تضمین می‌کند و سرویس پیام خطای مناسب می‌دهد.

## ۲۴. محدودیت‌ها و کارهای آینده

- refresh token، logout و ابطال توکن وجود ندارد.
- ویرایش و حذف پست و کامنت پیاده‌سازی نشده است.
- آپلود فایل برای image/video وجود ندارد؛ `content` فقط متن یا URL است.
- cursor pagination برای فید.
- rate limit سراسری (مثلاً بر اساس IP) برای login و register.
- مستندات OpenAPI/Swagger.
- لاگ ساختاریافته، metrics و tracing.

## ۲۵. راهنمای مصاحبه

- **چرا composite FK؟** چون فقط با FK روی `parent_comment_id` می‌شد به کامنتِ پست دیگری ریپلای داد. قید ترکیبی این را در سطح دیتابیس غیرممکن می‌کند، حتی اگر کد اپلیکیشن باگ داشته باشد.
- **چرا partial index؟** کوئری کامنت‌های سطح‌اول همیشه `parent_comment_id IS NULL` دارد. partial index کوچک‌تر است و دقیقاً همین کوئری را پوشش می‌دهد.
- **چرا Lua برای rate limit؟** `INCR` و `EXPIRE` جدا از هم race دارند (کلید بدون TTL). Lua هر دو را اتمیک اجرا می‌کند.
- **چرا generation به‌جای حذف کلیدها؟** `KEYS` در production مسدودکننده است و `SCAN` کند و غیراتمیک. یک `INCR` همه چیز را در O(1) بی‌اعتبار می‌کند.
- **چرا DTO را cache می‌کنیم؟** مدل خام ممکن است فیلد حساس داشته باشد و به schema وابسته است. DTO قرارداد عمومی API است.
- **اگر Redis قطع شود چه می‌شود؟** فید از PostgreSQL خوانده می‌شود، rate limit fail-open می‌شود و readiness سالم می‌ماند.
- **جلوگیری از user enumeration؟** hash ساختگی برای زمان پاسخ یکسان و پیام خطای یکسان.
- **N+1؟** `select` تودرتو با `take: 1` برای آخرین کامنت و `_count` برای شمارش، در یک query.

## ۲۶. عیب‌یابی

- **پورت اشغال است (`EADDRINUSE` یا خطای Docker):** مقدار `PORT`، `POSTGRES_PORT` یا `REDIS_PORT` را در `.env` تغییر دهید و `DATABASE_URL` / `REDIS_URL` را هم به‌روز کنید.
- **Docker بالا نمی‌آید یا unhealthy است:** خروجی `docker compose ps` و `docker compose logs postgres` را بررسی کنید. اگر `POSTGRES_USER` یا `POSTGRES_PASSWORD` بعد از ساخت volume تغییر کرده باشد، مقادیر جدید اعمال نمی‌شوند؛ یا مقادیر قبلی را برگردانید یا با `docker compose down -v` volume را حذف کنید (همه‌ی داده‌ها پاک می‌شوند).
- **دیتابیس تست وجود ندارد:** اسکریپت init فقط روی volume خالی اجرا می‌شود. دستی بسازید:
  `docker compose exec postgres psql -U app -d postgres -c "CREATE DATABASE social_feed_test;"`
- **خطای migration (`P3009`، drift یا checksum):** migrationهای اعمال‌شده را ویرایش نکنید. در توسعه می‌توانید دیتابیس را reset کنید: `npx prisma migrate reset --config prisma7.config.ts` (همه‌ی داده‌ها پاک می‌شوند).
- **`Cannot find module '../generated/prisma/client.js'`:** کلاینت تولید نشده است؛ `npm run prisma:generate` را اجرا کنید.
- **خطای import در ESM (`ERR_MODULE_NOT_FOUND`):** importهای نسبی در این پروژه باید پسوند `.js` داشته باشند (حتی در فایل‌های `.ts`)، چون `module: nodenext` است.
- **تست‌ها با «must end with \_test» یا «DB 15» متوقف می‌شوند:** `DATABASE_URL_TEST` و `REDIS_URL_TEST` را مطابق `.env.example` تنظیم کنید و `npm run db:test:migrate` را اجرا کنید.
- **Redis در دسترس نیست:** API همچنان کار می‌کند. در لاگ هشدار `Redis unavailable` یا `Redis ... failed` می‌بینید، فید از PostgreSQL خوانده می‌شود و rate limit fail-open است. Redis را با `docker compose up -d redis` اجرا کنید. ioredis به‌طور خودکار برای اتصال مجدد تلاش می‌کند؛ اگر لاگ `Redis connection ready` ظاهر نشد، اپلیکیشن را restart کنید.
- **خطای env هنگام بوت:** پیام خطا نام متغیر و قانون نقض‌شده را نشان می‌دهد (مثلاً `JWT_SECRET` کوتاه‌تر از ۳۲ کاراکتر).

## ۲۷. لایسنس

لایسنس هنوز تعیین نشده است. _(placeholder: نوع لایسنس را اینجا مشخص کنید.)_
