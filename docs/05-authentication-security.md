# ۰۵ - احراز هویت و امنیت

این سند همه‌ی سازوکارهای امنیتی را که در کد تأیید شده‌اند فهرست می‌کند. برای هر مورد سه چیز آمده است: تهدیدی که پوشش می‌دهد، نحوه‌ی پیاده‌سازی، و محدودیت‌های باقی‌مانده. هدف این سند بزرگ‌نمایی نیست. این پروژه یک API آموزشی و نمونه‌کار با رویکرد production-minded است، نه سیستمی که ممیزی امنیتی شده باشد.

## مرزهای امنیتی

```text
┌─────────────────────────────────────────────────────────────────────┐
│ ۱. ورودی غیرقابل‌اعتماد کلاینت                                      │
│    body / query / params / Authorization header                     │
└───────────────┬─────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ۲. لایه‌ی HTTP                                                      │
│    helmet() ، CORS شرطی ، /api/v1                                   │
└───────────────┬─────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ۳. Guards                                                           │
│    JwtAuthGuard → JwtStrategy (HS256, exp, sub=UUIDv4, DB lookup)   │
│    PostCreateRateLimitGuard (فقط POST /posts)                       │
└───────────────┬─────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ۴. Validation                                                       │
│    ValidationPipe: whitelist + forbidNonWhitelisted + transform     │
│    DTO normalization (trim, lowercase) ، ParseUUIDPipe v4           │
└───────────────┬─────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ۵. منطق Service                                                     │
│    authorId فقط از JWT ، بررسی وجود پست/والد ، bcrypt ، dummy hash  │
└───────────────┬─────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ۶. Constraintهای پایگاه داده                                        │
│    UNIQUE ، CHECK lowercase/not-blank ، FK مرکب ، ON DELETE RESTRICT│
└───────────────┬─────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ۷. شکل‌دهی پاسخ                                                     │
│    Prisma select صریح ، Mapper ، AllExceptionsFilter (پنهان‌سازی 5xx)│
└─────────────────────────────────────────────────────────────────────┘
```

---

## ۱. طراحی JWT دسترسی

| جنبه | پیاده‌سازی |
|---|---|
| نوع توکن | فقط access token. refresh token، logout و فهرست سیاه توکن وجود ندارد. |
| صدور | `JwtService.signAsync({ sub: user.id })` در `AuthService.login` |
| payload | فقط `sub` (شناسه‌ی کاربر). claimهای استاندارد مثل `iat` و `exp` را کتابخانه اضافه می‌کند. |
| انقضا | `signOptions.expiresIn` برابر `JWT_EXPIRES_IN` (بر حسب ثانیه، بین ۶۰ و ۲۵۹۲۰۰۰، پیش‌فرض ۳۶۰۰) |
| پاسخ ورود | `{ accessToken, tokenType: 'Bearer', expiresIn, user }` |

- **تهدید:** جعل هویت و استفاده‌ی طولانی‌مدت از توکن سرقت‌شده.
- **راهکار:** امضای متقارن با secret حداقل ۳۲ کاراکتری و عمر محدود قابل پیکربندی.
- **محدودیت:** توکن تا زمان انقضا معتبر است و راهی برای لغو تک‌توکن وجود ندارد. تنها استثنا حالتی است که کاربر از پایگاه داده حذف شود (بخش ۴). payload رمزگذاری نشده و فقط امضا شده است. البته جز شناسه‌ی کاربر چیزی در آن نیست.

## ۲. استخراج Bearer و محدودیت الگوریتم

در `JwtStrategy`:

```ts
super({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  ignoreExpiration: false,
  secretOrKey: config.get('jwt', { infer: true }).secret,
  algorithms: ['HS256'],
});
```

- **تهدید:** حمله‌ی algorithm confusion (مثل `alg: none` یا جابه‌جایی الگوریتم) و پذیرش توکن منقضی.
- **راهکار:** هنگام verify فقط `HS256` پذیرفته می‌شود و انقضا نادیده گرفته نمی‌شود. توکن فقط از هدر `Authorization: Bearer ...` خوانده می‌شود (نه از cookie یا query).
- **محدودیت:** در `signOptions` الگوریتم به‌صراحت تعیین نشده و برای secret متقارن از پیش‌فرض کتابخانه استفاده می‌شود. سازگاری این پیش‌فرض با `HS256` در سمت verify را تست‌های E2E (ورود و سپس `GET /auth/me`) عملاً تأیید می‌کنند.

## ۳. اعتبارسنجی secret

`JWT_SECRET` در `EnvironmentVariables` با `@IsString() @MinLength(32)` تعریف شده است. اگر کوتاه‌تر باشد، برنامه با خطای `Invalid environment configuration` بالا نمی‌آید. این رفتار در اجرای محلی با `JWT_SECRET` کوتاه مشاهده شد (خروج با کد ۱).

- **محدودیت:** فقط طول بررسی می‌شود، نه آنتروپی. مقدار placeholder موجود در `.env.example` باید حتماً تعویض شود.

## ۴. جست‌وجوی کاربر پس از تأیید JWT

```ts
async validate(payload: { sub?: unknown }): Promise<AuthenticatedUser> {
  if (typeof payload.sub !== 'string' || !isUUID(payload.sub, '4')) {
    throw new UnauthorizedException();
  }
  const user = await this.prisma.user.findUnique({
    where: { id: payload.sub },
    select: publicUserSelect,
  });
  if (!user) throw new UnauthorizedException();
  return user;
}
```

- **تهدید:** توکن معتبر متعلق به کاربری که دیگر وجود ندارد، یا payload دست‌کاری‌شده با `sub` غیرعادی.
- **راهکار:** شکل `sub` بررسی می‌شود و در هر درخواست محافظت‌شده کاربر از پایگاه داده خوانده می‌شود. اگر ردیف کاربر وجود نداشته باشد، همان لحظه `401` برگردانده می‌شود. `request.user` فقط شامل فیلدهای `publicUserSelect` است.
- **هزینه:** یک query اضافه روی کلید اصلی `users` در هر درخواست محافظت‌شده.
- **محدودیت:** در کد فعلی endpoint حذف کاربر وجود ندارد. بنابراین این مزیت فقط وقتی اثر دارد که ردیف کاربر خارج از API حذف شود.

## ۵. هش رمز عبور با bcrypt

`PasswordHasher` در `src/modules/auth/password-hasher.ts`:

```ts
const BCRYPT_COST = 10;
```

- **تهدید:** افشای رمزها در صورت نشت پایگاه داده.
- **راهکار:** فقط هش bcrypt با salt داخلی و cost برابر ۱۰ در ستون `password_hash` با نوع `VARCHAR(100)` ذخیره می‌شود.
- **محدودیت:** cost ثابت در کد تعریف شده و از طریق env قابل تنظیم نیست. pepper یا الگوریتم جایگزین (مثل Argon2) وجود ندارد.

## ۶. سیاست طول بایتی رمز عبور

| DTO | قاعده |
|---|---|
| `RegisterDto.password` | `@IsByteLength(8, 72)` با پیام `password must be between 8 and 72 bytes` |
| `LoginDto.password` | `@IsByteLength(1, 72)` |

- **تهدید:** bcrypt فقط ۷۲ بایت اول ورودی را در نظر می‌گیرد. رمز طولانی‌تر بی‌صدا کوتاه می‌شود و دو رمز متفاوت با ۷۲ بایت اول یکسان، هش یکسان پیدا می‌کنند.
- **راهکار:** محدودیت بر حسب بایت است، نه کاراکتر. بنابراین کاراکترهای چندبایتی UTF-8 هم درست شمرده می‌شوند.
- **محدودیت:** قاعده‌ی پیچیدگی (حروف بزرگ، عدد، نماد) یا بررسی رمزهای افشاشده وجود ندارد. رمز `trim` نمی‌شود، یعنی فاصله‌ها بخشی از رمز هستند.

## ۷. dummy hash برای جلوگیری از شمارش کاربران

```ts
const hash = user?.passwordHash ?? (await this.hasher.getDummyHash());
const matches = await this.hasher.compare(dto.password, hash);
if (!user || !matches) {
  throw new UnauthorizedException('Invalid credentials');
}
```

- **تهدید:** user enumeration، یعنی کشف وجود یک ایمیل از روی تفاوت زمان پاسخ یا تفاوت پیام خطا.
- **راهکار:**
  - وقتی ایمیل وجود ندارد، `bcrypt.compare` روی یک هش ساختگی اجرا می‌شود که یک بار با همان cost ساخته شده است. بنابراین هزینه‌ی زمانی دو حالت نزدیک به هم است.
  - پیام و کد خطا در هر دو حالت یکسان است (`401` و `Invalid credentials`). این موضوع با Unit Test و E2E Test تأیید شده است.
- **محدودیت:** زمان پاسخ کاملاً ثابت تضمین نمی‌شود. endpoint ثبت‌نام با پاسخ `409` و پیام‌هایی مثل `Email is already in use` عمداً وجود ایمیل یا نام کاربری را آشکار می‌کند. این یک trade-off آگاهانه به نفع تجربه‌ی کاربری است.

## ۸. رفتار در شکست ورود

- پاسخ همیشه `401` با پیام `Invalid credentials` است.
- **rate limit برای login وجود ندارد.** محافظت در برابر brute force فقط به هزینه‌ی bcrypt محدود می‌شود. این یکی از محدودیت‌های شناخته‌شده‌ی پروژه است.

## ۹. نرمال‌سازی DTO

| فیلد | تبدیل |
|---|---|
| `RegisterDto.username`، `RegisterDto.email` | `trim()` و سپس `toLowerCase()` |
| `LoginDto.email` | `trim()` و سپس `toLowerCase()` |
| `CreatePostDto.content`، `CreatePostDto.caption` | `trim()` |
| `CreateCommentDto.text` | `trim()` |

- **تهدید:** حساب‌های تکراری با تفاوت در حروف بزرگ و کوچک (مثل `Ali@x.com` و `ali@x.com`) و محتوای فقط شامل فاصله.
- **راهکار دولایه:** نرمال‌سازی در DTO، و `CHECK ("username" = lower("username"))`، `CHECK ("email" = lower("email"))` و `CHECK (btrim(...) <> '')` در پایگاه داده.

## ۱۰. `whitelist` و `forbidNonWhitelisted`

```ts
new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
```

- **تهدید:** mass assignment، یعنی ارسال فیلدهای ناخواسته مثل `role` یا `authorId`.
- **راهکار:** هر فیلدی که در DTO تعریف نشده باشد باعث `400` می‌شود. E2E تأیید می‌کند که `role: 'admin'` در ثبت‌نام و `authorId` در ساخت پست هر دو `400` می‌گیرند.
- **محدودیت:** `@CurrentUser()` یک decorator سفارشی است و با تنظیمات فعلی توسط `ValidationPipe` اعتبارسنجی نمی‌شود. البته مقدار آن از `JwtStrategy` می‌آید، نه از کلاینت.

## ۱۱. استخراج شناسه‌ی نویسنده از JWT

در `PostsController.create` و `CommentsController.create`، شناسه‌ی نویسنده همیشه `user.id` حاصل از `@CurrentUser()` است. DTOها فیلدی به نام `authorId` ندارند.

- **تهدید:** انتشار محتوا به نام کاربر دیگر.
- **راهکار:** شناسه فقط از توکن تأییدشده و پایگاه داده می‌آید و فیلد اضافه در body رد می‌شود.

## ۱۲. `ParseUUIDPipe`

همه‌ی پارامترهای مسیر (`id`، `postId`، `commentId`، `userId`) با `new ParseUUIDPipe({ version: '4' })` بررسی می‌شوند. ورودی نامعتبر پیش از رسیدن به Service با `400` و پیام `Validation failed (uuid v 4 is expected)` رد می‌شود (مشاهده‌شده در اجرای محلی).

- **تهدید:** ارسال ورودی بدشکل به لایه‌ی پایگاه داده و خطاهای `500` ناشی از آن.
- **محدودیت:** این pipe فقط نسخه‌ی ۴ را می‌پذیرد. این با `gen_random_uuid()` در PostgreSQL که UUID نسخه‌ی ۴ تولید می‌کند سازگار است.

## ۱۳. Helmet

`app.use(helmet())` با تنظیمات پیش‌فرض اعمال شده است. در اجرای محلی این هدرها مشاهده شدند: `Content-Security-Policy`، `Strict-Transport-Security` و `X-Content-Type-Options: nosniff`. هدر `X-Powered-By` هم در پاسخ وجود نداشت.

- **محدودیت:** پیکربندی سفارشی ندارد. برای یک JSON API بیشتر این هدرها اثر حفاظتی محدودی دارند و بیشترین ارزششان دفاع در عمق است.

## ۱۴. CORS

```ts
const corsOrigin = config.get('corsOrigin', { infer: true });
if (corsOrigin) {
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
  });
}
```

- اگر `CORS_ORIGIN` تنظیم نشده باشد، CORS فعال نمی‌شود و مرورگرها درخواست‌های cross-origin را رد می‌کنند.
- فهرست originها صریح و جداشده با کاما است، نه wildcard.
- متدها فقط `GET`، `POST` و `OPTIONS` هستند که با API فعلی (بدون PUT یا DELETE) هم‌خوانی دارد.
- `credentials` فعال نیست. این با احراز هویت مبتنی بر هدر (نه cookie) سازگار است.
- هدرهای rate limit برای خواندن در جاوااسکریپت سمت مرورگر expose شده‌اند.

## ۱۵. فیلتر خطا

- **تهدید:** افشای جزئیات داخلی (پیام خطای پایگاه داده یا stack trace) به کلاینت.
- **راهکار:** `AllExceptionsFilter` برای هر خطای غیر `HttpException` و هر وضعیت ۵xx پیام `Internal server error` برمی‌گرداند. جزئیات و stack فقط در لاگ سرور ثبت می‌شوند. Unit Test با خطای `secret db detail` این رفتار را تأیید می‌کند.
- **محدودیت:** خطاهای ۴xx پیام اصلی خود را نگه می‌دارند. این عمدی است، چون پیام‌های validation برای کلاینت مفیدند. پاسخ `503` مربوط به readiness هم جزئیات Terminus را از دست می‌دهد ([چرخه‌ی عمر درخواست](./04-request-lifecycle.md) را ببینید).

## ۱۶. حذف داده‌ی حساس با select و mapper

| داده | محافظت |
|---|---|
| `passwordHash` | فقط در `AuthService.login` صریحاً select می‌شود و پیش از بازگشت با destructuring حذف می‌شود. Unit Test تأیید می‌کند که `result.user` فیلد `passwordHash` ندارد. |
| `email` | فقط در `publicUserSelect` وجود دارد که در `register`، `login` و `/auth/me` استفاده می‌شود، یعنی فقط به خود کاربر نمایش داده می‌شود. `profileUserSelect` (پروفایل عمومی) و author در پست و کامنت (`id`، `username`) ایمیل ندارند. |
| فیلدهای داخلی (`updatedAt` و ...) | در هیچ select خواندنی برای پاسخ وجود ندارند. |

چون انواع داده از خود شیء select مشتق می‌شوند (`Prisma.XGetPayload`)، دسترسی به فیلدی که select نشده در زمان کامپایل خطا می‌دهد.

## ۱۷. رفتار امنیتی rate limit

- **دامنه:** فقط `POST /api/v1/posts`، به ازای هر کاربر احراز هویت‌شده. کلید بر اساس `user.id` ساخته می‌شود، نه IP.
- **ترتیب:** `JwtAuthGuard` اول اجرا می‌شود. درخواست بدون توکن سهمیه‌ای مصرف نمی‌کند و در شمارنده‌ای ثبت نمی‌شود. اگر `request.user` وجود نداشته باشد، `PostCreateRateLimitGuard` خودش هم `401` برمی‌گرداند.
- **Fail-open:** اگر Redis در دسترس نباشد، درخواست‌ها بدون محدودیت پذیرفته می‌شوند. یعنی در دوره‌ی خرابی Redis، حفاظت ضداسپم وجود ندارد و در ازای آن، ساخت پست از دسترس خارج نمی‌شود.
- **محدودیت‌ها:** login، register و کامنت محدود نشده‌اند. پنجره‌ی ثابت در مرز دو پنجره اجازه‌ی تا دو برابر سقف را می‌دهد. درخواست‌هایی که بعداً در validation رد می‌شوند هم سهمیه مصرف می‌کنند.

جزئیات در [Redis: Cache و Rate Limit](./07-redis-cache-rate-limit.md).

## خلاصه‌ی محدودیت‌های امنیتی شناخته‌شده

| محدودیت | اثر |
|---|---|
| نبود refresh token و لغو توکن | توکن سرقت‌شده تا زمان انقضا معتبر است. |
| نبود rate limit برای login و register | brute force فقط با هزینه‌ی bcrypt کند می‌شود. |
| نبود RBAC | همه‌ی کاربران احراز هویت‌شده مجوز یکسان دارند. |
| پیام‌های `409` در ثبت‌نام | وجود ایمیل یا نام کاربری قابل کشف است. |
| fail-open بودن rate limit | در زمان خرابی Redis، محدودیت ساخت پست اعمال نمی‌شود. |
| HTTPS | در لایه‌ی برنامه پیکربندی نشده و فرض بر این است که در لایه‌ی استقرار (reverse proxy) تأمین شود. چنین لایه‌ای در این مخزن وجود ندارد. |
