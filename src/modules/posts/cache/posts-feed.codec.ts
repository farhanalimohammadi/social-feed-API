import type { Paginated } from '../../../common/interfaces/paginated-response.interface.js';
import type { AuthorSummary, LatestComment, PostResponse } from '../posts.mapper.js';
//خاوندن اطلاعات لیست پست ها از ردیس 
//چون اطلاعت در ردیس تبدیل به متن ساده میشن و تمام کلاسا و تایپا از بین میرن ما اینجا وظیفه داریم اونا رو دوباره به حالت یه شی در بیاریم 


// صفحه بندی و پست ها 
export type FeedPage = Paginated<PostResponse>;


// بررسی نوع داده ای که دریافت شده
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function reviveDate(v: unknown): Date | null {
  if (!isString(v)) return null;
  const date = new Date(v);
  return Number.isNaN(date.getTime()) ? null : date;
}


//یررسی اطلاعات نویسنده اگر هر مشکلی وجود داشت فورا نال بر میگیردونه
function parseAuthor(v: unknown): AuthorSummary | null {
  if (!isRecord(v) || !isString(v.id) || !isString(v.username)) return null;
  return { id: v.id, username: v.username };
}


//اینجا هم دقیقا کامنت رو چک میکنه که ایرادی نداشته باشه
function parseLatestComment(v: unknown): LatestComment | null {
  if (!isRecord(v)) return null;
  const createdAt = reviveDate(v.createdAt);
  const author = parseAuthor(v.author);
  if (!isString(v.id) || !isString(v.text) || !createdAt || !author) return null;
  return { id: v.id, text: v.text, createdAt, author };
}

function parsePost(v: unknown): PostResponse | null {
  if (!isRecord(v)) return null;
  const createdAt = reviveDate(v.createdAt);
  const author = parseAuthor(v.author);
  //پست میتونه کامنت یا کپشن نداشته باشه  پس نال بود اروری نخواهد و اگرم نبود اون جزئیات رو نمایش میده طبق قوانینی که تعریف کردیم
  const latestComment = v.latestComment === null ? null : parseLatestComment(v.latestComment);
  const captionOk = v.caption === null || isString(v.caption);

  // کل فیلد های ضروری یه پست رو بررسی میکنه در نهایت اگر حتی یکیشون مشکلی نداشت کل پستو دور می اندازه تا برنامه رو خراب نکنه اگرم کشلی نداشته بی چنو چرا یعنی هیچ مشکلی نداره
  if (
    !isString(v.id) || !isString(v.contentType) || !isString(v.content) ||
    !captionOk || !createdAt || !author || !isNumber(v.totalComments) ||
    (v.latestComment !== null && latestComment === null)
  ) {
    return null;
  }
  return {
    id: v.id,
    contentType: v.contentType,
    content: v.content,
    caption: v.caption as string | null,
    createdAt,
    author,
    totalComments: v.totalComments,
    latestComment,
  };
}


// تلاش میکنه متن رو به یه شی تبدیل کنه 
//اگرم ساختار جیشون نداشته باشه کلا کرش نمیکنه بلکهنال میشه فقط 
export function parseFeedPage(raw: string): FeedPage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || !Array.isArray(value.data) || !isRecord(value.meta)) return null;

  const { currentPage, itemsPerPage, totalItems, totalPages } = value.meta;
  if (![currentPage, itemsPerPage, totalItems, totalPages].every(isNumber)) return null;

  const data: PostResponse[] = [];
  for (const item of value.data) {
    const post = parsePost(item);
    if (!post) return null;
    data.push(post);
  }
  return {
    data,
    meta: {
      currentPage: currentPage as number,
      itemsPerPage: itemsPerPage as number,
      totalItems: totalItems as number,
      totalPages: totalPages as number,
    },
  };
}