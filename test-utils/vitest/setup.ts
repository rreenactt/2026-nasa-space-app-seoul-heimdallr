import { beforeEach, vi } from "vitest";

/**
 * Runs before every Vitest test file (setupFiles in vitest.config.mts).
 *
 * - `cookies()` from `next/headers` returns the cookies set with `setRequestCookies()`; `headers()` is empty.
 * - Server error and warning logs are silenced; read them with `loggedErrors()` and `loggedWarnings()`.
 */
let requestCookies: { name: string; value: string }[] = [];

/** Cookies sent with the request in the current test. Cleared before each test. */
export function setRequestCookies(cookies: { name: string; value: string }[]): void {
  requestCookies = cookies;
}

/** Error log records (`lib/server/logger.ts`) written in the current test, parsed from their JSON lines. */
export function loggedErrors(): Record<string, unknown>[] {
  return vi.mocked(console.error).mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>);
}

/** Warning log records written in the current test, like `loggedErrors()`. */
export function loggedWarnings(): Record<string, unknown>[] {
  return vi.mocked(console.warn).mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>);
}

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => requestCookies, set: () => {} }),
  headers: async () => new Headers(),
}));

beforeEach(() => {
  requestCookies = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
