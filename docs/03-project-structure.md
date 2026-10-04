# ۰۳ - ساختار پروژه

این سند تک‌تک فایل‌ها و پوشه‌های معنادار مخزن را توضیح می‌دهد: مسیر دقیق، هدف، وابستگی‌ها، نکات پیاده‌سازی و ارتباط با بقیه‌ی سیستم.

## درخت پروژه

درخت زیر بر اساس فایل‌های واقعی مخزن است. پوشه‌های `node_modules/`، `.git/`، `dist/` و `src/generated/` عمداً حذف شده‌اند. دلیل حذف هر کدام در انتهای همین سند آمده است.

```text
social-feed-api/
├── .github/
│   └── workflows/
│       └── ci.yml
├── docker/
│   └── postgres/
│       └── init-test-db.sql
├── docs/
├── prisma/
│   ├── migrations/
│   │   ├── 20261003210745_init/
│   │   │   └── migration.sql
│   │   ├── 20261003211038_add_checks_and_partial_indexes/
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   └── schema.prisma
├── src/
│   ├── main.ts
│   ├── configure-app.ts
│   ├── app.module.ts
│   ├── config/
│   │   ├── config.types.ts
│   │   ├── configuration.ts
│   │   ├── env.validation.ts
│   │   └── index.ts
│   ├── common/
│   │   ├── decorators/
│   │   │   └── current-user.decorator.ts
│   │   ├── dto/
│   │   │   └── pagination-query.dto.ts
│   │   ├── filters/
│   │   │   ├── all-exceptions.filter.ts
│   │   │   └── all-exceptions.filter.spec.ts
│   │   ├── interfaces/
│   │   │   ├── authenticated-user.interface.ts
│   │   │   └── paginated-response.interface.ts
│   │   └── utils/
│   │       └── pagination.util.ts
│   ├── infrastructure/
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts
│   │   │   └── prisma.service.ts
│   │   └── redis/
│   │       ├── redis.module.ts
│   │       └── redis.service.ts
│   └── modules/
│       ├── auth/
│       │   ├── auth.controller.ts
│       │   ├── auth.module.ts
│       │   ├── auth.select.ts
│       │   ├── auth.service.ts
│       │   ├── auth.service.spec.ts
│       │   ├── password-hasher.ts
│       │   ├── dto/
│       │   │   ├── login.dto.ts
│       │   │   └── register.dto.ts
│       │   ├── guards/
│       │   │   └── jwt-auth.guard.ts
│       │   └── strategies/
│       │       └── jwt.strategy.ts
│       ├── posts/
│       │   ├── posts.controller.ts
│       │   ├── posts.module.ts
│       │   ├── posts.service.ts
│       │   ├── posts.service.spec.ts
│       │   ├── posts.select.ts
│       │   ├── posts.mapper.ts
│       │   ├── posts-feed.codec.spec.ts
│       │   ├── cache/
│       │   │   ├── posts-feed.cache.ts
│       │   │   └── posts-feed.codec.ts
│       │   ├── dto/
│       │   │   └── create-post.dto.ts
│       │   └── guards/
│       │       └── post-create-rate-limit.guard.ts
│       ├── comments/
│       │   ├── comments.controller.ts
│       │   ├── comments.module.ts
│       │   ├── comments.service.ts
│       │   ├── comments.service.spec.ts
│       │   ├── comments.select.ts
│       │   ├── comments.mapper.ts
│       │   └── dto/
│       │       └── create-comment.dto.ts
│       ├── users/
│       │   ├── users.controller.ts
│       │   ├── users.module.ts
│       │   ├── users.service.ts
│       │   ├── users.service.spec.ts
│       │   ├── users.select.ts
│       │   ├── users.mapper.ts
│       │   └── users.mapper.spec.ts
│       ├── rate-limit/
│       │   ├── rate-limit.module.ts
│       │   ├── rate-limit.service.ts
│       │   ├── rate-limit.int-spec.ts
│       │   └── lua/
│       │       └── consume-attempt.lua.ts
│       └── health/
│           ├── health.controller.ts
│           ├── health.module.ts
│           └── prisma.health-indicator.ts
├── test/
│   ├── database/
│   │   ├── rate-limit.int-spec.ts
│   │   └── schema.int-spec.ts
│   ├── e2e/
│   │   ├── auth.e2e-spec.ts
│   │   ├── comments.e2e-spec.ts
│   │   ├── health.e2e-spec.ts
│   │   ├── posts.e2e-spec.ts
│   │   └── users.e2e-spec.ts
│   └── helpers/
│       ├── db-reset.ts
│       ├── factories.ts
│       ├── load-env.ts
│       ├── redis-reset.ts
│       └── test-app.ts
├── .env                    (محلی، در .gitignore)
├── .env.example
├── .gitignore
├── .nvmrc
├── .prettierrc
├── docker-compose.yml
├── nest-cli.json
├── package.json
├── package-lock.json
├── prisma7.config.ts
├── README.md
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── vitest.int.config.ts
└── vitest.e2e.config.ts
```

---

## ۱. فایل‌های ریشه‌ی پروژه

| فایل | مسئولیت | وابسته به | نکات مهم |
|---|---|---|---|
| `package.json` | تعریف پکیج، اسکریپت‌ها و وابستگی‌ها | npm | `"type": "module"` (ESM)، `engines.node: ">=22"`، `private: true`. همه‌ی اسکریپت‌های Prisma با `--config prisma7.config.ts` اجرا می‌شوند. |
| `package-lock.json` | قفل دقیق نسخه‌ی وابستگی‌ها | npm | در CI با `npm ci` استفاده می‌شود. |
| `.nvmrc` | نسخه‌ی Node | nvm، `actions/setup-node` | مقدار `22`. در CI با `node-version-file: .nvmrc` خوانده می‌شود. |
| `.env.example` | الگوی متغیرهای محیطی با مقادیر نمونه | - | شامل متغیرهای برنامه، Docker Compose و تست است. مقادیر رمزی آن placeholder هستند. |
| `.env` | مقادیر محلی واقعی | ConfigModule، dotenv، Docker Compose | در `.gitignore` است و نباید commit شود. |
| `.gitignore` | فایل‌های خارج از کنترل نسخه | git | `node_modules/`، `dist/`، `src/generated/`، `.env`، `.env.*` (به‌جز `!.env.example`)، `*.log`، `coverage/`، `.DS_Store` |
| `.prettierrc` | قواعد فرمت | Prettier | `singleQuote: true`، `trailingComma: "all"`، `printWidth: 100` |
| `tsconfig.json` | پیکربندی پایه‌ی TypeScript برای typecheck و ابزارها | TypeScript | `module`/`moduleResolution: nodenext`، `target: ES2023`، `strict: true`، `noImplicitOverride`، `noFallthroughCasesInSwitch`، `experimentalDecorators`، `emitDecoratorMetadata`. شامل `src`، `test`، `prisma7.config.ts` و سه فایل vitest است. |
| `tsconfig.build.json` | پیکربندی build تولیدی | `nest build` | `extends: ./tsconfig.json`، `rootDir: ./src`، `outDir: ./dist`. فقط `src` را شامل می‌شود و `test` و `src/**/*.spec.ts` را حذف می‌کند. |
| `nest-cli.json` | پیکربندی Nest CLI | `@nestjs/cli` | `sourceRoot: src`، `deleteOutDir: true` (پوشه‌ی `dist` قبل از هر build پاک می‌شود)، `tsConfigPath: tsconfig.build.json` |
| `prisma7.config.ts` | پیکربندی Prisma 7 | `prisma/config`، `dotenv/config` | مسیر schema و migrationها را تعیین می‌کند و `datasource.url` را از `process.env.DATABASE_URL` می‌خواند. |
| `docker-compose.yml` | سرویس‌های زیرساخت محلی | Docker Compose | فقط `postgres` و `redis`. خود برنامه سرویس Compose ندارد. |
| `vitest.config.ts` | پیکربندی Unit Test | Vitest | `include: ['src/**/*.spec.ts']`، `passWithNoTests: true` |
| `vitest.int.config.ts` | پیکربندی Integration Test | Vitest | `include: ['test/database/**/*.int-spec.ts']`، `setupFiles: ['test/helpers/load-env.ts']`، `fileParallelism: false`، timeoutها ۲۰ ثانیه |
| `vitest.e2e.config.ts` | پیکربندی E2E Test | Vitest | `include: ['test/e2e/**/*.e2e-spec.ts']`، همان setup و timeoutهای Integration |
| `README.md` | معرفی پروژه به فارسی | - | سند مستقل در ریشه‌ی مخزن |

### اسکریپت‌های `package.json`

| اسکریپت | دستور |
|---|---|
| `build` | `nest build` |
| `start` | `nest start` |
| `start:dev` | `nest start --watch` |
| `start:prod` | `node dist/main.js` |
| `lint` | `oxlint --type-aware --deny-warnings src test` |
| `format` | `prettier --write .` |
| `format:check` | `prettier --check .` |
| `typecheck` | `tsc --noEmit` |
| `test` | `vitest run` |
| `test:int` | `vitest run --config vitest.int.config.ts` |
| `test:e2e` | `vitest run --config vitest.e2e.config.ts` |
| `test:all` | `npm run test && npm run test:int && npm run test:e2e` |
| `prisma:generate` | `prisma generate --config prisma7.config.ts` |
| `prisma:validate` | `prisma validate --config prisma7.config.ts` |
| `prisma:migrate:dev` | `prisma migrate dev --config prisma7.config.ts` |
| `prisma:migrate:deploy` | `prisma migrate deploy --config prisma7.config.ts` |
| `prisma:studio` | `prisma studio --config prisma7.config.ts` |
| `db:test:migrate` | فایل `.env` را بارگذاری می‌کند، `DATABASE_URL` را با `DATABASE_URL_TEST` جایگزین می‌کند (اگر نباشد خطا می‌دهد) و `prisma migrate deploy` را اجرا می‌کند |
| `check` | `format:check` ← `lint` ← `typecheck` ← `prisma:validate` ← `test:all` |

---

## ۲. پوشه‌ی `.github/`

| فایل | مسئولیت | نکات مهم |
|---|---|---|
| `.github/workflows/ci.yml` | pipeline با GitHub Actions | روی push به `main` و روی هر pull request اجرا می‌شود. سرویس‌های `postgres:16-alpine` و `redis:7-alpine` را بالا می‌آورد. مراحل: `npm ci` ← `prisma:generate` ← `prisma:validate` ← `db:test:migrate` ← `format:check` ← `lint` ← `typecheck` ← `npm test` ← `test:int` ← `test:e2e` ← `build`. متغیرهای آن فقط مقادیر تستی برای containerهای یک‌بارمصرف‌اند و به GitHub Secrets نیازی ندارد. |

---

## ۳. پوشه‌ی `docker/`

| فایل | مسئولیت | نکات مهم |
|---|---|---|
| `docker/postgres/init-test-db.sql` | ساخت پایگاه داده‌ی تست | فقط شامل `CREATE DATABASE social_feed_test;` است. در `docker-compose.yml` به `/docker-entrypoint-initdb.d/` mount می‌شود. image رسمی PostgreSQL این اسکریپت‌ها را **فقط در اولین مقداردهی یک volume خالی** اجرا می‌کند. |

---

## ۴. پوشه‌ی `prisma/`

| فایل | مسئولیت | نکات مهم |
|---|---|---|
| `prisma/schema.prisma` | تعریف مدل‌ها، enum، روابط و indexها | generator از نوع `prisma-client` با `output = "../src/generated/prisma"`. در `datasource db` آدرس اتصال تعریف نشده و از `prisma7.config.ts` می‌آید. مدل‌ها: `User`، `Post`، `Comment`. enum: `ContentType`. |
| `prisma/migrations/20261003210745_init/migration.sql` | migration اولیه | ساخت enum `content_type`، جدول‌های `users`، `posts` و `comments`، indexهای unique و مرکب، و foreign keyها (از جمله FK مرکب پاسخ‌ها) |
| `prisma/migrations/20261003211038_add_checks_and_partial_indexes/migration.sql` | migration دستی | constraintهای `CHECK` (حروف کوچک، خالی نبودن، والدِ خود نبودن) و دو index جزئی (partial) برای کامنت‌های سطح اول و پاسخ‌ها |
| `prisma/migrations/migration_lock.toml` | قفل provider | `provider = "postgresql"`. نباید دستی ویرایش شود. |

جزئیات کامل در [پایگاه داده و Prisma](./06-database-prisma.md).

---

## ۵. Bootstrap برنامه (`src/`)

| فایل | مسئولیت | وابسته به | نکات مهم |
|---|---|---|---|
| `src/main.ts` | نقطه‌ی ورود اجرایی | `NestFactory`، `AppModule`، `configureApp`، `ConfigService` | با `abortOnError: false` ساخته می‌شود تا خطای bootstrap به `catch` برسد. سپس پیام خطا لاگ و `process.exit(1)` اجرا می‌شود. پس از بالا آمدن، پیام `API listening on http://localhost:<port>/api/v1` لاگ می‌شود. |
| `src/configure-app.ts` | پیکربندی سراسری HTTP | `helmet`، `ValidationPipe`، `VersioningType`، `AllExceptionsFilter`، `ConfigService` | به‌ترتیب: `helmet()`، `setGlobalPrefix('api')`، `enableVersioning({ type: URI, defaultVersion: '1' })`، `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`، `AllExceptionsFilter`، CORS شرطی و `enableShutdownHooks()`. در E2E هم استفاده می‌شود. |
| `src/app.module.ts` | ماژول ریشه | همه‌ی ماژول‌ها | `ConfigModule.forRoot({ isGlobal: true, cache: true, load: [configuration] })`. خود `AppModule` هیچ provider یا controllerی ندارد. |

---

## ۶. پیکربندی (`src/config/`)

| فایل | مسئولیت | نکات مهم |
|---|---|---|
| `config.types.ts` | interface `AppConfig` | کلیدها: `nodeEnv`، `port`، `corsOrigin`، `database.url`، `redis.url`، `jwt.secret`، `jwt.expiresInSeconds`، `feedCache.ttlSeconds`، `postCreateRateLimit.limit`، `postCreateRateLimit.windowSeconds` |
| `env.validation.ts` | اعتبارسنجی متغیرهای محیطی | کلاس `EnvironmentVariables` با decoratorهای class-validator و مقادیر پیش‌فرض، enum `NodeEnv` و تابع `validateEnv`. تبدیل با `plainToInstance` و گزینه‌های `enableImplicitConversion` و `exposeDefaultValues` انجام می‌شود و اعتبارسنجی با `validateSync`. در صورت خطا، پیام فهرست‌وار `Invalid environment configuration` پرتاب می‌شود. |
| `configuration.ts` | factory پیکربندی | `validateEnv(process.env)` را اجرا و آن را به `AppConfig` تبدیل می‌کند. |
| `index.ts` | barrel export | `configuration`، type `AppConfig`، `validateEnv`، `EnvironmentVariables` و `NodeEnv` را export می‌کند. |

نکته: `nodeEnv` در `AppConfig` مقداردهی می‌شود، اما در کد فعلی هیچ مصرف‌کننده‌ای در `src` ندارد.

---

## ۷. اجزای مشترک (`src/common/`)

| فایل | مسئولیت | استفاده‌شده در | نکات مهم |
|---|---|---|---|
| `decorators/current-user.decorator.ts` | decorator پارامتری `@CurrentUser()` | Controllerهای auth، posts و comments | `request.user` را برمی‌گرداند. اگر روی مسیری بدون `JwtAuthGuard` استفاده شود (یعنی `user` تنظیم نشده باشد)، یک `Error` ساده پرتاب می‌کند که توسط فیلتر به `500` تبدیل می‌شود. |
| `dto/pagination-query.dto.ts` | DTO صفحه‌بندی | فید، کامنت‌ها، تاریخچه‌ی کاربر | `page`: عدد صحیح ≥ 1، پیش‌فرض `1`. `limit`: عدد صحیح بین 1 و 100، پیش‌فرض `20`. تبدیل رشته‌ی query به عدد با `@Type(() => Number)` انجام می‌شود. |
| `filters/all-exceptions.filter.ts` | فیلتر سراسری خطا | `configureApp` | interface `ErrorResponseBody` و کلاس `AllExceptionsFilter`. پیام خطاهای ۵xx پنهان می‌شود و فقط این خطاها لاگ می‌شوند. فیلد `error` از `STATUS_CODES` ماژول `node:http` گرفته می‌شود. |
| `filters/all-exceptions.filter.spec.ts` | Unit Test فیلتر | Vitest | سه سناریو (بخش تست را ببینید). |
| `interfaces/authenticated-user.interface.ts` | نوع `AuthenticatedUser` | Guard، decorator، Controllerها | `id`، `username`، `email`، `createdAt` |
| `interfaces/paginated-response.interface.ts` | نوع‌های `PaginationMeta` و `Paginated<T>` | همه‌ی لیست‌ها، codec فید | `meta`: `currentPage`، `itemsPerPage`، `totalItems`، `totalPages` |
| `utils/pagination.util.ts` | محاسبات صفحه‌بندی | Serviceها | `toSkipTake(page, limit)` مقدار `{ skip: (page - 1) * limit, take: limit }` را برمی‌گرداند. `buildMeta` مقدار `totalPages` را با `Math.ceil(totalItems / limit)` حساب می‌کند. |

---

## ۸. زیرساخت (`src/infrastructure/`)

### Prisma

| فایل | مسئولیت | نکات مهم |
|---|---|---|
| `prisma/prisma.module.ts` | ماژول `@Global()` | `PrismaService` را provide و export می‌کند. |
| `prisma/prisma.service.ts` | کلاینت پایگاه داده | `extends PrismaClient`. سازنده آدرس را از `config.get('database')` می‌گیرد و `PrismaPg` می‌سازد. در `onModuleInit` تابع `$connect()` و لاگ `Database connection established` اجرا می‌شود و در `onModuleDestroy` تابع `$disconnect()`. |

### Redis

| فایل | مسئولیت | نکات مهم |
|---|---|---|
| `redis/redis.module.ts` | ماژول `@Global()` | `RedisService` را provide و export می‌کند. |
| `redis/redis.service.ts` | wrapper ایمن ioredis | گزینه‌ها: `lazyConnect: true`، `connectTimeout: 2000`، `commandTimeout: 1000`، `maxRetriesPerRequest: 1`، `enableOfflineQueue: false`. رویداد `error` تا رویداد بعدی `ready` فقط یک بار لاگ می‌شود. اگر اتصال در `onModuleInit` شکست بخورد، فقط هشدار لاگ می‌شود و برنامه متوقف نمی‌شود. همه‌ی عملیات از `safe()` عبور می‌کنند که هر عملیات ناموفق را با سطح warn لاگ می‌کند و `null` برمی‌گرداند. |

---

## ۹. ماژول‌های feature (`src/modules/`)

### ۹.۱ ماژول Auth (`src/modules/auth/`)

| فایل | مسئولیت | وابسته به | نکات مهم |
|---|---|---|---|
| `auth.module.ts` | تعریف ماژول | `PassportModule`، `JwtModule.registerAsync` | `secret` و `signOptions.expiresIn` از `config.get('jwt')` خوانده می‌شوند. هیچ چیزی export نمی‌شود. |
| `auth.controller.ts` | مسیرهای `auth` | `AuthService`، `JwtAuthGuard`، `@CurrentUser` | `POST register`، `POST login` (با `@HttpCode(200)`) و `GET me` (محافظت‌شده) |
| `auth.service.ts` | منطق ثبت‌نام و ورود | `PrismaService`، `PasswordHasher`، `JwtService`، `ConfigService` | interface `LoginResult`. ورود با dummy hash انجام می‌شود. خطای `P2002` به پیام‌های `409` تبدیل می‌شود. payload توکن فقط `{ sub: user.id }` است. |
| `auth.select.ts` | `publicUserSelect` | Prisma types | `id`، `username`، `email`، `createdAt`، با `satisfies Prisma.UserSelect` |
| `password-hasher.ts` | wrapper برای bcrypt | `bcrypt` | `BCRYPT_COST = 10`. dummy hash یک بار هنگام ساخت کلاس محاسبه و به‌صورت Promise نگه‌داری می‌شود. |
| `dto/register.dto.ts` | DTO ثبت‌نام | class-validator/transformer | `username` و `email` با `trim` و `toLowerCase` نرمال می‌شوند. `password` بین ۸ تا ۷۲ بایت است. |
| `dto/login.dto.ts` | DTO ورود | class-validator/transformer | `email` با `trim` و `toLowerCase` نرمال می‌شود. `password` بین ۱ تا ۷۲ بایت است. |
| `guards/jwt-auth.guard.ts` | Guard توکن | `@nestjs/passport` | فقط `extends AuthGuard('jwt')` است. فایلی عمداً یک‌خطی. |
| `strategies/jwt.strategy.ts` | استراتژی passport-jwt | `PrismaService`، `ConfigService` | توکن از هدر Bearer استخراج می‌شود. `ignoreExpiration: false` و `algorithms: ['HS256']`. در `validate` بررسی می‌شود که `sub` یک UUID نسخه‌ی ۴ باشد و کاربر با `publicUserSelect` از پایگاه داده خوانده می‌شود. |
| `auth.service.spec.ts` | Unit Test | Vitest | سه سناریو برای `login` |

### ۹.۲ ماژول Posts (`src/modules/posts/`)

| فایل | مسئولیت | وابسته به | نکات مهم |
|---|---|---|---|
| `posts.module.ts` | تعریف ماژول | `RateLimitModule` | providerها: `PostsService`، `PostsFeedCache`، `PostCreateRateLimitGuard`. فقط `PostsService` export می‌شود. |
| `posts.controller.ts` | مسیرهای `posts` | `PostsService`، Guardها | `POST /` با `JwtAuthGuard` و سپس `PostCreateRateLimitGuard`، `GET /` برای فید و `GET /:id` با `ParseUUIDPipe` نسخه‌ی ۴ |
| `posts.service.ts` | منطق پست | `PrismaService`، `PostsFeedCache` | متدهای `create` (ساخت و سپس `invalidate`)، `findFeed` (cache-aside)، `findByAuthor`، `findById` (`404` با پیام `Post not found`) و `invalidateFeedCache` |
| `posts.select.ts` | `postReadSelect` | Prisma types | author (`id`، `username`)، آخرین کامنت (`take: 1` با مرتب‌سازی `createdAt desc, id desc`) و `_count.comments` |
| `posts.mapper.ts` | `toPostResponse` و انواع پاسخ | Prisma types | interfaceهای `AuthorSummary`، `LatestComment` و `PostResponse` |
| `cache/posts-feed.cache.ts` | مدیریت cache فید | `RedisService`، `ConfigService`، codec | کلید generation، کلید صفحه، متدهای `get`، `set` و `invalidate` |
| `cache/posts-feed.codec.ts` | پارس امن payload | انواع mapper | `parseFeedPage(raw)`: پارس JSON، بررسی شکل و بازسازی `Date`. در صورت هر ناسازگاری `null` برمی‌گرداند. |
| `dto/create-post.dto.ts` | DTO ساخت پست | enum `ContentType` از کلاینت تولیدشده | `contentType` اختیاری با پیش‌فرض `text`. `content` با `trim`، غیرخالی و حداکثر ۵۰۰۰ کاراکتر. `caption` اختیاری با `trim` و طول ۱ تا ۵۰۰. |
| `guards/post-create-rate-limit.guard.ts` | Guard سهمیه | `RateLimitService` | اگر `request.user` نباشد `401` برمی‌گرداند. در حالت degraded هدرها تنظیم نمی‌شوند. در صورت رد شدن، `Retry-After` و `429` برمی‌گرداند. |
| `posts.service.spec.ts` | Unit Test سرویس | Vitest | پنج سناریو |
| `posts-feed.codec.spec.ts` | Unit Test codec | Vitest | در ریشه‌ی ماژول posts قرار دارد و codec را از `./cache/posts-feed.codec.js` import می‌کند. |

### ۹.۳ ماژول Comments (`src/modules/comments/`)

| فایل | مسئولیت | وابسته به | نکات مهم |
|---|---|---|---|
| `comments.module.ts` | تعریف ماژول | `PostsModule` | `CommentsService` را export می‌کند تا `UsersModule` بتواند از آن استفاده کند. |
| `comments.controller.ts` | مسیرهای `posts/:postId/comments` | `CommentsService`، `JwtAuthGuard` | `POST /` (محافظت‌شده)، `GET /` (کامنت‌های سطح اول) و `GET /:commentId/replies`. همه‌ی پارامترهای مسیر با `ParseUUIDPipe` نسخه‌ی ۴ بررسی می‌شوند. |
| `comments.service.ts` | منطق کامنت | `PrismaService`، `PostsService` | `create`، `findByAuthor`، `findTopLevel` و `findReplies`، به‌همراه متدهای کمکی خصوصی `paginate`، `ensurePostExists` و `ensureParentBelongsToPost` |
| `comments.select.ts` | `commentReadSelect` | Prisma types | `id`، `postId`، `parentCommentId`، `text`، `createdAt`، author و `_count.replies` |
| `comments.mapper.ts` | `toCommentResponse` | Prisma types | interface `CommentResponse` با فیلد `totalReplies` |
| `dto/create-comment.dto.ts` | DTO کامنت | class-validator/transformer | `text` با `trim`، غیرخالی و حداکثر ۲۰۰۰ کاراکتر. `parentCommentId` اختیاری و UUID نسخه‌ی ۴. |
| `comments.service.spec.ts` | Unit Test | Vitest | هشت سناریو |

### ۹.۴ ماژول Users (`src/modules/users/`)

| فایل | مسئولیت | وابسته به | نکات مهم |
|---|---|---|---|
| `users.module.ts` | تعریف ماژول | `PostsModule`، `CommentsModule` | هیچ چیزی export نمی‌کند. |
| `users.controller.ts` | مسیرهای `users/:userId/*` | `UsersService` | `profile`، `posts` و `comments`. همه عمومی‌اند و `userId` با `ParseUUIDPipe` نسخه‌ی ۴ بررسی می‌شود. |
| `users.service.ts` | منطق پروفایل و تاریخچه | `PrismaService`، `PostsService`، `CommentsService` | `getProfile` با سه query موازی از طریق `Promise.all`. `getPosts` و `getComments` ابتدا `ensureUserExists` را اجرا می‌کنند و سپس کار را واگذار می‌کنند. |
| `users.select.ts` | selectهای پروفایل | Prisma types | `profileUserSelect` (بدون `email`) شامل `_count.posts` و `_count.comments`. `recentPostSelect` و `recentCommentSelect`. |
| `users.mapper.ts` | `toUserProfile` و `mergeRecentActivity` | Prisma types | `RECENT_ACTIVITY_LIMIT = 5` و `EXCERPT_LENGTH = 280`. ترکیب فعالیت‌ها با مرتب‌سازی `createdAt` نزولی و در صورت برابری، `id` نزولی. |
| `users.service.spec.ts` | Unit Test سرویس | Vitest | پنج سناریو |
| `users.mapper.spec.ts` | Unit Test mapper | Vitest | سه سناریو |

### ۹.۵ ماژول Rate Limit (`src/modules/rate-limit/`)

| فایل | مسئولیت | نکات مهم |
|---|---|---|
| `rate-limit.module.ts` | تعریف ماژول | `RateLimitService` را provide و export می‌کند. به `RedisService` و `ConfigService` سراسری وابسته است. |
| `rate-limit.service.ts` | محاسبه‌ی پنجره‌ی ثابت | interface `RateLimitDecision` با فیلدهای `allowed`، `limit`، `remaining`، `retryAfterSeconds` و `degraded`. پیشوند کلید `ratelimit:posts:create:v1`. متد `consumePostCreateAttempt(userId, nowMs = Date.now())`. |
| `lua/consume-attempt.lua.ts` | اسکریپت Lua | ثابت `CONSUME_ATTEMPT_SCRIPT`: ابتدا `INCR` و فقط در اولین افزایش، `EXPIRE` |
| `rate-limit.int-spec.ts` | تست Integration دوم برای Rate Limit | **توجه:** این فایل در هیچ‌کدام از سه پیکربندی Vitest قرار نمی‌گیرد، چون `vitest.config.ts` فقط `*.spec.ts` و `vitest.int.config.ts` فقط `test/database/**` را شامل می‌شود. بنابراین با اسکریپت‌های فعلی اجرا نمی‌شود. چون `tsconfig.build.json` فقط `src/**/*.spec.ts` را حذف می‌کند، این فایل در build کامپایل می‌شود و به `dist/modules/rate-limit/` می‌رود. |

### ۹.۶ ماژول Health (`src/modules/health/`)

| فایل | مسئولیت | نکات مهم |
|---|---|---|
| `health.module.ts` | تعریف ماژول | `TerminusModule` را import می‌کند و `PrismaHealthIndicator` را provide. |
| `health.controller.ts` | مسیرهای `health` | `GET /` همیشه `{ status: 'ok' }` برمی‌گرداند. `GET /ready` با `@HealthCheck()` و `health.check([...database])`. |
| `prisma.health-indicator.ts` | بررسی پایگاه داده | `SELECT 1` در رقابت با timeout برابر ۱۵۰۰ میلی‌ثانیه اجرا می‌شود. نتیجه `up` یا `down` با پیام `Database is unreachable` است. |

### فایل‌هایی که عمداً کوچک هستند

| فایل | دلیل |
|---|---|
| `jwt-auth.guard.ts` | تمام منطق در `AuthGuard('jwt')` و `JwtStrategy` است. این کلاس فقط یک نام قابل تزریق و قابل import فراهم می‌کند. |
| `prisma.module.ts` و `redis.module.ts` | فقط مرز DI و سراسری‌سازی |
| `rate-limit.module.ts` | فقط بسته‌بندی `RateLimitService` برای import در `PostsModule` |
| `*.select.ts` | فقط داده‌ی ثابت (شیء select)، تا بتوان نوع ردیف را از آن مشتق کرد |
| `consume-attempt.lua.ts` | فقط یک ثابت رشته‌ای حاوی اسکریپت Lua |
| `config/index.ts` | فقط barrel export |
| Controllerها | به دلیل اصل Controller نازک |

---

## ۱۰. پوشه‌ی `test/`

### `test/database/` (Integration)

| فایل | هدف |
|---|---|
| `rate-limit.int-spec.ts` | `RateLimitService` را از طریق `Test.createTestingModule` با `ConfigModule`، `RedisModule` و `RateLimitModule` روی Redis واقعی (DB منطقی ۱۵) تست می‌کند. پیش از هر تست `resetRedis()` اجرا می‌شود. |
| `schema.int-spec.ts` | constraintهای PostgreSQL را با یک `PrismaClient` مستقل روی `DATABASE_URL_TEST` تست می‌کند. پیش از هر تست جدول‌ها را `TRUNCATE` می‌کند. اگر نام پایگاه داده به `_test` ختم نشود، تست اجرا نمی‌شود. |

### `test/e2e/` (End-to-End)

| فایل | هدف |
|---|---|
| `auth.e2e-spec.ts` | ثبت‌نام، ورود، `me`، تکراری بودن ایمیل، فیلد ناشناخته و یکسان بودن پیام `401` |
| `comments.e2e-spec.ts` | کامنت و پاسخ، جدا بودن لیست‌ها، رد پاسخ بین‌پستی و لزوم داشتن توکن |
| `health.e2e-spec.ts` | liveness و readiness |
| `posts.e2e-spec.ts` | ساخت پست و حضور آن در فید، رد `authorId` در body، `404` و rate limit با `429` |
| `users.e2e-spec.ts` | پروفایل، آمار، تاریخچه، `404` و `400` |

### `test/helpers/`

| فایل | مسئولیت | نکات مهم |
|---|---|---|
| `load-env.ts` | فایل setup برای Integration و E2E | `dotenv/config` را بارگذاری می‌کند و اگر `DATABASE_URL_TEST` و `REDIS_URL_TEST` تعریف شده باشند، `DATABASE_URL` و `REDIS_URL` را با آن‌ها بازنویسی می‌کند تا برنامه‌ی تستی به منابع development وصل نشود. |
| `test-app.ts` | ساخت برنامه‌ی تستی | `Test.createTestingModule({ imports: [AppModule] })`، سپس `configureApp(app)` و `app.init()`. type `TestApp` و تابع `closeTestApp`. |
| `factories.ts` | ساخت کاربر تستی | `createUser(app)` یک کاربر با نام یکتا (`user_<16 کاراکتر از randomUUID>`) ثبت‌نام و وارد می‌کند. `auth(user)` هدر `Authorization` را می‌سازد. |
| `redis-reset.ts` | ابزار Redis تست | `connectTestRedis()` و `resetRedis()` (با `FLUSHDB`). هر دو بررسی می‌کنند که URL به `/15` ختم شود. |
| `db-reset.ts` | ابزار پایگاه داده‌ی تست | `resetDatabase(prisma)` جدول‌ها را با `TRUNCATE ... CASCADE` خالی می‌کند. **در حال حاضر هیچ تستی از آن استفاده نمی‌کند.** |

---

## ۱۱. خروجی تولیدشده‌ی Prisma (`src/generated/prisma/`)

- محل تولید با `output = "../src/generated/prisma"` در `schema.prisma` تعیین شده است.
- این پوشه در `.gitignore` قرار دارد (`src/generated/`)، پس **commit نمی‌شود** و باید بعد از هر `npm ci` یا تغییر schema با `npm run prisma:generate` دوباره تولید شود.
- اسکریپت `postinstall` در `package.json` وجود ندارد. در CI هم تولید کلاینت یک مرحله‌ی جداگانه است.
- کد برنامه از `../../generated/prisma/client.js` import می‌کند. نمونه‌ها: `PrismaClient` و `Prisma` و enum `ContentType`.
- چون این پوشه داخل `src` است، `nest build` آن را هم کامپایل می‌کند و به `dist/generated/prisma` می‌برد.

## ۱۲. پوشه‌هایی که در درخت نیامده‌اند

| پوشه | دلیل حذف |
|---|---|
| `node_modules/` | وابستگی‌های نصب‌شده، در `.gitignore` |
| `.git/` | متادیتای کنترل نسخه |
| `dist/` | خروجی build، در `.gitignore`. با `nest build` و `deleteOutDir: true` از نو ساخته می‌شود. |
| `src/generated/` | کلاینت تولیدشده‌ی Prisma، در `.gitignore` |
| `coverage/` | در `.gitignore` آمده، اما در پیکربندی فعلی Vitest گزارش coverage فعال نشده است. |
