# ۰۴ - چرخه‌ی عمر درخواست

این سند مسیر واقعی درخواست‌ها را از ورود به برنامه تا پاسخ HTTP، گام‌به‌گام توضیح می‌دهد.

## ترتیب کلی پردازش در NestJS

ترتیب اجرای اجزای درخواست در NestJS ثابت است و این پروژه هم از همان پیروی می‌کند:

```text
Middleware (helmet, CORS)
  → Routing (/api/v1/...)
  → Guards            (به ترتیب ذکرشده در @UseGuards)
  → Interceptors      (در این پروژه هیچ Interceptorی تعریف نشده)
  → Pipes             (ValidationPipe سراسری + ParseUUIDPipe پارامترها)
  → Controller method
  → Service(s)
  → سریال‌سازی JSON توسط Express
خطا در هر مرحله → AllExceptionsFilter → پاسخ JSON با قالب واحد
```

دو پیامد مهم این ترتیب:

1. **Guardها قبل از Pipeها اجرا می‌شوند.** در `POST /api/v1/posts`، تابع `PostCreateRateLimitGuard` پیش از `ValidationPipe` اجرا می‌شود. بنابراین درخواستی که بدنه‌ی نامعتبر دارد و با `400` رد می‌شود، **یک واحد از سهمیه‌ی rate limit را مصرف کرده است**.
2. در مسیرهای محافظت‌شده‌ای که پارامتر UUID دارند (مثل `POST /api/v1/posts/:postId/comments`)، اگر توکن نباشد، پاسخ `401` است، حتی اگر `postId` نامعتبر باشد. دلیلش این است که `JwtAuthGuard` قبل از `ParseUUIDPipe` اجرا می‌شود.

تبدیل `Date` به رشته‌ی ISO 8601 هنگام سریال‌سازی JSON انجام می‌شود.

---

## ۱. ثبت‌نام (Register)

| مورد | مقدار |
|---|---|
| Endpoint | `POST /api/v1/auth/register` |
| احراز هویت | ندارد |
| Guardها | ندارد |
| اعتبارسنجی | `RegisterDto` |
| Service | `AuthService.register` |
| عملیات داده | `bcrypt.hash` و سپس `prisma.user.create({ select: publicUserSelect })` |
| پاسخ موفق | `201` با `{ user }` |

```text
Client
  -> POST /api/v1/auth/register  { username, email, password }
  -> ValidationPipe(RegisterDto)
       trim + toLowerCase روی username/email
       username ~ /^[a-z0-9_]{3,30}$/ ، email معتبر و ≤ 254 ، password 8..72 بایت
       فیلد اضافه → 400
  -> AuthController.register
  -> AuthService.register
       -> PasswordHasher.hash (bcrypt, cost 10)
       -> PrismaService.user.create(select: publicUserSelect)
            -> PostgreSQL INSERT users
               (UNIQUE username/email + CHECK lowercase)
  <- 201 { user: { id, username, email, createdAt } }
```

**مسیرهای خطا:**

| وضعیت | علت |
|---|---|
| `400` | نقض قواعد DTO یا وجود فیلد ناشناخته (مثلاً `role`) |
| `409` | خطای Prisma با کد `P2002`. پیام بسته به اطلاعات `meta` یکی از `Email is already in use`، `Username is already in use` یا `Username or email is already in use` است. |
| `500` | هر خطای پیش‌بینی‌نشده‌ی دیگر (پیام پنهان می‌شود) |

نکته: ثبت‌نام توکن صادر نمی‌کند. کلاینت باید جداگانه `login` کند.

---

## ۲. ورود (Login)

| مورد | مقدار |
|---|---|
| Endpoint | `POST /api/v1/auth/login` |
| احراز هویت | ندارد |
| اعتبارسنجی | `LoginDto` |
| Service | `AuthService.login` |
| پاسخ موفق | `200` با `{ accessToken, tokenType: 'Bearer', expiresIn, user }` |

```text
Client
  -> POST /api/v1/auth/login  { email, password }
  -> ValidationPipe(LoginDto)  (email: trim+lowercase+IsEmail ، password: 1..72 بایت)
  -> AuthController.login  (@HttpCode(200))
  -> AuthService.login
       -> PrismaService.user.findUnique({ email }, select: public + passwordHash)
       -> hash = user?.passwordHash ?? PasswordHasher.getDummyHash()
       -> PasswordHasher.compare(password, hash)      ← همیشه اجرا می‌شود
       -> اگر !user || !matches → 401 "Invalid credentials"
       -> حذف passwordHash از شیء
       -> JwtService.signAsync({ sub: user.id })
  <- 200 { accessToken, tokenType: "Bearer", expiresIn, user }
```

**مسیرهای خطا:** `400` برای DTO نامعتبر و `401` با پیام یکسان `Invalid credentials`، چه ایمیل وجود نداشته باشد و چه رمز اشتباه باشد.

---

## ۳. کاربر جاری (`GET /auth/me`)

| مورد | مقدار |
|---|---|
| Endpoint | `GET /api/v1/auth/me` |
| احراز هویت | الزامی (Bearer) |
| Guardها | `JwtAuthGuard` |
| پاسخ موفق | `200` با `{ user }` |

```text
Client
  -> GET /api/v1/auth/me   Authorization: Bearer <token>
  -> JwtAuthGuard (AuthGuard('jwt'))
       -> JwtStrategy (passport-jwt)
            استخراج توکن از هدر Bearer
            بررسی امضا با JWT_SECRET و فقط الگوریتم HS256
            بررسی انقضا (ignoreExpiration: false)
       -> JwtStrategy.validate(payload)
            sub باید رشته و UUID v4 باشد، وگرنه 401
            PrismaService.user.findUnique({ id: sub }, select: publicUserSelect)
            کاربر نبود → 401
       -> request.user = { id, username, email, createdAt }
  -> AuthController.me(@CurrentUser() user)
  <- 200 { user }
```

**مسیرهای خطا:** `401` در این حالت‌ها: توکن وجود نداشته باشد، امضا نامعتبر باشد، توکن منقضی شده باشد، `sub` نامعتبر باشد یا کاربر دیگر وجود نداشته باشد.

---

## ۴. ساخت پست

| مورد | مقدار |
|---|---|
| Endpoint | `POST /api/v1/posts` |
| احراز هویت | الزامی |
| Guardها (به ترتیب) | `JwtAuthGuard` و سپس `PostCreateRateLimitGuard` |
| اعتبارسنجی | `CreatePostDto` |
| Service | `PostsService.create` |
| پاسخ موفق | `201` با `PostResponse` |

```text
Client
  -> POST /api/v1/posts   Authorization: Bearer <token>   { content, caption?, contentType? }
  -> JwtAuthGuard → JwtStrategy.validate → PrismaService (users)
  -> PostCreateRateLimitGuard
       -> RateLimitService.consumePostCreateAttempt(user.id)
            -> RedisService.eval(CONSUME_ATTEMPT_SCRIPT, [key], [windowSeconds])
                 -> Redis: INCR key ; اگر count == 1 → EXPIRE key windowSeconds
       اگر degraded نباشد → X-RateLimit-Limit و X-RateLimit-Remaining
       اگر allowed نباشد  → Retry-After + 429
  -> ValidationPipe(CreatePostDto)
       فیلد اضافه (مثلاً authorId) → 400
  -> PostsController.create(user.id, dto)
  -> PostsService.create
       -> PrismaService.post.create({ data: { authorId, ... }, select: postReadSelect })
            -> PostgreSQL INSERT posts (CHECK content/caption not blank)
       -> PostsFeedCache.invalidate()
            -> RedisService.incr("posts:feed:v1:generation")
       -> toPostResponse(row)
  <- 201 PostResponse (+ هدرهای X-RateLimit-*)
```

**مسیرهای خطا:**

| وضعیت | علت | آیا سهمیه مصرف شده؟ |
|---|---|---|
| `401` | توکن نامعتبر یا وجود نداشتن آن | خیر |
| `429` | عبور از سقف پنجره، همراه با هدر `Retry-After` | بله |
| `400` | DTO نامعتبر یا فیلد اضافه | **بله** (Guard قبل از Pipe اجرا می‌شود) |
| `500` | خطای پایگاه داده یا خطای پیش‌بینی‌نشده | بله |

**رفتار در زمان خرابی Redis:** اگر `eval` مقدار `null` برگرداند، درخواست مجاز شمرده می‌شود (`degraded: true`) و هدرهای `X-RateLimit-*` تنظیم نمی‌شوند. اگر `incr` در `invalidate` شکست بخورد، فقط هشدار `Feed cache invalidation failed; feed may be stale until TTL expires` لاگ می‌شود و پست با موفقیت برگردانده می‌شود.

---

## ۵. خواندن فید: حالت HIT

| مورد | مقدار |
|---|---|
| Endpoint | `GET /api/v1/posts?page=&limit=` |
| احراز هویت | ندارد |
| اعتبارسنجی | `PaginationQueryDto` |
| Service | `PostsService.findFeed` |

```text
Client
  -> GET /api/v1/posts?page=1&limit=20
  -> ValidationPipe(PaginationQueryDto)  (page ≥ 1, 1 ≤ limit ≤ 100)
  -> PostsController.feed
  -> PostsService.findFeed
       -> PostsFeedCache.get(page, limit)
            -> Redis GET posts:feed:v1:generation       → مثلاً "7" (یا "0" اگر نباشد)
            -> Redis GET posts:feed:v1:g7:page:1:limit:20 → رشته‌ی JSON
            -> parseFeedPage(raw) → شیء معتبر با Date بازسازی‌شده
       -> payload موجود است → بازگشت بدون رفتن به PostgreSQL
  <- 200 { data: PostResponse[], meta }
```

---

## ۶. خواندن فید: حالت MISS

```text
Client
  -> GET /api/v1/posts?page=2&limit=10
  -> ValidationPipe → PostsController.feed → PostsService.findFeed
       -> PostsFeedCache.get(2, 10)
            -> Redis GET generation → "7"
            -> Redis GET posts:feed:v1:g7:page:2:limit:10 → null
            ← { generation: "7", payload: null }
       -> Promise.all([
            PrismaService.post.count(),
            PrismaService.post.findMany({
              select: postReadSelect,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              skip: 10, take: 10 })
          ])
       -> data = rows.map(toPostResponse) ; meta = buildMeta(2, 10, total)
       -> PostsFeedCache.set("7", 2, 10, result)
            -> Redis SET posts:feed:v1:g7:page:2:limit:10 <json> EX FEED_CACHE_TTL_SECONDS
  <- 200 { data, meta }
```

**حالت‌های خاص:**

| حالت | رفتار |
|---|---|
| داده‌ی cache خراب است یا شکل نادرست دارد | `parseFeedPage` مقدار `null` برمی‌گرداند. کلید با `DEL` حذف می‌شود، هشدار `Corrupt feed cache entry removed: <key>` لاگ می‌شود و درخواست مثل MISS ادامه پیدا می‌کند. |
| Redis قطع است | `get` مقدار `null` برمی‌گرداند، پس generation برابر `"0"` در نظر گرفته می‌شود. داده از PostgreSQL خوانده می‌شود و `set` بی‌صدا شکست می‌خورد. پاسخ همچنان `200` است (در اجرای محلی با Redis غیرقابل‌دسترس مشاهده شد). |
| PostgreSQL قطع است و cache خالی است | `500` با پیام `Internal server error` |

---

## ۷. ساخت کامنت سطح اول

| مورد | مقدار |
|---|---|
| Endpoint | `POST /api/v1/posts/:postId/comments` |
| احراز هویت | الزامی |
| Guardها | `JwtAuthGuard` |
| اعتبارسنجی | `ParseUUIDPipe` نسخه‌ی ۴ روی `postId` و `CreateCommentDto` |
| Service | `CommentsService.create` |
| پاسخ موفق | `201` با `CommentResponse` |

```text
Client
  -> POST /api/v1/posts/{postId}/comments   Bearer   { text }
  -> JwtAuthGuard → JwtStrategy.validate
  -> ParseUUIDPipe(postId) ; ValidationPipe(CreateCommentDto)
  -> CommentsController.create(postId, user.id, dto)
  -> CommentsService.create
       -> ensurePostExists: post.findUnique({ id }, select: { id }) → نبود: 404 "Post not found"
       -> comment.create({ postId, authorId, parentCommentId: null, text }, select: commentReadSelect)
       -> PostsService.invalidateFeedCache() → Redis INCR generation
       -> toCommentResponse(row)
  <- 201 CommentResponse
```

دلیل invalidation فید پس از ثبت کامنت: هر آیتم فید شامل `totalComments` و `latestComment` است و ثبت کامنت این دو مقدار را تغییر می‌دهد.

**مسیرهای خطا:** `401`، `400` (UUID نامعتبر یا DTO نامعتبر) و `404` (پست وجود ندارد. در این حالت invalidation هم انجام نمی‌شود).

---

## ۸. ساخت پاسخ (Reply)

همان endpoint بالاست، با این تفاوت که `parentCommentId` در body ارسال می‌شود.

```text
Client
  -> POST /api/v1/posts/{postId}/comments   Bearer   { text, parentCommentId }
  -> JwtAuthGuard → ParseUUIDPipe → ValidationPipe (parentCommentId: UUID v4)
  -> CommentsService.create
       -> ensurePostExists(postId)                          → 404 "Post not found"
       -> ensureParentBelongsToPost(parentCommentId, postId)
            comment.findUnique({ id: parentId }, select: { postId })
            نبود → 404 "Parent comment not found"
            parent.postId !== postId → 400 "Parent comment does not belong to this post"
       -> comment.create(...)
            PostgreSQL: FK (parent_comment_id, post_id) → comments(id, post_id)
            (لایه‌ی دفاعی نهایی، حتی اگر بررسی برنامه دور زده شود)
       -> PostsService.invalidateFeedCache()
  <- 201 CommentResponse (parentCommentId پر شده است)
```

نکته‌ی دقیق: سرویس فقط بررسی می‌کند که والد وجود داشته باشد و به همان پست تعلق داشته باشد. **محدودیتی برای عمق وجود ندارد.** یعنی پاسخ به یک پاسخ هم از نظر فنی پذیرفته می‌شود. در سمت خواندن، API هر بار فقط پاسخ‌های مستقیم یک کامنت را برمی‌گرداند.

---

## ۹. پروفایل عمومی کاربر

| مورد | مقدار |
|---|---|
| Endpoint | `GET /api/v1/users/:userId/profile` |
| احراز هویت | ندارد |
| اعتبارسنجی | `ParseUUIDPipe` نسخه‌ی ۴ |
| Service | `UsersService.getProfile` |

```text
Client
  -> GET /api/v1/users/{userId}/profile
  -> ParseUUIDPipe(userId)            → نامعتبر: 400
  -> UsersController.getProfile
  -> UsersService.getProfile
       -> Promise.all([
            user.findUnique({ id }, select: profileUserSelect)      // + _count.posts/comments
            post.findMany({ authorId }, select: recentPostSelect, newest first, take: 5)
            comment.findMany({ authorId }, select: recentCommentSelect, newest first, take: 5)
          ])
       -> user نبود → 404 "User not found"
       -> mergeRecentActivity(posts, comments)  // ترکیب، مرتب‌سازی، برش به ۵، excerpt ≤ 280
       -> toUserProfile(user, activity)
  <- 200 { id, username, createdAt, stats, recentActivity }
```

نکته: هر سه query به‌صورت موازی اجرا می‌شوند، حتی وقتی کاربر وجود ندارد. وجود کاربر بعد از برگشتن نتایج بررسی می‌شود.

مسیرهای تاریخچه (`/users/:userId/posts` و `/users/:userId/comments`) ابتدا با `ensureUserExists` وجود کاربر را بررسی می‌کنند (در غیر این صورت `404`) و سپس `PostsService.findByAuthor` یا `CommentsService.findByAuthor` را صدا می‌زنند.

---

## ۱۰. Liveness

```text
Client
  -> GET /api/v1/health
  -> HealthController.liveness
  <- 200 { "status": "ok" }
```

این endpoint به هیچ وابستگی خارجی دست نمی‌زند و فقط نشان می‌دهد که process پاسخ می‌دهد.

---

## ۱۱. Readiness

```text
Client
  -> GET /api/v1/health/ready
  -> HealthController.readiness (@HealthCheck)
  -> HealthCheckService.check([ () => PrismaHealthIndicator.isHealthy('database') ])
       -> Promise.race([ prisma.$queryRaw`SELECT 1`, timeout(1500ms) ])
       موفق → indicator.up()
       شکست/timeout → indicator.down({ message: 'Database is unreachable' })
  <- 200 { status: "ok", info: { database: { status: "up" } }, error: {}, details: { database: { status: "up" } } }
```

**در حالت شکست:** Terminus یک خطای `503` پرتاب می‌کند. چون `AllExceptionsFilter` پیام همه‌ی خطاهای ۵xx را پنهان می‌کند، پاسخ نهایی قالب واحد خطاست و جزئیات Terminus را ندارد. این رفتار در اجرای محلی با پایگاه داده‌ی غیرقابل‌دسترس مشاهده شد:

```json
{
  "statusCode": 503,
  "message": "Internal server error",
  "error": "Service Unavailable",
  "path": "/api/v1/health/ready",
  "timestamp": "..."
}
```

Readiness فقط PostgreSQL را بررسی می‌کند و وضعیت Redis در آن نقشی ندارد. این با اصل اختیاری بودن Redis سازگار است.
