# ۰۹ - تست

## چرا سه لایه‌ی تست؟

| لایه | چه چیزی را اثبات می‌کند | چه چیزی را اثبات نمی‌کند |
|---|---|---|
| Unit Test | منطق خالص (codec، mapper، فیلتر) و تصمیم‌های Service با وابستگی‌های mock. سریع است و به زیرساخت نیاز ندارد. | رفتار واقعی PostgreSQL یا Redis، و سیم‌کشی DI |
| Integration Test | قیدهای واقعی PostgreSQL و اتمیک بودن اسکریپت Lua روی Redis واقعی | مسیر HTTP، Guardها و validation |
| E2E Test | کل زنجیره‌ی HTTP: `configureApp`، Guardها، Pipeها، Serviceها، پایگاه داده و Redis | جزئیات داخلی و حالت‌های مرزی که تولیدشان از بیرون دشوار است |

هر لایه چیزی را می‌آزماید که لایه‌های دیگر نمی‌توانند. مثلاً FK مرکب فقط با Integration Test قابل اثبات است، چون Unit Test با mock هرگز به پایگاه داده نمی‌رسد. اینکه `ValidationPipe` فیلد `authorId` را رد می‌کند هم فقط با E2E قابل اثبات است.

## پیکربندی‌های Vitest

| فایل | اسکریپت | include | setup | موازی‌سازی فایل‌ها | timeout |
|---|---|---|---|---|---|
| `vitest.config.ts` | `npm test` | `src/**/*.spec.ts` | - | پیش‌فرض Vitest | پیش‌فرض |
| `vitest.int.config.ts` | `npm run test:int` | `test/database/**/*.int-spec.ts` | `test/helpers/load-env.ts` | `fileParallelism: false` | ۲۰ ثانیه (تست و hook) |
| `vitest.e2e.config.ts` | `npm run test:e2e` | `test/e2e/**/*.e2e-spec.ts` | `test/helpers/load-env.ts` | `fileParallelism: false` | ۲۰ ثانیه (تست و hook) |

دلیل `fileParallelism: false`: تست‌های Integration و E2E پایگاه داده و Redis مشترک دارند. اجرای سریالی فایل‌ها از تداخل‌هایی مثل `TRUNCATE` یا `FLUSHDB` هم‌زمان جلوگیری می‌کند.

`vitest.config.ts` گزینه‌ی `passWithNoTests: true` دارد.

## تست‌های Unit

محل: کنار کد، در `src/**/*.spec.ts`. همه‌ی وابستگی‌ها با `vi.fn()` شبیه‌سازی می‌شوند و Serviceها مستقیماً با `new` ساخته می‌شوند (`prisma as never`).

| فایل | تعداد | سناریوها |
|---|---|---|
| `src/common/filters/all-exceptions.filter.spec.ts` | ۳ | `HttpException` با قالب واحد عبور می‌کند. `401` بدون پیام از عبارت استاندارد استفاده می‌کند. خطای ناشناخته به `500` با پیام پنهان تبدیل می‌شود. |
| `src/modules/auth/auth.service.spec.ts` | ۳ | برای ایمیل ناموجود هم `compare` با dummy hash اجرا می‌شود. رمز اشتباه همان خطا را می‌دهد. توکن با `{ sub }` صادر می‌شود و `passwordHash` در خروجی نیست. |
| `src/modules/comments/comments.service.spec.ts` | ۸ | ساخت کامنت سطح اول با invalidation. پست ناموجود `404` می‌دهد و invalidation انجام نمی‌شود. والد از پست دیگر `400` می‌دهد و `create` صدا زده نمی‌شود. والد ناموجود `404` می‌دهد. `findByAuthor` با `where: { authorId }`. فقط کامنت‌های سطح اول. فقط پاسخ‌های مستقیم. پاسخ‌های کامنتی خارج از این پست `404` می‌دهد. |
| `src/modules/posts/posts-feed.codec.spec.ts` | ۶ | بازسازی Date. پذیرش `latestComment: null`. رد JSON نامعتبر، شکل نادرست، تاریخ نامعتبر و `meta` ناقص (چهار مورد با `it.each`). |
| `src/modules/posts/posts.service.spec.ts` | ۸ | در HIT به پایگاه داده نمی‌رود. در MISS با همان generation ذخیره می‌کند. پس از `create` invalidation انجام می‌شود. `findByAuthor` با `skip: 10, take: 5` برای صفحه‌ی ۳. `404` برای پست ناموجود. `findThread` فقط کامنت‌های سطح اول را با `skip: 5, take: 5` می‌خواند و `meta` درست دارد. thread پست ناموجود `404` می‌دهد. `latestComment.text` به ۲۸۰ کاراکتر به‌همراه `…` کوتاه می‌شود. |
| `src/modules/comments/dto/create-comment.dto.spec.ts` | ۶ | با `ValidationPipe` واقعی: پذیرش `parentCommentId`. پذیرش `parent_comment_id` و نگاشت آن به `parentCommentId`. کامنت سطح اول بدون والد. پذیرش هر دو فیلد با مقدار برابر. رد مقدار متفاوت و UUID نامعتبر (`it.each`). |
| `src/common/utils/text.util.spec.ts` | ۳ | متن کوتاه بدون تغییر. برش در سقف با `…`. عدم شکستن surrogate pair در مرز برش. |
| `src/modules/users/users.mapper.spec.ts` | ۳ | ترکیب جدیدترین‌ها با برش به سقف. tie-break با `id` نزولی. excerpt حداکثر ۲۸۱ کاراکتر (۲۸۰ کاراکتر به‌همراه `…`). |
| `src/modules/users/users.service.spec.ts` | ۵ | `404` برای کاربر ناموجود. آمار درست و `take: 5` در هر دو query. واگذاری تاریخچه‌ی پست‌ها و کامنت‌ها. برای کاربر ناموجود `404` و عدم اجرای query تاریخچه. |

جمع: **۹ فایل و ۴۵ تست**.

## تست‌های Integration

محل: `test/database/`. این تست‌ها PostgreSQL و Redis واقعی لازم دارند.

### `test/database/schema.int-spec.ts` (۷ تست)

- یک `PrismaClient` مستقل با `PrismaPg` روی `DATABASE_URL_TEST` می‌سازد.
- **محافظ ایمنی:** اگر `DATABASE_URL_TEST` تعریف نشده باشد یا نام پایگاه داده با الگوی `/_test(\?|$)/` مطابقت نداشته باشد، خطا می‌دهد و تست اجرا نمی‌شود.
- پیش از هر تست: `TRUNCATE TABLE "comments", "posts", "users" CASCADE`.
- سناریوها در [پایگاه داده و Prisma](./06-database-prisma.md#تستهای-یکپارچگی-پایگاه-داده) فهرست شده‌اند.

### `test/database/rate-limit.int-spec.ts` (۴ تست)

- ماژول تستی شامل `ConfigModule.forRoot({ isGlobal: true, load: [configuration] })`، `RedisModule` و `RateLimitModule` است.
- پیش از ساخت ماژول، `POST_CREATE_RATE_LIMIT=10` و `POST_CREATE_RATE_WINDOW_SECONDS=60` در `process.env` تنظیم می‌شوند.
- پیش از هر تست `resetRedis()` اجرا می‌شود.
- سناریوها:
  1. `allows exactly 10 of 25 concurrent attempts in one window`
  2. `sets a TTL on the window key that never exceeds the window length` (مقدار کلید و TTL مستقیماً با `connectTestRedis()` خوانده می‌شوند)
  3. `counts users independently`
  4. `starts a fresh count in the next window`

جمع: **۲ فایل و ۱۱ تست**.

### تست هم‌زمانی rate limit

تست اول این فایل ۲۵ فراخوانی هم‌زمان با `Promise.all` و یک `now` ثابت اجرا می‌کند و انتظار دارد دقیقاً ۱۰ مورد مجاز و ۱۵ مورد رد شوند، هیچ‌کدام `degraded` نباشند و حداقل `remaining` برابر صفر باشد. این تست اتمیک بودن `INCR` و `EXPIRE` در Lua را روی Redis واقعی اثبات می‌کند. تحلیل کامل در [Redis](./07-redis-cache-rate-limit.md#تست-integration-همزمانی-و-آنچه-اثبات-میکند) آمده است.

## تست‌های E2E

محل: `test/e2e/`. هر فایل در `beforeAll` یک برنامه‌ی کامل با `createTestApp()` می‌سازد و در `afterAll` آن را با `closeTestApp` می‌بندد. درخواست‌ها با Supertest به `app.getHttpServer()` ارسال می‌شوند.

| فایل | تعداد | آنچه اثبات می‌کند |
|---|---|---|
| `auth.e2e-spec.ts` | ۴ | جریان کامل ثبت‌نام، ورود و `me`. ایمیل تکراری `409` می‌گیرد و فیلد `role` به دلیل `forbidNonWhitelisted` خطای `400`. ایمیل ناموجود و رمز اشتباه هر دو `401` با `message` یکسان می‌گیرند. `/me` بدون توکن `401` می‌دهد. |
| `comments.e2e-spec.ts` | ۴ | پاسخ با فیلد `parent_comment_id` ساخته می‌شود و `parentCommentId` درست برمی‌گردد. کامنت و پاسخ ساخته می‌شوند. لیست سطح اول یک مورد با `totalReplies: 1` دارد و لیست پاسخ‌ها یک مورد. پاسخ با والدی از پست دیگر `400` می‌گیرد. کامنت بدون توکن `401` می‌گیرد. |
| `health.e2e-spec.ts` | ۲ | liveness مقدار `{ status: 'ok' }` برمی‌گرداند. readiness در حالت سالم `details.database.status === 'up'` دارد. |
| `posts.e2e-spec.ts` | ۵ | پست ساخته می‌شود (`author.username` و `totalComments: 0`) و در فید دیده می‌شود. `GET /posts/:id` با `limit=1` دو صفحه کامنت سطح اول با نویسنده و `totalReplies` برمی‌گرداند و `totalComments` شامل پاسخ است. `authorId` در body خطای `400` می‌گیرد. شناسه‌ی ناموجود `404` می‌گیرد. تلاش یازدهم `429` با `Retry-After ≥ 1` می‌گیرد. |
| `users.e2e-spec.ts` | ۲ | پروفایل با `stats` برابر `{ totalPosts: 1, totalComments: 1 }` و دو فعالیت اخیر. `meta.totalItems` تاریخچه‌ی پست‌ها و کامنت‌ها هر کدام ۱ است. کاربر ناموجود `404` و UUID نامعتبر `400` می‌گیرد. |

جمع: **۵ فایل و ۱۷ تست**.

### چرا E2E از `configureApp` استفاده می‌کند؟

```ts
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, request };
}
```

`configureApp` همان تابعی است که `main.ts` صدا می‌زند. بنابراین پیشوند `/api/v1`، `ValidationPipe` با `whitelist` و `forbidNonWhitelisted`، `AllExceptionsFilter`، Helmet و CORS در تست دقیقاً مثل production هستند. اگر پیکربندی در تست تکرار می‌شد، ممکن بود تست‌ها چیزی متفاوت با production را بیازمایند.

## Helperهای تست

| Helper | رفتار |
|---|---|
| `load-env.ts` | `dotenv/config` را بارگذاری می‌کند و اگر متغیرهای تست تعریف شده باشند، `DATABASE_URL ← DATABASE_URL_TEST` و `REDIS_URL ← REDIS_URL_TEST` را تنظیم می‌کند. از طریق `setupFiles` پیش از تست‌های Integration و E2E اجرا می‌شود. |
| `test-app.ts` | `createTestApp()` و `closeTestApp(app)` |
| `factories.ts` | `createUser(app, password = 'SuperSecret1!')` با نام کاربری یکتای `user_<16 hex>` و ایمیل `<username>@example.com`. ثبت‌نام و ورود را انجام می‌دهد و در صورت شکست، با جزئیات پاسخ خطا پرتاب می‌کند. `auth(user)` هدر Bearer را می‌سازد. |
| `redis-reset.ts` | `resetRedis()` (`FLUSHDB`) و `connectTestRedis()`. هر دو بررسی می‌کنند که URL به `/15` ختم شود. |
| `db-reset.ts` | `resetDatabase(prisma)` با `TRUNCATE ... CASCADE`. **در حال حاضر هیچ تستی آن را import نمی‌کند.** |

## ایزوله‌سازی داده

### پایگاه داده‌ی تست

- برنامه در Integration و E2E به `DATABASE_URL_TEST` وصل می‌شود (از طریق `load-env.ts`).
- `schema.int-spec.ts` پیش از هر تست جدول‌ها را خالی می‌کند.
- **E2E پایگاه داده را خالی نمی‌کند.** ایزوله‌سازی با کاربران تصادفی و یکتا انجام می‌شود و assertionها طوری نوشته شده‌اند که به داده‌ی قبلی وابسته نباشند. مثلاً بررسی فید با `some(...)` انجام می‌شود و آمار پروفایل فقط مربوط به کاربر تازه‌ساخته است.

### Redis با DB منطقی تست

- `REDIS_URL_TEST` باید به DB منطقی ۱۵ اشاره کند (مثلاً `redis://localhost:6380/15`).
- `resetRedis` و `connectTestRedis` اگر URL به `/15` ختم نشود خطا می‌دهند. این محافظی است در برابر `FLUSHDB` تصادفی روی DB اصلی (DB 0).
- E2E Redis را خالی نمی‌کند. کلیدهای rate limit به ازای `userId` ساخته می‌شوند و هر تست کاربر تازه دارد. پس شمارنده‌ها تداخلی ندارند.

## اجرای تست‌ها

```bash
# Unit (بدون نیاز به Docker)
npm test

# Integration (PostgreSQL + Redis + migration روی پایگاه داده‌ی تست)
npm run test:int

# E2E
npm run test:e2e

# هر سه به ترتیب
npm run test:all

# همه‌ی بررسی‌ها: format، lint، typecheck، اعتبارسنجی Prisma و همه‌ی تست‌ها
npm run check
```

## پیش‌نیازها

برای Unit:
- `npm ci`
- `npm run prisma:generate` (چون Serviceها و DTOها از کلاینت تولیدشده import می‌کنند)

برای Integration و E2E، علاوه بر موارد بالا:
1. فایل `.env` با `DATABASE_URL_TEST` (نام پایگاه داده با پسوند `_test`) و `REDIS_URL_TEST` (DB منطقی `/15`)، و همه‌ی متغیرهای الزامی برنامه (`JWT_SECRET` و ...)
2. `docker compose up -d`
3. وجود پایگاه داده‌ی `social_feed_test`. این پایگاه داده را `docker/postgres/init-test-db.sql` فقط هنگام اولین مقداردهی volume می‌سازد.
4. `npm run db:test:migrate`
5. برای تست rate limit در E2E، مقدار `POST_CREATE_RATE_LIMIT` باید `10` باشد، چون عدد ۱۰ در `posts.e2e-spec.ts` ثابت نوشته شده است. مقدار پیش‌فرض و مقدار `.env.example` هر دو ۱۰ هستند.

## نکات ایمنی درباره‌ی URLهای تست

- `DATABASE_URL_TEST` **هرگز** نباید به پایگاه داده‌ی توسعه یا production اشاره کند. `schema.int-spec.ts` جدول‌ها را `TRUNCATE` می‌کند و فقط با پسوند `_test` اجرا می‌شود.
- محافظ پسوند `_test` فقط در `schema.int-spec.ts` وجود دارد. `load-env.ts` چنین بررسی‌ای ندارد و هر مقداری را که در `DATABASE_URL_TEST` باشد استفاده می‌کند.
- اگر `DATABASE_URL_TEST` یا `REDIS_URL_TEST` تعریف نشده باشند، `load-env.ts` چیزی را بازنویسی نمی‌کند و E2E از `DATABASE_URL` و `REDIS_URL` اصلی استفاده می‌کند. بنابراین تعریف این دو متغیر برای اجرای امن Integration و E2E ضروری است.

## نکته درباره‌ی `src/modules/rate-limit/rate-limit.int-spec.ts`

این فایل یک تست Integration دیگر برای `RateLimitService` است که `RedisService` را با یک config ساختگی مستقیماً می‌سازد. اما:

- `vitest.config.ts` فقط `*.spec.ts` را شامل می‌شود و این نام با `int-spec.ts` تمام می‌شود.
- `vitest.int.config.ts` فقط `test/database/**` را شامل می‌شود.

بنابراین **با هیچ‌کدام از اسکریپت‌های فعلی اجرا نمی‌شود** و در شمارش بالا لحاظ نشده است. پوشش رفتاری آن تقریباً با `test/database/rate-limit.int-spec.ts` یکسان است.

## CI

`.github/workflows/ci.yml` همه‌ی لایه‌ها را روی سرویس‌های `postgres:16-alpine` و `redis:7-alpine` اجرا می‌کند. در CI هر دو متغیر `DATABASE_URL` و `DATABASE_URL_TEST` به پایگاه داده‌ی `social_feed_test` اشاره دارند و `REDIS_URL_TEST` به DB منطقی ۱۵.

## خطاهای رایج و تشخیص

| نشانه | علت محتمل | راه‌حل |
|---|---|---|
| `Cannot find module '.../generated/prisma/client.js'` | کلاینت Prisma تولید نشده است. | `npm run prisma:generate` |
| `Invalid environment configuration: ...` در E2E | متغیر الزامی در `.env` وجود ندارد یا نامعتبر است. | `.env` را با `.env.example` مقایسه کنید. |
| `DATABASE_URL_TEST must point to a database whose name ends with _test` | نام پایگاه داده‌ی تست اشتباه است. | از نامی با پسوند `_test` استفاده کنید. |
| `REDIS_URL_TEST must use logical DB 15` | URL تست Redis به `/15` ختم نمی‌شود. | `REDIS_URL_TEST=redis://localhost:6380/15` |
| `relation "users" does not exist` | migration روی پایگاه داده‌ی تست اعمال نشده است. | `npm run db:test:migrate` |
| `database "social_feed_test" does not exist` | volume پیش از افزودن اسکریپت init ساخته شده است. | بخش عیب‌یابی در [پیکربندی و زیرساخت](./10-configuration-infrastructure.md) |
| `ECONNREFUSED` روی 5434 یا 6380 | containerها بالا نیستند. | `docker compose up -d` و `docker compose ps` |
| تست rate limit در E2E: انتظار `429` اما `201` | `POST_CREATE_RATE_LIMIT` مقداری غیر از ۱۰ دارد، یا حلقه‌ی ده‌تایی به‌طور اتفاقی از مرز پنجره‌ی ۶۰ ثانیه‌ای عبور کرده است (پنجره‌ها نسبت به epoch هم‌ترازند). | مقدار را بررسی کنید و تست را دوباره اجرا کنید. |
| `format:check` شکست می‌خورد | فایل‌ها با `.prettierrc` هم‌خوان نیستند. | `npm run format` و سپس بازبینی تغییرات |
