import type { PaginationMeta } from '../interfaces/paginated-response.interface.js';
//یک ابزارِ سبک و مستقل که محاسبات ریاضیِ صفحه‌بندی را متمرکز می‌کند

// به برنامه میگه چند رکورد رو برداره و چندتاشه رد کنه
export function toSkipTake(page: number, limit: number): { skip: number; take: number } {
  return { skip: (page - 1) * limit, take: limit };
}

//اینم که نمایش خروجی اسنادارد صفحه بندی هاس
export function buildMeta(page: number, limit: number, totalItems: number): PaginationMeta {
  return {
    currentPage: page,
    itemsPerPage: limit,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
  };
}