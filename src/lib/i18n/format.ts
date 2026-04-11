import { APP_LOCALE } from "@/lib/i18n/messages";

export function formatDate(value: string | Date, locale: string = APP_LOCALE) {
  return new Date(value).toLocaleDateString(locale);
}

export function formatDateTime(value: string | Date, locale: string = APP_LOCALE) {
  return new Date(value).toLocaleString(locale);
}
