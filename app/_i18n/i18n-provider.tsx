"use client";

import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";
import { format, type Locale, LOCALE_COOKIE } from "./locale";
import type { MessageKey } from "./message-keys";

type I18n = { locale: Locale; messages: Record<MessageKey, string> };

const I18nContext = createContext<I18n | null>(null);

/** Gives client components the language the root layout chose (from the cookie) and its text. */
export function I18nProvider({ locale, messages, children }: I18n & { children: ReactNode }) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useT and useLocale need I18nProvider (app/layout.tsx)");
  return value;
}

/** `t("nav.sky")`, `t("starGuide.since", { year: 1999 })`. Pass `t` into canvas painters that draw text. */
export function useT() {
  const { messages } = useI18n();
  return useCallback((key: MessageKey, values?: Record<string, string | number>) => format(messages[key], values), [messages]);
}

export type Translate = ReturnType<typeof useT>;

/** The current language and a setter that stores it in the cookie and re-renders the page in place. */
export function useLocale() {
  const { locale } = useI18n();
  const router = useRouter();
  const setLocale = useCallback(
    (next: Locale) => {
      // One year; Lax so it is sent on normal navigation. Not sensitive, so readable by scripts.
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    },
    [router],
  );
  return { locale, setLocale };
}
