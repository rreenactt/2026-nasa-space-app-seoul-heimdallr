import "server-only";

import { cookies } from "next/headers";
import { DEFAULT_LOCALE, format, isLocale, type Locale, LOCALE_COOKIE } from "./locale";
import type { MessageKey } from "./message-keys";
import { en, ko, type Messages } from "./messages";

/** The language from the cookie, English when there is none or it is not one we offer. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Only the chosen language's text is sent to the browser. */
export function getMessages(locale: Locale): Messages {
  return locale === "ko" ? ko : en;
}

/** `t` for Server Components. */
export async function getT() {
  const messages = getMessages(await getLocale());
  return (key: MessageKey, values?: Record<string, string | number>) => format(messages[key], values);
}
