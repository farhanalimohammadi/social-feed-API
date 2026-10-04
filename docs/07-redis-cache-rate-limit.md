# ۰۷ - Redis: Cache فید و Rate Limit

Redis در این پروژه دو کاربرد مستقل دارد و هیچ‌کدام منبع حقیقت نیستند:

1. **Cache فید عمومی** (`PostsFeedCache`)
2. **Rate limit ساخت پست** (`RateLimitService` و `PostCreateRateLimitGuard`)

هر دو فقط از طریق `RedisService` به Redis دسترسی دارند.

---

## بخش مشترک: کلاینت Redis و رفتار در خرابی

### پیکربندی کلاینت

```ts
this.client = new Redis(url, {
  lazyConnect: true,
  connectTimeout: 2000,
  commandTimeout: 1000,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});
```

| گزینه | اثر |
|---|---|
| `lazyConnect: true` | اتصال در سازنده برقرار نمی‌شود و در `onModuleInit` با `connect()` آغاز می‌شود. |
| `connectTimeout: 2000` | سقف ۲ ثانیه برای برقراری اتصال |
| `commandTimeout: 1000` | هر فرمان حداکثر ۱ ثانیه منتظر پاسخ می‌ماند. |
| `maxRetriesPerRequest: 1` | تلاش مجدد محدود برای هر فرمان |
| `enableOfflineQueue: false` | وقتی اتصال برقرار نیست، فرمان‌ها در صف نمی‌مانند و فوراً شکست می‌خورند. |

نتیجه این است که خرابی Redis باعث معطلی طولانی درخواست‌های HTTP نمی‌شود.

### رفتار در خرابی

- `onModuleInit`: اگر `connect()` شکست بخورد، فقط هشدار `Redis unavailable at startup: ...` لاگ می‌شود و برنامه بالا می‌آید (در اجرای محلی با پورت بسته مشاهده شد).
- رویداد `error`: تا رسیدن رویداد بعدی `ready` فقط یک بار لاگ می‌شود (`errorLogged`).
- همه‌ی عملیات (`get`، `set`، `del`، `incr`، `eval`) از متد `safe` عبور می‌کنند. این متد خطا را با پیام `Redis <operation> failed: ...` و سطح warn لاگ می‌کند و `null` برمی‌گرداند. این لاگ برای **هر** عملیات ناموفق ثبت می‌شود.
- `set` مقدار `boolean` برمی‌گرداند (`true` فقط وقتی پاسخ `OK` باشد) و `del` در صورت خطا `false` برمی‌گرداند.

---

## بخش ۱: Cache فید

### الگوی cache-aside

```text
           ┌──────────────────────── PostsService.findFeed ───────────────────────┐
           │                                                                      │
request ──►│ 1. PostsFeedCache.get(page, limit)                                   │
           │      GET generation  → g (یا "0")                                    │
           │      GET feedKey(g, page, limit)                                     │
           │      HIT + معتبر  ─────────────────────────────────────► return     │
           │      خراب → DEL key ، ادامه به عنوان MISS                            │
           │ 2. MISS: Promise.all(count, findMany)  ── PostgreSQL                 │
           │ 3. map → { data, meta }                                              │
           │ 4. PostsFeedCache.set(g, page, limit, result)  SET ... EX ttl        │
           │ 5. return result                                                     │
           └──────────────────────────────────────────────────────────────────────┘
```

برنامه خودش مسئول خواندن از cache، رفتن به پایگاه داده و پر کردن cache است. Redis هیچ منطقی درباره‌ی داده ندارد.

**دامنه:** فقط `GET /api/v1/posts` cache می‌شود. `GET /posts/:id`، کامنت‌ها، پروفایل و تاریخچه‌ی کاربر cache ندارند.

### کلیدها

```ts
const GENERATION_KEY = 'posts:feed:v1:generation';
const feedKey = (generation: string, page: number, limit: number): string =>
  `posts:feed:v1:g${generation}:page:${page}:limit:${limit}`;
```

نمونه:

```text
posts:feed:v1:generation               → "7"
posts:feed:v1:g7:page:1:limit:20       → JSON صفحه‌ی ۱ با limit 20
posts:feed:v1:g7:page:2:limit:10       → JSON صفحه‌ی ۲ با limit 10
```

- بخش `v1` نسخه‌ی قالب کلید و payload را نشان می‌دهد. با تغییر قالب، افزایش آن کلیدهای قدیمی را بی‌اثر می‌کند.
- اگر کلید generation وجود نداشته باشد، مقدار `'0'` استفاده می‌شود.
- کلید generation **TTL ندارد** (با `INCR` ساخته می‌شود) و پایدار می‌ماند.

### TTL

```ts
const { ttlSeconds } = this.config.get('feedCache', { infer: true });
await this.redis.set(feedKey(generation, page, limit), JSON.stringify(payload), ttlSeconds);
```

مقدار از `FEED_CACHE_TTL_SECONDS` می‌آید (بین ۱ و ۳۶۰۰، پیش‌فرض ۳۰) و با `SET key value EX ttl` اعمال می‌شود.

### رفتار HIT

اگر کلید صفحه وجود داشته باشد و `parseFeedPage` آن را معتبر بداند، `PostsService.findFeed` همان شیء را برمی‌گرداند و **هیچ query به PostgreSQL زده نمی‌شود**. Unit Test با عنوان `returns the cached page without touching the database` این رفتار را تأیید می‌کند.

### رفتار MISS

`count` و `findMany` به‌صورت موازی اجرا می‌شوند، نتیجه با `toPostResponse` تبدیل می‌شود و **با همان generation که در ابتدای درخواست خوانده شده بود** ذخیره می‌شود. Unit Test با عنوان `loads from the database on a miss and stores under the same generation` این رفتار را تأیید می‌کند.

### قالب payload: DTO نگاشت‌شده، نه مدل خام Prisma

چیزی که در Redis ذخیره می‌شود، **خروجی mapper** است (`Paginated<PostResponse>`)، یعنی دقیقاً همان چیزی که به کلاینت ارسال می‌شود. ردیف خام Prisma (با `_count` و آرایه‌ی `comments`) ذخیره نمی‌شود. مزایای این کار:

- داده‌ی داخلی یا حساس هرگز وارد cache نمی‌شود.
- پاسخ HIT و MISS دقیقاً هم‌شکل‌اند.
- تغییر schema پایگاه داده تا زمانی که قرارداد API ثابت بماند، روی cache اثری ندارد.

### پارس JSON و اعتبارسنجی شکل

`parseFeedPage(raw)` در `src/modules/posts/cache/posts-feed.codec.ts`:

1. `JSON.parse` را در `try/catch` اجرا می‌کند. اگر شکست بخورد، `null` برمی‌گرداند.
2. ریشه باید شیئی با آرایه‌ی `data` و شیء `meta` باشد.
3. هر چهار فیلد `meta` (`currentPage`، `itemsPerPage`، `totalItems`، `totalPages`) باید عدد متناهی باشند.
4. هر پست با `parsePost` بررسی می‌شود: `id`، `contentType` و `content` باید رشته باشند. `caption` باید رشته یا `null` باشد. `createdAt` باید تاریخ معتبر باشد. `author` باید `{ id, username }` باشد. `totalComments` باید عدد باشد. `latestComment` باید `null` یا کامنت معتبر باشد.
5. اگر **حتی یک** پست نامعتبر باشد، کل صفحه `null` در نظر گرفته می‌شود.

### بازسازی Date

`JSON.stringify` نمونه‌های `Date` را به رشته‌ی ISO تبدیل می‌کند. تابع `reviveDate` این رشته‌ها را برای `createdAt` پست و `createdAt` آخرین کامنت به `Date` برمی‌گرداند و تاریخ نامعتبر را رد می‌کند. بنابراین نوع خروجی cache با `PostResponse` یکسان است. Unit Test با عنوان `revives dates` این را تأیید می‌کند.

### حذف cache خراب

```ts
const payload = parseFeedPage(raw);
if (!payload) {
  this.logger.warn(`Corrupt feed cache entry removed: ${key}`);
  await this.redis.del(key);
}
return { generation, payload };
```

مقدار خراب حذف می‌شود و درخواست جاری مثل MISS از پایگاه داده پاسخ داده می‌شود. با `set` بعدی، cache سالم دوباره ساخته می‌شود.

### invalidation مبتنی بر generation

```ts
async invalidate(): Promise<void> {
  const next = await this.redis.incr(GENERATION_KEY);
  if (next === null) {
    this.logger.warn('Feed cache invalidation failed; feed may be stale until TTL expires');
  }
}
```

- این متد پس از `PostsService.create` و همچنین پس از `CommentsService.create` (از طریق `PostsService.invalidateFeedCache`) صدا زده می‌شود.
- با یک `INCR` اتمیک، همه‌ی صفحات فید به‌طور هم‌زمان بی‌اثر می‌شوند، چون خواننده‌های بعدی کلیدهایی با generation جدید می‌سازند.
- کلیدهای generation قبلی حذف نمی‌شوند و با پایان TTL خودشان منقضی می‌شوند.

### چرا از `KEYS` استفاده نمی‌شود؟

راه ساده‌ی دیگر این است که با `KEYS posts:feed:*` یا `SCAN` کلیدها پیدا و حذف شوند. `KEYS` فرمانی O(N) و مسدودکننده است و Redis را در طول اجرایش برای همه‌ی کلاینت‌ها متوقف می‌کند. `SCAN` مسدودکننده نیست اما چندمرحله‌ای و غیراتمیک است. روش generation همین نتیجه را با یک فرمان O(1) می‌گیرد.

### ایمنی در برابر race: خواندن generation و سپس نوشتن cache

```text
Reader                                Writer
──────                                ──────
GET generation → 7
query PostgreSQL (پست جدید هنوز نیست)
                                      INSERT post (commit)
                                      INCR generation → 8
SET posts:feed:v1:g7:... (داده‌ی کهنه)
                                      Reader بعدی: GET generation → 8
                                                   کلید g8 را می‌خواند → MISS → داده‌ی تازه
```

داده‌ی کهنه زیر کلید **generation قدیمی** نوشته می‌شود و هیچ خواننده‌ی بعدی آن را نمی‌خواند. به همین دلیل `set` همان generation خوانده‌شده در ابتدای درخواست را می‌گیرد، نه مقدار فعلی را.

### اگر invalidation شکست بخورد

اگر `INCR` به دلیل خطای Redis `null` برگرداند، پست یا کامنت با موفقیت ذخیره شده است اما generation تغییر نکرده. صفحات cache‌شده‌ی فعلی تا پایان TTL (حداکثر `FEED_CACHE_TTL_SECONDS`) کهنه می‌مانند. این وضعیت با سطح warn لاگ می‌شود.

### پنجره‌ی سازگاری نهایی (eventual consistency)

| موقعیت | حداکثر تأخیر |
|---|---|
| حالت عادی | فاصله‌ی کوتاه بین commit در PostgreSQL و اجرای `INCR` |
| شکست `INCR` | تا `FEED_CACHE_TTL_SECONDS` ثانیه (پیش‌فرض ۳۰) |
| Redis کاملاً قطع | تأخیری وجود ندارد، چون همه‌ی خواندن‌ها مستقیماً از PostgreSQL انجام می‌شوند. |

نکته: چون کلید شامل `page` و `limit` است، هر ترکیب جداگانه cache می‌شود. `page` سقف ندارد (فقط `@Min(1)`)، پس فضای کلیدها به تعداد ترکیب‌های درخواست‌شده بستگی دارد. TTL عمر هر کلید را محدود می‌کند.

---

## بخش ۲: Rate Limit ساخت پست

### دامنه

- فقط `POST /api/v1/posts`
- به ازای هر کاربر احراز هویت‌شده (`request.user.id`)
- login، register، کامنت و endpointهای خواندنی محدود نشده‌اند.

### طراحی کلید

```ts
const KEY_PREFIX = 'ratelimit:posts:create:v1';
// ...
const nowSeconds = Math.floor(nowMs / 1000);
const windowIndex = Math.floor(nowSeconds / windowSeconds);
const key = `${KEY_PREFIX}:user:${userId}:window:${windowIndex}`;
```

نمونه:

```text
ratelimit:posts:create:v1:user:3f1c...-...:window:30000000
```

پنجره‌ها نسبت به epoch هم‌تراز شده‌اند. با `windowSeconds = 60`، هر پنجره دقیقاً یک دقیقه‌ی تقویمی (ثانیه‌ی ۰ تا ۵۹) است.

### الگوریتم پنجره‌ی ثابت (fixed window)

- در هر پنجره، یک شمارنده به ازای هر کاربر وجود دارد.
- `allowed = count <= limit`
- `remaining = max(0, limit - count)`
- با شروع پنجره‌ی بعدی، کلید جدیدی استفاده می‌شود و شمارش از صفر آغاز می‌شود.

### پیکربندی

| متغیر | کلید config | محدوده | پیش‌فرض |
|---|---|---|---|
| `POST_CREATE_RATE_LIMIT` | `postCreateRateLimit.limit` | ۱ تا ۱۰۰۰ | `10` |
| `POST_CREATE_RATE_WINDOW_SECONDS` | `postCreateRateLimit.windowSeconds` | ۱ تا ۳۶۰۰ | `60` |

### جایگاه Guard

```ts
@UseGuards(JwtAuthGuard, PostCreateRateLimitGuard)
```

```text
JwtAuthGuard ──► PostCreateRateLimitGuard ──► ValidationPipe ──► PostsController.create
```

- درخواست بدون توکن معتبر به rate limit نمی‌رسد و سهمیه مصرف نمی‌کند.
- چون Guardها پیش از Pipeها اجرا می‌شوند، **درخواستی که بعداً در validation رد شود هم یک واحد سهمیه مصرف می‌کند**.

### اسکریپت Lua

```ts
export const CONSUME_ATTEMPT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return count
`;
```

فراخوانی:

```ts
const result = await this.redis.eval(CONSUME_ATTEMPT_SCRIPT, [key], [windowSeconds]);
```

### `INCR` و `EXPIRE` اتمیک

Redis هر اسکریپت Lua را به‌صورت اتمیک اجرا می‌کند و هیچ فرمان دیگری بین `INCR` و `EXPIRE` اجرا نمی‌شود. این کار دو مشکل را حل می‌کند:

1. **شمارش دقیق در هم‌زمانی:** ۲۵ درخواست موازی دقیقاً شمارنده‌های ۱ تا ۲۵ را می‌گیرند و تکراری یا از دست‌رفته‌ای وجود ندارد.
2. **کلید یتیم بدون TTL:** اگر `INCR` و `EXPIRE` دو فرمان جدا بودند و process بین آن دو از کار می‌افتاد، کلید برای همیشه بدون انقضا باقی می‌ماند.

### چرا `EXPIRE` فقط در اولین افزایش؟

- اگر `EXPIRE` در هر درخواست اجرا می‌شد، هر درخواست TTL را تمدید می‌کرد و کلید هرگز منقضی نمی‌شد (رفتاری شبیه پنجره‌ی لغزان ناقص).
- با اعمال TTL فقط در `count == 1`، عمر کلید از اولین درخواست پنجره شروع می‌شود و حداکثر `windowSeconds` ثانیه است. چون `windowIndex` در خود کلید است، حتی اگر کلید کمی پس از پایان پنجره زنده بماند، پنجره‌ی بعدی از کلید دیگری استفاده می‌کند.
- تست Integration با عنوان `sets a TTL on the window key that never exceeds the window length` تأیید می‌کند که پس از دو تلاش، مقدار کلید `'2'` است و TTL بزرگ‌تر از صفر و حداکثر برابر `WINDOW_SECONDS` است.

### هدرها

| هدر | چه زمانی | مقدار |
|---|---|---|
| `X-RateLimit-Limit` | هر درخواستی که به Guard برسد و `degraded` نباشد | سقف |
| `X-RateLimit-Remaining` | همان | `max(0, limit - count)` |
| `Retry-After` | فقط در `429` | ثانیه تا پایان پنجره‌ی فعلی |

این هدرها در CORS به‌عنوان `exposedHeaders` اعلام شده‌اند.

### رفتار `429`

```ts
response.setHeader('Retry-After', String(decision.retryAfterSeconds));
throw new HttpException(
  'Too many posts created. Please try again later.',
  HttpStatus.TOO_MANY_REQUESTS,
);
```

بدنه‌ی پاسخ از قالب واحد خطا پیروی می‌کند:

```json
{
  "statusCode": 429,
  "message": "Too many posts created. Please try again later.",
  "error": "Too Many Requests",
  "path": "/api/v1/posts",
  "timestamp": "..."
}
```

### منطق `Retry-After`

```ts
const retryAfterSeconds = Math.max(1, windowSeconds - (nowSeconds % windowSeconds));
```

این مقدار تعداد ثانیه‌های باقی‌مانده تا پایان پنجره‌ی هم‌تراز فعلی است و حداقل `1` است. شمارنده‌ی تلاش‌های ردشده هم افزایش پیدا می‌کند، اما چون `remaining` با `max(0, ...)` محدود شده، مقدار منفی گزارش نمی‌شود.

### رفتار fail-open

```ts
if (typeof result !== 'number') {
  return { allowed: true, limit, remaining: limit, retryAfterSeconds, degraded: true };
}
```

- اگر Redis در دسترس نباشد، `eval` مقدار `null` برمی‌گرداند و درخواست **مجاز** شمرده می‌شود.
- `degraded: true` باعث می‌شود Guard هیچ هدر `X-RateLimit-*` تنظیم نکند، تا اطلاعات نادرست به کلاینت داده نشود.
- **trade-off:** در دوره‌ی خرابی Redis، دسترس‌پذیری ساخت پست حفظ می‌شود اما حفاظت ضداسپم از بین می‌رود. برای یک فید اجتماعی، این انتخاب آگاهانه است: خرابی یک زیرساخت جانبی نباید قابلیت اصلی را از کار بیندازد.

### trade-off انفجار در مرز پنجره

```text
پنجره N                    │ پنجره N+1
...............  10 درخواست│10 درخواست ...............
                 (ثانیه 59)│(ثانیه 0)
```

در پنجره‌ی ثابت، کاربر می‌تواند در انتهای یک پنجره و ابتدای پنجره‌ی بعدی، در مدت کوتاهی تا `2 × limit` درخواست موفق داشته باشد. این هزینه‌ی سادگی و هزینه‌ی O(1) الگوریتم است. الگوریتم‌های sliding window یا token bucket این مشکل را ندارند اما پیچیده‌ترند و **در این پروژه پیاده‌سازی نشده‌اند**.

### تست Integration هم‌زمانی و آنچه اثبات می‌کند

در `test/database/rate-limit.int-spec.ts`:

```ts
it('allows exactly 10 of 25 concurrent attempts in one window', async () => {
  const userId = randomUUID();
  const now = Date.now();

  const decisions = await Promise.all(
    Array.from({ length: 25 }, () => rateLimit.consumePostCreateAttempt(userId, now)),
  );

  expect(decisions.every((d) => !d.degraded)).toBe(true);
  expect(decisions.filter((d) => d.allowed)).toHaveLength(10);
  expect(decisions.filter((d) => !d.allowed)).toHaveLength(15);
  expect(Math.min(...decisions.map((d) => d.remaining))).toBe(0);
});
```

این تست اثبات می‌کند که:

- روی **Redis واقعی** (نه mock) و با ۲۵ فراخوانی موازی، دقیقاً ۱۰ درخواست پذیرفته می‌شوند. این نشان می‌دهد شمارش اتمیک است و race condition وجود ندارد.
- هیچ تصمیمی `degraded` نیست، یعنی تست واقعاً به Redis وصل بوده و از مسیر fail-open عبور نکرده است.
- `now` ثابت است، پس همه‌ی تلاش‌ها در یک پنجره قرار می‌گیرند و مرز پنجره نتیجه را مخدوش نمی‌کند.

سایر تست‌های همین فایل: مستقل بودن کاربران، و شروع شمارش از صفر در پنجره‌ی بعد (`remaining` برابر `LIMIT - 1`). تست E2E در `posts.e2e-spec.ts` هم بررسی می‌کند که تلاش یازدهم پاسخ `429` با `Retry-After ≥ 1` می‌گیرد.
