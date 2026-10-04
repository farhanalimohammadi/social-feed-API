# ۰۶ - پایگاه داده و Prisma

## پیکربندی پایگاه داده و driver adapter

پروژه از Prisma 7 با **driver adapter** برای PostgreSQL استفاده می‌کند. سه جزء در این کار نقش دارند:

| جزء | فایل | نقش |
|---|---|---|
| Generator | `prisma/schema.prisma` | `provider = "prisma-client"` و `output = "../src/generated/prisma"` |
| Datasource | `prisma/schema.prisma` | فقط `provider = "postgresql"`. URL در schema تعریف نشده است. |
| Prisma config | `prisma7.config.ts` | مسیر schema و migrationها، و `datasource.url = process.env.DATABASE_URL ?? ''` (پس از `import 'dotenv/config'`) |
| Runtime adapter | `src/infrastructure/prisma/prisma.service.ts` | `new PrismaPg({ connectionString: url })` که URL را از `ConfigService` می‌گیرد |

```ts
// prisma7.config.ts
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
```

نتیجه این است که CLI (برای migrate، generate و validate) آدرس را از `prisma7.config.ts` می‌گیرد و برنامه در زمان اجرا آدرس را از `DATABASE_URL` اعتبارسنجی‌شده در `ConfigService` می‌گیرد. همه‌ی اسکریپت‌های Prisma در `package.json` با `--config prisma7.config.ts` اجرا می‌شوند.

## چرخه‌ی عمر `PrismaService`

```ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService<AppConfig, true>) {
    const { url } = config.get('database', { infer: true });
    super({ adapter: new PrismaPg({ connectionString: url }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

- این سرویس در `PrismaModule` که `@Global()` است provide و export می‌شود.
- `enableShutdownHooks()` در `configureApp` باعث می‌شود هنگام دریافت سیگنال خاموشی، `onModuleDestroy` و در نتیجه `$disconnect()` اجرا شود.
- **رفتار مشاهده‌شده:** در اجرای محلی با `DATABASE_URL` که به پورت بسته اشاره داشت، برنامه بالا آمد و پیام `Database connection established` را لاگ کرد. یعنی در این ترکیب (Prisma 7 + `@prisma/adapter-pg`)، `$connect()` در startup ارتباط واقعی را تضمین نمی‌کند. خطای اتصال در اولین query ظاهر می‌شود (`500` در endpointها و `503` در readiness). بنابراین متن این لاگ را نباید به معنای تأیید اتصال در نظر گرفت.

## مدل‌های schema

### Enum: `ContentType`

```prisma
enum ContentType {
  text
  image
  video

  @@map("content_type")
}
```

در PostgreSQL به نوع `"content_type"` نگاشت می‌شود. پیش‌فرض ستون `posts.content_type` مقدار `text` است.

### مدل `User` (جدول `users`)

| فیلد Prisma | ستون | نوع | قیود |
|---|---|---|---|
| `id` | `id` | `UUID` | PK، `DEFAULT gen_random_uuid()` |
| `username` | `username` | `VARCHAR(30)` | `UNIQUE`، `CHECK` حروف کوچک |
| `email` | `email` | `VARCHAR(254)` | `UNIQUE`، `CHECK` حروف کوچک |
| `passwordHash` | `password_hash` | `VARCHAR(100)` | `NOT NULL` |
| `createdAt` | `created_at` | `TIMESTAMPTZ(3)` | `DEFAULT CURRENT_TIMESTAMP` |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ(3)` | با `@updatedAt` توسط Prisma مدیریت می‌شود و default پایگاه داده ندارد. |

روابط: `posts Post[]` و `comments Comment[]`.

### مدل `Post` (جدول `posts`)

| فیلد Prisma | ستون | نوع | قیود |
|---|---|---|---|
| `id` | `id` | `UUID` | PK، `gen_random_uuid()` |
| `authorId` | `author_id` | `UUID` | FK → `users(id)`، `ON DELETE RESTRICT` |
| `contentType` | `content_type` | `content_type` | `DEFAULT 'text'` |
| `content` | `content` | `TEXT` | `CHECK (btrim("content") <> '')` |
| `caption` | `caption` | `VARCHAR(500)` nullable | `CHECK ("caption" IS NULL OR btrim("caption") <> '')` |
| `createdAt` | `created_at` | `TIMESTAMPTZ(3)` | default `now` |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ(3)` | `@updatedAt` |

ستون `content` در پایگاه داده محدودیت طول ندارد (`TEXT`). سقف ۵۰۰۰ کاراکتری فقط در `CreatePostDto` اعمال می‌شود.

### مدل `Comment` (جدول `comments`)

| فیلد Prisma | ستون | نوع | قیود |
|---|---|---|---|
| `id` | `id` | `UUID` | PK |
| `postId` | `post_id` | `UUID` | FK → `posts(id)`، `RESTRICT` |
| `authorId` | `author_id` | `UUID` | FK → `users(id)`، `RESTRICT` |
| `parentCommentId` | `parent_comment_id` | `UUID` nullable | FK مرکب `(parent_comment_id, post_id)` → `comments(id, post_id)` |
| `text` | `text` | `TEXT` | `CHECK (btrim("text") <> '')` |
| `createdAt`، `updatedAt` | `created_at`، `updated_at` | `TIMESTAMPTZ(3)` | مثل جدول‌های دیگر |

قید اضافه: `@@unique([id, postId])` که در migration به `comments_id_post_id_key` تبدیل شده است.

## روابط

```text
users 1 ──── * posts        (posts.author_id → users.id, RESTRICT)
users 1 ──── * comments     (comments.author_id → users.id, RESTRICT)
posts 1 ──── * comments     (comments.post_id → posts.id, RESTRICT)
comments 1 ── * comments    (self-relation "CommentReplies":
                             (parent_comment_id, post_id) → (id, post_id), RESTRICT)
```

### خودارجاعی برای پاسخ‌ها

```prisma
parentComment Comment?  @relation("CommentReplies", fields: [parentCommentId, postId], references: [id, postId], onDelete: Restrict)
replies       Comment[] @relation("CommentReplies")
```

## جزئیات foreign key مرکب

SQL متناظر در migration اولیه:

```sql
CREATE UNIQUE INDEX "comments_id_post_id_key" ON "comments"("id", "post_id");

ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_post_id_fkey" FOREIGN KEY ("parent_comment_id", "post_id") REFERENCES "comments"("id", "post_id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

### چرا `(parent_comment_id, post_id)` جلوی پاسخ بین‌پستی را می‌گیرد؟

- یک FK ساده روی `parent_comment_id → comments(id)` فقط تضمین می‌کند که والد وجود دارد. در آن صورت پاسخی با `post_id = B` می‌توانست والدی از پست `A` داشته باشد.
- در FK مرکب، **جفت** `(parent_comment_id, post_id)` ردیف فرزند باید دقیقاً با جفت `(id, post_id)` یک کامنت موجود برابر باشد. چون `post_id` در هر دو طرف یک ستون مشترک است، والد و فرزند ناچار به یک پست تعلق دارند.
- FK مرکب به یک قید unique روی ستون‌های مقصد نیاز دارد. `@@unique([id, postId])` همین نقش را دارد. از نظر منطقی این قید زائد است، چون `id` خودش یکتاست، اما برای FK الزامی است.
- برای کامنت سطح اول، `parent_comment_id` برابر `NULL` است و طبق رفتار پیش‌فرض FK در PostgreSQL (`MATCH SIMPLE`)، وقتی یکی از ستون‌ها `NULL` باشد، قید بررسی نمی‌شود.
- `CommentsService.ensureParentBelongsToPost` همین قاعده را در لایه‌ی برنامه هم بررسی می‌کند تا پیام خوانا (`400`) برگرداند. قید پایگاه داده آخرین خط دفاعی است. اگر بررسی برنامه به دلیل باگ یا race دور زده شود، insert در پایگاه داده شکست می‌خورد. در کد فعلی، این خطای FK به کد HTTP خاصی نگاشت نشده و به `500` تبدیل می‌شود.

## رفتار `onDelete` و `onUpdate`

همه‌ی روابط `onDelete: Restrict` هستند و SQL تولیدشده `ON UPDATE CASCADE` دارد (پیش‌فرض Prisma).

| حذف | نتیجه |
|---|---|
| کاربری که پست یا کامنت دارد | رد می‌شود. تست `restricts deleting a user who still has posts` این را تأیید می‌کند. |
| پستی که کامنت دارد | رد می‌شود. |
| کامنتی که پاسخ دارد | رد می‌شود. |

در API فعلی هیچ endpoint حذفی وجود ندارد. `RESTRICT` تضمین می‌کند که حذف دستی یا حذف‌هایی که در آینده اضافه شوند، به‌صورت آبشاری و بی‌صدا تاریخچه را پاک نکنند.

## قیدهای Unique

| نام | ستون‌ها |
|---|---|
| `users_username_key` | `username` |
| `users_email_key` | `email` |
| `comments_id_post_id_key` | `(id, post_id)` |

نقض قیدهای `username` و `email` در `AuthService` از طریق کد `P2002` به `409` تبدیل می‌شود.

## قیدهای CHECK

این قیدها در migration دوم (`20261003211038_add_checks_and_partial_indexes`) و به‌صورت SQL دستی اضافه شده‌اند، چون schema در Prisma امکان تعریف `CHECK` را ندارد:

```sql
-- Users: normalized identifiers
ALTER TABLE "users"
  ADD CONSTRAINT "users_username_lowercase_chk" CHECK ("username" = lower("username")),
  ADD CONSTRAINT "users_email_lowercase_chk"    CHECK ("email" = lower("email"));

-- Posts: no blank content or caption
ALTER TABLE "posts"
  ADD CONSTRAINT "posts_content_not_blank_chk" CHECK (btrim("content") <> ''),
  ADD CONSTRAINT "posts_caption_not_blank_chk" CHECK ("caption" IS NULL OR btrim("caption") <> '');

-- Comments: no blank text, no self-parent
ALTER TABLE "comments"
  ADD CONSTRAINT "comments_text_not_blank_chk" CHECK (btrim("text") <> ''),
  ADD CONSTRAINT "comments_no_self_parent_chk" CHECK ("parent_comment_id" IS DISTINCT FROM "id");
```

استفاده از `IS DISTINCT FROM` باعث می‌شود مقدار `NULL` در `parent_comment_id` (کامنت سطح اول) مجاز باشد.

## Indexها

### Indexهای تعریف‌شده در schema (migration اولیه)

```sql
CREATE INDEX "posts_feed_idx" ON "posts"("created_at" DESC, "id" DESC);
CREATE INDEX "posts_author_idx" ON "posts"("author_id", "created_at" DESC, "id" DESC);
CREATE INDEX "comments_post_idx" ON "comments"("post_id", "created_at" DESC, "id" DESC);
CREATE INDEX "comments_author_idx" ON "comments"("author_id", "created_at" DESC, "id" DESC);
```

| Index | query هدف |
|---|---|
| `posts_feed_idx` | فید عمومی (`PostsService.findFeed`) |
| `posts_author_idx` | پست‌های یک کاربر (`findByAuthor`، پروفایل) |
| `comments_post_idx` | کامنت‌های یک پست، از جمله آخرین کامنت در `postReadSelect` |
| `comments_author_idx` | کامنت‌های یک کاربر (`findByAuthor`، پروفایل) |

### Indexهای جزئی (migration دستی)

```sql
CREATE INDEX "comments_top_level_idx"
  ON "comments" ("post_id", "created_at" DESC, "id" DESC)
  WHERE "parent_comment_id" IS NULL;

CREATE INDEX "comments_replies_idx"
  ON "comments" ("parent_comment_id", "created_at" DESC, "id" DESC)
  WHERE "parent_comment_id" IS NOT NULL;
```

| Index | query هدف |
|---|---|
| `comments_top_level_idx` | `findTopLevel` با شرط `{ postId, parentCommentId: null }` |
| `comments_replies_idx` | `findReplies` با شرط `{ postId, parentCommentId }` و همچنین شمارش `_count.replies` |

نکته‌ی صادقانه: `comments_top_level_idx` روی همان ستون‌های `comments_post_idx` تعریف شده، فقط با شرط جزئی. این دو index هم‌پوشانی دارند. در مخزن خروجی `EXPLAIN` یا benchmarkی که ضرورت هر دو را نشان دهد وجود ندارد.

Prisma در schema فعلی این indexهای جزئی را نمی‌شناسد. هنگام اجرای `prisma migrate dev` در آینده باید مراقب بود که Prisma پیشنهاد حذف آن‌ها را ندهد. migration تولیدشده را همیشه پیش از اعمال بازبینی کنید.

## مرتب‌سازی `createdAt DESC, id DESC`

همه‌ی لیست‌ها با یک ترتیب یکسان مرتب می‌شوند:

```ts
orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
```

این ترتیب در `PostsService`، در `NEWEST_FIRST` درون `CommentsService` و `UsersService`، در `postReadSelect` (برای آخرین کامنت) و در `compareNewestFirst` در `users.mapper.ts` به کار رفته است.

**چرا `id` به‌عنوان tie-breaker؟** دقت `created_at` میلی‌ثانیه است (`TIMESTAMPTZ(3)`) و دو ردیف می‌توانند زمان یکسان داشته باشند. بدون کلید دوم یکتا، ترتیب ردیف‌های هم‌زمان در PostgreSQL تضمین‌شده نیست و در صفحه‌بندی offset ممکن است ردیفی در دو صفحه تکرار شود یا اصلاً دیده نشود. افزودن `id` که یکتاست، ترتیب را **قطعی (deterministic)** می‌کند. indexها هم دقیقاً با همین ترتیب (`created_at DESC, id DESC`) ساخته شده‌اند.

## راهبرد select صریح

هیچ query خواندنی بدون `select` نام‌دار اجرا نمی‌شود:

| select | فایل | فیلدها |
|---|---|---|
| `publicUserSelect` | `auth.select.ts` | `id`، `username`، `email`، `createdAt` |
| `postReadSelect` | `posts.select.ts` | فیلدهای پست، `author { id, username }`، `comments` (۱ مورد آخر)، `_count.comments` |
| `commentReadSelect` | `comments.select.ts` | فیلدهای کامنت، `author`، `_count.replies` |
| `profileUserSelect` | `users.select.ts` | `id`، `username`، `createdAt`، `_count.posts`، `_count.comments` |
| `recentPostSelect` | `users.select.ts` | `id`، `content`، `caption`، `createdAt` |
| `recentCommentSelect` | `users.select.ts` | `id`، `postId`، `text`، `createdAt` |

همه با `satisfies Prisma.XSelect` تعریف شده‌اند. بنابراین هم نام فیلدها در زمان کامپایل بررسی می‌شود و هم نوع literal حفظ می‌شود تا `GetPayload` نوع دقیق ردیف را تولید کند. queryهای کمکی که فقط وجود یک ردیف را بررسی می‌کنند هم `select: { id: true }` یا `select: { postId: true }` دارند.

## راهبرد `_count`

- `totalComments` در پاسخ پست از `_count.comments` می‌آید. این عدد **همه‌ی کامنت‌های پست، از جمله پاسخ‌ها** را می‌شمارد.
- `totalReplies` در پاسخ کامنت از `_count.replies` می‌آید و فقط فرزندان مستقیم را می‌شمارد.
- `stats.totalPosts` و `stats.totalComments` در پروفایل از `_count.posts` و `_count.comments` کاربر می‌آیند.

شمارنده‌ی denormalized در جدول‌ها وجود ندارد. بنابراین شمارش‌ها همیشه با داده‌ی واقعی سازگارند و در ازای آن، هزینه‌ی شمارش در هر خواندن پرداخت می‌شود. برای فید، cache در Redis این هزینه را کاهش می‌دهد.

## جلوگیری از N+1

- `postReadSelect` نویسنده، آخرین کامنت به‌همراه نویسنده‌اش، و شمارش کامنت‌ها را در **همان فراخوانی Prisma** که لیست پست‌ها را برمی‌گرداند، واکشی می‌کند. هیچ حلقه‌ای در کد برای هر پست یک query جداگانه نمی‌زند.
- `commentReadSelect` هم به همین شکل author و `_count.replies` را شامل می‌شود.
- اینکه Prisma این ساختار تودرتو را به چند دستور SQL تبدیل کند به راهبرد داخلی Prisma بستگی دارد. اما تعداد queryها به تعداد ردیف‌ها وابسته نیست.
- `count` و `findMany` در صفحه‌بندی با `Promise.all` به‌صورت موازی اجرا می‌شوند. این دو در یک تراکنش نیستند، پس زیر بار نوشتن هم‌زمان ممکن است `totalItems` با `data` اختلاف جزئی داشته باشد.

## چرخه‌ی عمر migration

| مرحله | دستور | توضیح |
|---|---|---|
| توسعه | `npm run prisma:migrate:dev` | ساخت migration جدید از تغییرات schema و اعمال آن روی پایگاه داده‌ی `DATABASE_URL` |
| استقرار | `npm run prisma:migrate:deploy` | فقط اعمال migrationهای موجود، بدون تولید migration جدید |
| پایگاه داده‌ی تست | `npm run db:test:migrate` | `.env` را بارگذاری می‌کند، `DATABASE_URL` را با `DATABASE_URL_TEST` جایگزین می‌کند و `prisma migrate deploy` را اجرا می‌کند |
| تولید کلاینت | `npm run prisma:generate` | تولید کلاینت در `src/generated/prisma` |
| اعتبارسنجی | `npm run prisma:validate` | بررسی درستی schema |

در CI ترتیب این است: `prisma:generate`، سپس `prisma:validate`، سپس `db:test:migrate`.

## قواعد تغییر امن migrationها

1. **migrationهای اعمال‌شده را ویرایش نکنید.** Prisma برای هر migration یک checksum نگه می‌دارد. ویرایش migration قدیمی باعث ناسازگاری با پایگاه داده‌هایی می‌شود که قبلاً آن را اعمال کرده‌اند.
2. هر تغییر باید یک migration جدید با timestamp جدید باشد.
3. قیدهای `CHECK` و indexهای جزئی فقط در SQL دستی وجود دارند. پس از `migrate dev` بررسی کنید که migration تولیدشده آن‌ها را حذف نکرده باشد.
4. `migration_lock.toml` را دستی ویرایش نکنید.
5. پس از تغییر schema، `prisma:generate` را اجرا کنید و `typecheck` و تست‌ها را دوباره اجرا کنید. چون انواع ردیف از selectها مشتق می‌شوند، ناسازگاری‌ها در زمان کامپایل آشکار می‌شوند.
6. migration جدید را با `db:test:migrate` روی پایگاه داده‌ی تست اعمال کنید و `npm run test:int` را اجرا کنید.

## تست‌های یکپارچگی پایگاه داده

فایل `test/database/schema.int-spec.ts` قیدها را مستقیماً روی PostgreSQL واقعی تست می‌کند. این تست از Service عبور نمی‌کند، پس قیدهای خود پایگاه داده آزموده می‌شوند:

| تست | قید آزموده‌شده |
|---|---|
| `rejects a reply whose parent belongs to another post` | FK مرکب `comments_parent_comment_id_post_id_fkey` |
| `accepts a reply whose parent belongs to the same post` | مسیر مجاز همان FK |
| `rejects a comment that is its own parent` | `comments_no_self_parent_chk` |
| `rejects blank post content and blank comment text` | `posts_content_not_blank_chk` و `comments_text_not_blank_chk` |
| `rejects non-lowercase username and email` | `users_username_lowercase_chk` و `users_email_lowercase_chk` |
| `rejects duplicate username or email` | `users_username_key` (این تست عملاً نام کاربری تکراری با ایمیل متفاوت را می‌آزماید) |
| `restricts deleting a user who still has posts` | `ON DELETE RESTRICT` در `posts_author_id_fkey` |

قید `posts_caption_not_blank_chk` و قید unique ایمیل به‌تنهایی، تست Integration مستقیم ندارند.
