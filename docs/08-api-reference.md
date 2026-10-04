# ۰۸ - مرجع API

این مرجع فقط بر اساس Controllerها و DTOهای موجود در کد نوشته شده است. همه‌ی مسیرها با `/api/v1` شروع می‌شوند (پیشوند سراسری `api` به‌همراه نسخه‌بندی URI با نسخه‌ی پیش‌فرض `1`).

همه‌ی مقادیر نمونه (شناسه‌ها، ایمیل‌ها، توکن‌ها) ساختگی‌اند.

## قراردادهای عمومی

### هدر احراز هویت

```http
Authorization: Bearer <accessToken>
```

`<accessToken>` از پاسخ `POST /api/v1/auth/login` به دست می‌آید.

### قرارداد صفحه‌بندی

پارامترهای query از `PaginationQueryDto`:

| پارامتر | نوع | پیش‌فرض | قواعد |
|---|---|---|---|
| `page` | عدد صحیح | `1` | `>= 1` |
| `limit` | عدد صحیح | `20` | `1` تا `100` |

قالب پاسخ لیست‌ها (`Paginated<T>`):

```json
{
  "data": [],
  "meta": {
    "currentPage": 1,
    "itemsPerPage": 20,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

- `totalPages = ceil(totalItems / limit)`
- ترتیب همه‌ی لیست‌ها: `createdAt` نزولی و در صورت برابری، `id` نزولی.
- صفحه‌ی بزرگ‌تر از `totalPages` خطا نمی‌دهد و `data` خالی برمی‌گرداند.
- پارامتر ناشناخته در query (مثلاً `?sort=x`) به دلیل `forbidNonWhitelisted` خطای `400` می‌گیرد.

### قالب استاندارد خطا

```json
{
  "statusCode": 400,
  "message": ["limit must not be greater than 100"],
  "error": "Bad Request",
  "path": "/api/v1/posts?limit=500",
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

| فیلد | توضیح |
|---|---|
| `statusCode` | کد HTTP |
| `message` | رشته یا آرایه‌ای از رشته‌ها (خطاهای validation آرایه‌اند). برای ۵xx همیشه `Internal server error` است. |
| `error` | عبارت استاندارد وضعیت HTTP |
| `path` | `originalUrl` درخواست، شامل query string |
| `timestamp` | زمان ISO 8601 |

### هدرهای rate limit

فقط در `POST /api/v1/posts`:

| هدر | توضیح |
|---|---|
| `X-RateLimit-Limit` | سقف درخواست در هر پنجره (وقتی Redis در دسترس باشد) |
| `X-RateLimit-Remaining` | سهمیه‌ی باقی‌مانده در پنجره‌ی فعلی |
| `Retry-After` | فقط در `429`: ثانیه تا پایان پنجره |

### اشیای پاسخ مشترک

**`PublicUser`** (فقط برای خود کاربر):

```json
{
  "id": "0b7c6a8e-4f0e-4c1a-9a51-2f3d4e5a6b7c",
  "username": "sample_user",
  "email": "sample_user@example.com",
  "createdAt": "2026-01-01T12:00:00.000Z"
}
```

**`PostResponse`**:

```json
{
  "id": "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b",
  "contentType": "text",
  "content": "hello world",
  "caption": "first",
  "createdAt": "2026-01-01T12:00:00.000Z",
  "author": { "id": "0b7c6a8e-4f0e-4c1a-9a51-2f3d4e5a6b7c", "username": "sample_user" },
  "totalComments": 2,
  "latestComment": {
    "id": "9a8b7c6d-5e4f-4321-8abc-def012345678",
    "text": "nice post",
    "createdAt": "2026-01-01T12:05:00.000Z",
    "author": { "id": "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f", "username": "another_user" }
  }
}
```

- `totalComments`: تعداد همه‌ی کامنت‌های پست، از جمله پاسخ‌ها
- `latestComment`: جدیدترین کامنت پست (سطح اول یا پاسخ)، یا `null`

**`CommentResponse`**:

```json
{
  "id": "9a8b7c6d-5e4f-4321-8abc-def012345678",
  "postId": "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b",
  "parentCommentId": null,
  "text": "nice post",
  "createdAt": "2026-01-01T12:05:00.000Z",
  "author": { "id": "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f", "username": "another_user" },
  "totalReplies": 0
}
```

- `totalReplies`: تعداد پاسخ‌های مستقیم

---

## Auth

### `POST /api/v1/auth/register`

| مورد | مقدار |
|---|---|
| دسترسی | عمومی |
| Guardها | ندارد |
| وضعیت موفق | `201 Created` |

**Body (`RegisterDto`):**

| فیلد | نوع | الزامی | قواعد |
|---|---|---|---|
| `username` | string | بله | پس از `trim` و `toLowerCase` باید با `^[a-z0-9_]{3,30}$` مطابقت داشته باشد. |
| `email` | string | بله | پس از `trim` و `toLowerCase` باید ایمیل معتبر و حداکثر ۲۵۴ کاراکتر باشد. |
| `password` | string | بله | بین ۸ و ۷۲ **بایت** |

```json
{ "username": "sample_user", "email": "sample_user@example.com", "password": "S0me-Passw0rd" }
```

**پاسخ موفق:**

```json
{ "user": { "id": "...", "username": "sample_user", "email": "sample_user@example.com", "createdAt": "..." } }
```

| خطا | علت |
|---|---|
| `400` | نقض قواعد بالا یا وجود فیلد اضافه (مثلاً `role`) |
| `409` | `Email is already in use` / `Username is already in use` / `Username or email is already in use` |

**نکته:** این endpoint توکن برنمی‌گرداند.

### `POST /api/v1/auth/login`

| مورد | مقدار |
|---|---|
| دسترسی | عمومی |
| وضعیت موفق | `200 OK` (با `@HttpCode(HttpStatus.OK)`) |

**Body (`LoginDto`):**

| فیلد | نوع | الزامی | قواعد |
|---|---|---|---|
| `email` | string | بله | `trim` و `toLowerCase`، ایمیل معتبر |
| `password` | string | بله | بین ۱ و ۷۲ بایت |

**پاسخ موفق:**

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": { "id": "...", "username": "sample_user", "email": "sample_user@example.com", "createdAt": "..." }
}
```

`expiresIn` برابر مقدار `JWT_EXPIRES_IN` بر حسب ثانیه است.

| خطا | علت |
|---|---|
| `400` | DTO نامعتبر |
| `401` | `Invalid credentials`، با پیام یکسان برای ایمیل ناموجود و رمز اشتباه |

### `GET /api/v1/auth/me`

| مورد | مقدار |
|---|---|
| دسترسی | احراز هویت‌شده |
| Guardها | `JwtAuthGuard` |
| وضعیت موفق | `200 OK` |

**پاسخ موفق:**

```json
{ "user": { "id": "...", "username": "sample_user", "email": "sample_user@example.com", "createdAt": "..." } }
```

| خطا | علت |
|---|---|
| `401` | نبود توکن، توکن نامعتبر یا منقضی، `sub` نامعتبر، یا کاربر حذف‌شده |

---

## Posts

### `POST /api/v1/posts`

| مورد | مقدار |
|---|---|
| دسترسی | احراز هویت‌شده |
| Guardها (به ترتیب) | `JwtAuthGuard` و سپس `PostCreateRateLimitGuard` |
| وضعیت موفق | `201 Created` |

**Body (`CreatePostDto`):**

| فیلد | نوع | الزامی | قواعد |
|---|---|---|---|
| `contentType` | `"text" \| "image" \| "video"` | خیر | پیش‌فرض `"text"` |
| `content` | string | بله | پس از `trim` غیرخالی و حداکثر ۵۰۰۰ کاراکتر |
| `caption` | string | خیر | پس از `trim` بین ۱ و ۵۰۰ کاراکتر |

```json
{ "content": "hello world", "caption": "first" }
```

**پاسخ موفق:** `PostResponse` (برای پست تازه `totalComments: 0` و `latestComment: null`)

**هدرها:** `X-RateLimit-Limit` و `X-RateLimit-Remaining`

| خطا | علت |
|---|---|
| `400` | DTO نامعتبر یا فیلد اضافه (مثلاً `authorId`) |
| `401` | توکن نامعتبر |
| `429` | `Too many posts created. Please try again later.` همراه با `Retry-After` |

**اثر جانبی:** generation کلید cache فید افزایش می‌یابد (`INCR posts:feed:v1:generation`).

**نکته‌ها:**
- `authorId` همیشه از JWT گرفته می‌شود.
- `contentType` فقط یک برچسب است. هیچ آپلود یا اعتبارسنجی رسانه‌ای وجود ندارد.
- درخواستی که در validation رد شود هم یک واحد از سهمیه را مصرف کرده است.

### `GET /api/v1/posts`

| مورد | مقدار |
|---|---|
| دسترسی | عمومی |
| Query | `page`، `limit` |
| وضعیت موفق | `200 OK` |

**پاسخ موفق:** `Paginated<PostResponse>`

```http
GET /api/v1/posts?page=1&limit=5
```

| خطا | علت |
|---|---|
| `400` | `page` یا `limit` نامعتبر، یا پارامتر query ناشناخته |

**نکته:** این تنها endpointی است که از cache در Redis استفاده می‌کند. ممکن است حداکثر تا `FEED_CACHE_TTL_SECONDS` ثانیه داده‌ی کهنه برگرداند، آن هم فقط وقتی invalidation شکست خورده باشد.

### `GET /api/v1/posts/:id`

| مورد | مقدار |
|---|---|
| دسترسی | عمومی |
| پارامتر | `id`: UUID نسخه‌ی ۴ (`ParseUUIDPipe`) |
| وضعیت موفق | `200 OK` |

**پاسخ موفق:** `PostResponse`

| خطا | علت |
|---|---|
| `400` | `Validation failed (uuid v 4 is expected)` |
| `404` | `Post not found` |

---

## Comments

### `POST /api/v1/posts/:postId/comments`

| مورد | مقدار |
|---|---|
| دسترسی | احراز هویت‌شده |
| Guardها | `JwtAuthGuard` |
| پارامتر | `postId`: UUID نسخه‌ی ۴ |
| وضعیت موفق | `201 Created` |

**Body (`CreateCommentDto`):**

| فیلد | نوع | الزامی | قواعد |
|---|---|---|---|
| `text` | string | بله | پس از `trim` غیرخالی و حداکثر ۲۰۰۰ کاراکتر |
| `parentCommentId` | string | خیر | UUID نسخه‌ی ۴. اگر ارسال شود، کامنت یک پاسخ است. |

```json
{ "text": "nice post" }
```

```json
{ "text": "thanks!", "parentCommentId": "9a8b7c6d-5e4f-4321-8abc-def012345678" }
```

**پاسخ موفق:** `CommentResponse`

| خطا | علت |
|---|---|
| `400` | UUID یا DTO نامعتبر، یا `Parent comment does not belong to this post` |
| `401` | توکن نامعتبر |
| `404` | `Post not found` یا `Parent comment not found` |

**اثر جانبی:** generation کلید cache فید افزایش می‌یابد، چون `totalComments` و `latestComment` تغییر کرده‌اند.

**نکته:** عمق پاسخ‌ها محدود نشده است. هر کامنت از همان پست، از جمله یک پاسخ، می‌تواند والد باشد.

### `GET /api/v1/posts/:postId/comments`

| مورد | مقدار |
|---|---|
| دسترسی | عمومی |
| پارامتر | `postId`: UUID نسخه‌ی ۴ |
| Query | `page`، `limit` |
| وضعیت موفق | `200 OK` |

**پاسخ موفق:** `Paginated<CommentResponse>`. فقط کامنت‌های **سطح اول** (`parentCommentId = null`) برگردانده می‌شوند.

| خطا | علت |
|---|---|
| `400` | UUID یا query نامعتبر |
| `404` | `Post not found` |

### `GET /api/v1/posts/:postId/comments/:commentId/replies`

| مورد | مقدار |
|---|---|
| دسترسی | عمومی |
| پارامترها | `postId` و `commentId`: هر دو UUID نسخه‌ی ۴ |
| Query | `page`، `limit` |
| وضعیت موفق | `200 OK` |

**پاسخ موفق:** `Paginated<CommentResponse>`. فقط پاسخ‌های **مستقیم** کامنت `commentId`.

| خطا | علت |
|---|---|
| `400` | UUID یا query نامعتبر |
| `404` | `Comment not found` (کامنت وجود ندارد یا به این پست تعلق ندارد) |

---

## Users

همه‌ی endpointهای این بخش عمومی‌اند و `email` را برنمی‌گردانند.

### `GET /api/v1/users/:userId/profile`

| مورد | مقدار |
|---|---|
| دسترسی | عمومی |
| پارامتر | `userId`: UUID نسخه‌ی ۴ |
| وضعیت موفق | `200 OK` |

**پاسخ موفق:**

```json
{
  "id": "0b7c6a8e-4f0e-4c1a-9a51-2f3d4e5a6b7c",
  "username": "sample_user",
  "createdAt": "2026-01-01T12:00:00.000Z",
  "stats": { "totalPosts": 1, "totalComments": 1 },
  "recentActivity": [
    {
      "type": "comment",
      "id": "9a8b7c6d-5e4f-4321-8abc-def012345678",
      "createdAt": "2026-01-01T12:05:00.000Z",
      "postId": "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b",
      "excerpt": "nice post"
    },
    {
      "type": "post",
      "id": "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b",
      "createdAt": "2026-01-01T12:00:00.000Z",
      "excerpt": "hello world",
      "caption": null
    }
  ]
}
```

- `recentActivity`: حداکثر ۵ مورد، ترکیبی از پست‌ها و کامنت‌ها با ترتیب جدیدترین اول.
- `excerpt`: حداکثر ۲۸۰ کاراکتر. اگر متن طولانی‌تر باشد، `…` به انتهای آن اضافه می‌شود.
- `stats.totalComments` شامل پاسخ‌ها هم هست.

| خطا | علت |
|---|---|
| `400` | UUID نامعتبر |
| `404` | `User not found` |

### `GET /api/v1/users/:userId/posts`

| مورد | مقدار |
|---|---|
| دسترسی | عمومی |
| Query | `page`، `limit` |
| وضعیت موفق | `200 OK` |

**پاسخ موفق:** `Paginated<PostResponse>` شامل همه‌ی پست‌های کاربر.

| خطا | علت |
|---|---|
| `400` | UUID یا query نامعتبر |
| `404` | `User not found` |

### `GET /api/v1/users/:userId/comments`

| مورد | مقدار |
|---|---|
| دسترسی | عمومی |
| Query | `page`، `limit` |
| وضعیت موفق | `200 OK` |

**پاسخ موفق:** `Paginated<CommentResponse>` شامل همه‌ی کامنت‌ها و پاسخ‌های کاربر در همه‌ی پست‌ها.

| خطا | علت |
|---|---|
| `400` | UUID یا query نامعتبر |
| `404` | `User not found` |

---

## Health

### `GET /api/v1/health` (liveness)

| مورد | مقدار |
|---|---|
| دسترسی | عمومی |
| وابستگی | ندارد |
| وضعیت موفق | `200 OK` |

```json
{ "status": "ok" }
```

### `GET /api/v1/health/ready` (readiness)

| مورد | مقدار |
|---|---|
| دسترسی | عمومی |
| بررسی | PostgreSQL با `SELECT 1` و timeout برابر ۱۵۰۰ میلی‌ثانیه |
| وضعیت موفق | `200 OK` |

```json
{
  "status": "ok",
  "info": { "database": { "status": "up" } },
  "error": {},
  "details": { "database": { "status": "up" } }
}
```

| خطا | علت |
|---|---|
| `503` | پایگاه داده در دسترس نیست. بدنه قالب واحد خطاست و `message` آن `Internal server error` است، چون `AllExceptionsFilter` پیام‌های ۵xx را پنهان می‌کند. |

Redis در readiness بررسی نمی‌شود.

---

## جدول خلاصه

| متد | مسیر | احراز هویت | Rate limit | Cache | موفق |
|---|---|---|---|---|---|
| POST | `/api/v1/auth/register` | - | - | - | 201 |
| POST | `/api/v1/auth/login` | - | - | - | 200 |
| GET | `/api/v1/auth/me` | Bearer | - | - | 200 |
| POST | `/api/v1/posts` | Bearer | بله | invalidation | 201 |
| GET | `/api/v1/posts` | - | - | بله | 200 |
| GET | `/api/v1/posts/:id` | - | - | - | 200 |
| POST | `/api/v1/posts/:postId/comments` | Bearer | - | invalidation | 201 |
| GET | `/api/v1/posts/:postId/comments` | - | - | - | 200 |
| GET | `/api/v1/posts/:postId/comments/:commentId/replies` | - | - | - | 200 |
| GET | `/api/v1/users/:userId/profile` | - | - | - | 200 |
| GET | `/api/v1/users/:userId/posts` | - | - | - | 200 |
| GET | `/api/v1/users/:userId/comments` | - | - | - | 200 |
| GET | `/api/v1/health` | - | - | - | 200 |
| GET | `/api/v1/health/ready` | - | - | - | 200 / 503 |
