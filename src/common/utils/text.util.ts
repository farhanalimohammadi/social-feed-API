export const EXCERPT_LENGTH = 280;

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;

// برش روی UTF-16 انجام می‌شود؛ اگر مرز برش وسط یک surrogate pair (مثل ایموجی) بیفتد، یک واحد عقب می‌رویم تا کاراکتر نصفه نماند
export function excerpt(text: string, maxLength: number = EXCERPT_LENGTH): string {
  if (text.length <= maxLength) return text;
  const end = isHighSurrogate(text.charCodeAt(maxLength - 1)) ? maxLength - 1 : maxLength;
  return `${text.slice(0, end)}…`;
}
