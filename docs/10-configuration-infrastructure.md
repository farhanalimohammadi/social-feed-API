# ۱۰ - پیکربندی و زیرساخت

## طراحی پیکربندی

```text
.env ──► ConfigModule.forRoot (بارگذاری در process.env)
             │
             ▼
   configuration()  ──►  validateEnv(process.env)
             │                 │
             │                 ├─ plainToInstance(EnvironmentVariables, ...)
             │                 │     enableImplicitConversion + exposeDefaultValues
             │                 └─ validateSync(...)  → خطا: throw
             ▼
   AppConfig (تایپ‌شده)  ──►  ConfigService<AppConfig, true>.get('key', { infer: true })
```

- `ConfigModule` با `isGlobal: true` و `cache: true` ثبت شده است.
- کد برنامه هیچ‌جا `process.env` را مستقیماً نمی‌خواند و فقط از `ConfigService` استفاده می‌کند.
- `enableImplicitConversion` رشته‌های env را به عدد تبدیل می‌کند و `exposeDefaultValues` مقادیر پیش‌فرض کلاس را اعمال می‌کند.
- `validateSync` با `whitelist: true` اجرا می‌شود. متغیرهای محیطی دیگر سیستم از نمونه حذف می‌شوند و خطا ایجاد نمی‌کنند.

## اعتبارسنجی fail-fast

اگر هر متغیر نامعتبر باشد، `validateEnv` خطایی با فهرست مشکلات پرتاب می‌کند. `main.ts` آن را لاگ می‌کند و با `process.exit(1)` خارج می‌شود. نمونه‌ی مشاهده‌شده در اجرای محلی با `JWT_SECRET` کوتاه:

```text
ERROR [Bootstrap] Invalid environment configuration:
  - JWT_SECRET: JWT_SECRET must be longer than or equal to 32 characters
```

## متغیرهای محیطی

### متغیرهای برنامه (اعتبارسنجی‌شده در `EnvironmentVariables`)

| متغیر | هدف | اعتبارسنجی / پیش‌فرض | مصرف‌کننده | نکته‌ی امنیتی |
|---|---|---|---|---|
| `NODE_ENV` | محیط اجرا | `development` / `test` / `production`، پیش‌فرض `development` | به `AppConfig.nodeEnv` نگاشت می‌شود، اما در کد فعلی مصرف‌کننده‌ای ندارد. | - |
| `PORT` | پورت HTTP | عدد صحیح ۱ تا ۶۵۵۳۵، پیش‌فرض `3000` | `main.ts` | - |
| `CORS_ORIGIN` | originهای مجاز، جداشده با کاما | اختیاری، رشته | `configure-app.ts` | اگر خالی باشد CORS غیرفعال است. wildcard استفاده نکنید. |
| `DATABASE_URL` | اتصال PostgreSQL | الزامی. URL با پروتکل `postgres` یا `postgresql` (`require_tld: false`) | `PrismaService` و `prisma7.config.ts` | حاوی رمز پایگاه داده است. |
| `REDIS_URL` | اتصال Redis | الزامی. URL با پروتکل `redis` یا `rediss` | `RedisService` | - |
| `JWT_SECRET` | کلید امضای JWT | الزامی. رشته با حداقل ۳۲ کاراکتر | `AuthModule` و `JwtStrategy` | محرمانه. مقدار `.env.example` placeholder است. |
| `JWT_EXPIRES_IN` | عمر توکن (ثانیه) | عدد صحیح ۶۰ تا ۲۵۹۲۰۰۰، پیش‌فرض `3600` | `AuthModule` و `AuthService` | عمر کوتاه‌تر یعنی ریسک کمتر برای توکن سرقت‌شده. |
| `FEED_CACHE_TTL_SECONDS` | TTL صفحات cache فید | ۱ تا ۳۶۰۰، پیش‌فرض `30` | `PostsFeedCache` | حداکثر کهنگی فید در صورت شکست invalidation |
| `POST_CREATE_RATE_LIMIT` | سقف ساخت پست در هر پنجره | ۱ تا ۱۰۰۰، پیش‌فرض `10` | `RateLimitService` | - |
| `POST_CREATE_RATE_WINDOW_SECONDS` | طول پنجره (ثانیه) | ۱ تا ۳۶۰۰، پیش‌فرض `60` | `RateLimitService` | - |

### متغیرهای خارج از اعتبارسنجی برنامه

این متغیرها در `.env.example` وجود دارند اما برنامه‌ی NestJS آن‌ها را اعتبارسنجی یا مصرف نمی‌کند:

| متغیر | مصرف‌کننده | توضیح |
|---|---|---|
| `POSTGRES_USER` | `docker-compose.yml` | الزامی (`:?`) |
| `POSTGRES_PASSWORD` | `docker-compose.yml` | الزامی (`:?`) و محرمانه |
| `POSTGRES_DB` | `docker-compose.yml` | پیش‌فرض `social_feed` |
| `POSTGRES_PORT` | `docker-compose.yml` | پورت میزبان، پیش‌فرض `5434` |
| `REDIS_PORT` | `docker-compose.yml` | پورت میزبان، پیش‌فرض `6380` |
| `DATABASE_URL_TEST` | `db:test:migrate`، `test/helpers/load-env.ts`، `schema.int-spec.ts` | باید به پایگاه داده‌ای با پسوند `_test` اشاره کند. |
| `REDIS_URL_TEST` | `test/helpers/load-env.ts`، `redis-reset.ts` | باید به `/15` ختم شود. |

مقادیر اتصال در `DATABASE_URL` و `REDIS_URL` باید با `POSTGRES_*` و `REDIS_PORT` هماهنگ باشند. Docker Compose آن‌ها را خودکار هماهنگ نمی‌کند.

## `.env` در برابر `.env.example`

| فایل | در کنترل نسخه؟ | هدف |
|---|---|---|
| `.env.example` | بله (`!.env.example` در `.gitignore`) | الگوی کامل متغیرها با مقادیر نمونه و placeholder |
| `.env` | خیر (`.env` و `.env.*` در `.gitignore`) | مقادیر واقعی محلی |

فایل `.env` توسط این ابزارها خوانده می‌شود:
- `ConfigModule.forRoot` هنگام اجرای برنامه
- `prisma7.config.ts` از طریق `import 'dotenv/config'`
- `test/helpers/load-env.ts`
- اسکریپت `db:test:migrate` (با `set -a; . ./.env`)
- Docker Compose برای جایگذاری `${...}`

## Docker Compose

`docker-compose.yml` با `name: social-feed` دو سرویس پیش‌فرض تعریف می‌کند (سرویس‌های `migrate` و `app` در بخش Dockerfile آمده‌اند):

| سرویس | image | پورت (میزبان:container) | volume | healthcheck | نکات |
|---|---|---|---|---|---|
| `postgres` | `postgres:16-alpine` | `${POSTGRES_PORT:-5434}:5432` | `postgres_data:/var/lib/postgresql/data` و `./docker/postgres/init-test-db.sql` (فقط‌خواندنی) | `pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}`، هر ۵ ثانیه، timeout ۳ ثانیه، ۱۰ تلاش | `restart: unless-stopped` |
| `redis` | `redis:7-alpine` | `${REDIS_PORT:-6380}:6379` | `redis_data:/data` | `redis-cli ping`، هر ۵ ثانیه، timeout ۳ ثانیه، ۱۰ تلاش | `command: ['redis-server', '--appendonly', 'yes']` و `restart: unless-stopped` |

### PostgreSQL

- `POSTGRES_USER` و `POSTGRES_PASSWORD` الزامی‌اند و `docker compose` بدون آن‌ها با خطا متوقف می‌شود.
- پایگاه داده‌ی اصلی `${POSTGRES_DB:-social_feed}` است.
- پایگاه داده‌ی `social_feed_test` را `init-test-db.sql` می‌سازد.

### Redis و AOF

- `--appendonly yes` حالت AOF را فعال می‌کند، یعنی داده‌ی Redis با restart از بین نمی‌رود.
- با این حال، داده‌ی Redis در این پروژه موقتی است (cache با TTL و شمارنده‌های پنجره). تنها کلید پایدار `posts:feed:v1:generation` است و از دست رفتن آن فقط باعث می‌شود generation از `'0'` شروع شود.

### Volumeها

- `postgres_data` و `redis_data` از نوع named volume هستند.
- `docker compose down -v` این volumeها و **همه‌ی داده‌ها** را حذف می‌کند.

### پورت‌ها

پورت‌های پیش‌فرض میزبان (`5434` و `6380`) عمداً با پورت‌های استاندارد (`5432` و `6379`) متفاوت‌اند تا با نمونه‌های محلی دیگر PostgreSQL و Redis تداخل نداشته باشند.

### ساخت پایگاه داده‌ی تست

image رسمی PostgreSQL اسکریپت‌های `/docker-entrypoint-initdb.d/` را **فقط وقتی volume داده خالی است** اجرا می‌کند. اگر volume `postgres_data` قبلاً ساخته شده باشد، `social_feed_test` به‌طور خودکار ساخته نمی‌شود. راه‌حل در بخش عیب‌یابی آمده است.

### Dockerfile

`Dockerfile` چندمرحله‌ای است و بر پایه‌ی `node:22-bookworm-slim` ساخته می‌شود:

| مرحله | کار |
|---|---|
| `build` | `npm ci` کامل، `npm run prisma:generate` و `npm run build` |
| `runtime` | `npm ci --omit=dev`، کپی `dist/` از مرحله‌ی `build`، `NODE_ENV=production`، اجرا با کاربر `node` و `CMD ["node", "dist/main.js"]` |

`.dockerignore` پوشه‌های `node_modules`، `dist`، `src/generated`، `.git` و فایل‌های `.env` را از context حذف می‌کند تا image تمیز باشد و هیچ secretی وارد آن نشود.

### profile `app` در Docker Compose

دو سرویس دیگر فقط با `--profile app` فعال می‌شوند، پس `docker compose up -d` معمولی همچنان فقط PostgreSQL و Redis را اجرا می‌کند:

| سرویس | image | نقش | وابستگی |
|---|---|---|---|
| `migrate` | مرحله‌ی `build` | اجرای یک‌باره‌ی `npm run prisma:migrate:deploy` | `postgres` باید healthy باشد |
| `app` | مرحله‌ی `runtime` | اجرای API روی `${PORT:-3000}:3000` با healthcheck روی `GET /api/v1/health` | `migrate` با موفقیت تمام شده باشد و `redis` healthy باشد |

```bash
docker compose --profile app up --build -d
```

در کانتینر `app`، `DATABASE_URL` و `REDIS_URL` به نام سرویس‌ها (`postgres:5432` و `redis:6379`) اشاره می‌کنند و از `POSTGRES_*` ساخته می‌شوند. `JWT_SECRET` الزامی است و بقیه‌ی متغیرها پیش‌فرض‌های `.env.example` را دارند.

## نقش فایل پیکربندی Prisma

`prisma7.config.ts` برای CLI پریزما این موارد را تعیین می‌کند:
- مسیر schema: `prisma/schema.prisma`
- مسیر migrationها: `prisma/migrations`
- آدرس پایگاه داده: `process.env.DATABASE_URL` (پس از بارگذاری `.env`)

چون `schema.prisma` در `datasource` آدرسی ندارد، همه‌ی دستورهای CLI باید `--config prisma7.config.ts` داشته باشند. اسکریپت‌های `npm` این گزینه را دارند.

## گردش کار راه‌اندازی محلی

```bash
# ۱. پیکربندی
cp .env.example .env
# مقادیر POSTGRES_PASSWORD، JWT_SECRET (≥ 32 کاراکتر) و ... را ویرایش کنید
# و DATABASE_URL / DATABASE_URL_TEST را با رمز جدید هماهنگ کنید

# ۲. وابستگی‌ها
npm ci

# ۳. زیرساخت
docker compose up -d
docker compose ps        # تا وضعیت healthy صبر کنید

# ۴. کلاینت Prisma
npm run prisma:generate

# ۵. migrationها
npm run prisma:migrate:deploy   # اعمال migrationهای موجود روی DATABASE_URL
npm run db:test:migrate         # اعمال روی DATABASE_URL_TEST

# ۶. اجرا در حالت توسعه
npm run start:dev
# API: http://localhost:<PORT>/api/v1
```

## خاموش کردن

```bash
# توقف برنامه: Ctrl+C (enableShutdownHooks اتصال Prisma و Redis را می‌بندد)

docker compose stop      # توقف containerها با حفظ داده
docker compose down      # حذف containerها با حفظ volumeها
docker compose down -v   # حذف containerها و volumeها (همه‌ی داده‌ها پاک می‌شوند)
```

## Build تولیدی

```bash
npm run build        # nest build با tsconfig.build.json
npm run start:prod   # node dist/main.js
```

### شناسایی entrypoint در `dist`

- `tsconfig.build.json` مقادیر `rootDir: ./src` و `outDir: ./dist` را دارد. پس `src/main.ts` به `dist/main.js` کامپایل می‌شود (نه `dist/src/main.js`).
- اسکریپت `start:prod` دقیقاً همین مسیر را اجرا می‌کند: `node dist/main.js`.
- `nest-cli.json` گزینه‌ی `deleteOutDir: true` دارد و `dist` پیش از هر build پاک می‌شود.
- کلاینت تولیدشده‌ی Prisma (`src/generated/prisma`) هم به `dist/generated/prisma` کامپایل می‌شود. بنابراین `prisma:generate` باید **پیش از** build اجرا شده باشد.
- فایل‌های `src/**/*.spec.ts` از build حذف می‌شوند. اما `src/modules/rate-limit/rate-limit.int-spec.ts` با این الگو مطابقت ندارد و در `dist/modules/rate-limit/` کامپایل می‌شود.
- build تولیدی هم به `.env` یا متغیرهای محیطی معتبر نیاز دارد، چون `ConfigModule` در startup آن‌ها را اعتبارسنجی می‌کند.

## CI

`.github/workflows/ci.yml`:

| مورد | مقدار |
|---|---|
| تریگر | `push` به `main` و هر `pull_request` |
| مجوز | `contents: read` |
| هم‌زمانی | `group: ci-${{ github.ref }}` و `cancel-in-progress: true` |
| سرویس‌ها | `postgres:16-alpine` (پایگاه داده‌ی `social_feed_test`) و `redis:7-alpine` با healthcheck |
| Node | از `.nvmrc`، با cache برای npm |
| timeout | ۲۰ دقیقه |

مراحل به ترتیب: `npm ci` ← `prisma:generate` ← `prisma:validate` ← `db:test:migrate` ← `format:check` ← `lint` ← `typecheck` ← `npm test` ← `test:int` ← `test:e2e` ← `build`.

## رفتار در زمان خرابی Redis

| مرحله | رفتار |
|---|---|
| Startup | هشدار `Redis unavailable at startup` و ادامه‌ی startup (مشاهده‌شده) |
| فید | از PostgreSQL خوانده می‌شود و پاسخ `200` است (مشاهده‌شده). |
| invalidation | هشدار و ادامه |
| rate limit | fail-open: پذیرش بدون هدر `X-RateLimit-*` |
| readiness | تحت تأثیر قرار نمی‌گیرد. |
| اتصال مجدد | ioredis تلاش برای اتصال مجدد را مدیریت می‌کند. با رسیدن رویداد `ready` پیام `Redis connection ready` لاگ و پرچم لاگ خطا ریست می‌شود. |

## رفتار در زمان خرابی PostgreSQL

| مرحله | رفتار |
|---|---|
| Startup | در اجرای محلی با آدرس غیرقابل‌دسترس، برنامه بالا آمد و `Database connection established` را لاگ کرد. اتصال واقعی در startup تضمین نمی‌شود. |
| endpointهایی که به پایگاه داده نیاز دارند | `500` با پیام `Internal server error` (مشاهده‌شده برای فید با cache خالی) |
| فید با cache HIT | از نظر کد، از Redis سرو می‌شود و به PostgreSQL دست نمی‌زند. |
| liveness | `200` (مشاهده‌شده) |
| readiness | `503` (مشاهده‌شده) |

نتیجه این است که برای تشخیص سلامت پایگاه داده باید به `GET /api/v1/health/ready` تکیه کرد، نه به لاگ startup.

## عیب‌یابی

### تداخل پورت

| نشانه | راه‌حل |
|---|---|
| `docker compose up` خطای `port is already allocated` روی 5434 یا 6380 می‌دهد. | `POSTGRES_PORT` یا `REDIS_PORT` را در `.env` تغییر دهید و **`DATABASE_URL`، `DATABASE_URL_TEST`، `REDIS_URL` و `REDIS_URL_TEST` را هم به‌روز کنید.** |
| برنامه با `EADDRINUSE` روی `PORT` بالا نمی‌آید. | `PORT` را در `.env` تغییر دهید (پیش‌فرض 3000). |

### مسیرهای import در ESM

پروژه ESM است (`"type": "module"` و `module: nodenext`). importهای نسبی در فایل‌های `.ts` باید پسوند **`.js`** داشته باشند:

```ts
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
```

اگر پسوند حذف شود، typecheck با خطای nodenext شکست می‌خورد و در زمان اجرا هم ماژول پیدا نمی‌شود.

### تولید کلاینت Prisma

| نشانه | علت | راه‌حل |
|---|---|---|
| `Cannot find module '../../generated/prisma/client.js'` | `src/generated` در `.gitignore` است و پس از `npm ci` وجود ندارد. | `npm run prisma:generate` |
| خطای نوع در selectها یا mapperها پس از تغییر schema | کلاینت قدیمی است. | `npm run prisma:generate` و سپس `npm run typecheck` |
| خطای `datasource.url` در دستورهای Prisma | `DATABASE_URL` تنظیم نشده یا `--config` جا افتاده است. | از اسکریپت‌های `npm run prisma:*` استفاده کنید. |

### migration پایگاه داده‌ی تست

| نشانه | علت | راه‌حل |
|---|---|---|
| `DATABASE_URL_TEST is required` | متغیر در `.env` وجود ندارد. | آن را مطابق `.env.example` اضافه کنید. |
| `database "social_feed_test" does not exist` | volume پیش از اسکریپت init ساخته شده است. | پایگاه داده را دستی بسازید (پایین را ببینید) یا با `docker compose down -v` volume را حذف کنید (همه‌ی داده‌ها پاک می‌شوند). |
| `relation ... does not exist` در تست‌ها | migration روی پایگاه داده‌ی تست اعمال نشده است. | `npm run db:test:migrate` |

ساخت دستی پایگاه داده‌ی تست در container در حال اجرا:

```bash
docker compose exec postgres psql -U <POSTGRES_USER> -d <POSTGRES_DB> -c 'CREATE DATABASE social_feed_test;'
npm run db:test:migrate
```
