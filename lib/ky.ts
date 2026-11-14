import ky, { HTTPError, isHTTPError, type KyRequest } from "ky";

/**
 * The project's single HTTP client: a general-purpose requester not tied to any API server.
 *
 * - No `baseUrl`: callers pass an absolute URL or a same-origin path.
 * - No `credentials` (default `same-origin`): cookies are not sent cross-origin.
 *   Turn them on only at the call sites that need credentials.
 * - `retry: 0`: refetch and retry policy belongs to the caller (or the query layer).
 * - On the server, every response, retry and failure is logged (see `logResponse`).
 */
export const api = ky.create({
  retry: 0,
  hooks: {
    init: [
      (options) => {
        // Every hook gets a shallow copy of `context`, so this nested object is shared by all attempts of one call.
        if (IS_SERVER) options.context = { ...options.context, [TRACE]: { start: 0 } satisfies Trace };
      },
    ],
    beforeRequest: [({ request, options }) => markStart(request, options.context)],
    beforeRetry: [
      ({ request, options, error, retryCount }) => {
        if (IS_SERVER) {
          // An HTTP error was just logged in full by `afterResponse`, so the retry line only names the status.
          const status = cell(`RT#${retryCount}`, STATUS_WIDTH, "yellow");
          console.warn(
            isHTTPError(error)
              ? row(request, status, duration(options.context), "", `after ${error.response.status}`)
              : row(request, status, duration(options.context), "") + detail("why", errorLabel(error), "yellow"),
          );
        }
        markStart(request, options.context);
      },
    ],
    afterResponse: [({ request, options, response }) => logResponse(request, options.context, response)],
    beforeError: [
      ({ request, options, error }) => {
        // HTTP errors were already logged with their status in `afterResponse`; log timeouts and network failures here.
        if (IS_SERVER && !isHTTPError(error)) logFailure(request, options.context, error);
        if (!(error instanceof HTTPError)) return error;
        // ky v2 parses the body into `error.data` when it creates the HTTPError.
        // `error.response` has already been consumed here, so read `error.data`.
        const message = extractMessage(error.data);
        if (message) error.message = message;
        return error;
      },
    ],
  },
});

// --- Server-side request logging ---------------------------------------------------------------
// Only server code calls external APIs (the browser only calls this app's own routes), so logging is
// limited to the server, where it lands in the terminal (`pnpm dev`) or the deployment's function logs.
//
// Successes stay one line; errors, retries and failures add the detail needed to debug them. Every line has the
// same fixed-width columns, so consecutive calls line up:
//   [http] GET    206    781ms  382.5KB  https://…/level2_….fits
//   [http] POST   200     2.4s           https://gea.esac.esa.int/tap-server/tap/sync
//   [http] GET    502    163ms     341B  https://irsa.ipac.caltech.edu/SIA?…  text/html; charset=iso-8859-1
//                                got   502 Proxy Error … Reason: Error reading from remote server
//   [http] GET    RT#1   770ms           https://irsa.ipac.caltech.edu/SIA?…  after 502
//   [http] POST   FAIL   50.0s           https://gea.esac.esa.int/tap-server/tap/sync
//                                why   TimeoutError: Request timed out: POST …
//                                sent  REQUEST=doQuery&LANG=ADQL&…

const IS_SERVER = typeof window === "undefined";
/** ANSI colors only in development: production log viewers would show the escape codes as text. */
const USE_COLOR = IS_SERVER && process.env.NODE_ENV !== "production";
/** Longest URL and body preview printed, so a long TAP query or a large error page does not flood the log. */
const MAX_URL = 400;
const MAX_PREVIEW = 500;
const TEXT_TYPE = /^(text\/|application\/(json|xml|csv|[\w.+-]+\+(json|xml)))/i;

const TAG_TEXT = "[http]";
const METHOD_WIDTH = 6; // DELETE
const STATUS_WIDTH = 4; // 200, RT#1, FAIL
const DURATION_WIDTH = 7; // 12345ms, 12.3s
const SIZE_WIDTH = 8; // 1023.9KB
/** Column where the URL starts; detail lines (sent, got, why) indent to it. */
const URL_COLUMN = TAG_TEXT.length + 1 + METHOD_WIDTH + 1 + STATUS_WIDTH + 1 + DURATION_WIDTH + 1 + SIZE_WIDTH + 2;
const LABEL_WIDTH = 4;

const ANSI = {
  bold: 1,
  dim: 2,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  gray: 90,
} as const;
type Style = keyof typeof ANSI;

function paint(text: string, ...styles: Style[]): string {
  if (!USE_COLOR || styles.length === 0) return text;
  return `\x1b[${styles.map((s) => ANSI[s]).join(";")}m${text}\x1b[0m`;
}

/** Pads before painting, since escape codes would count toward the width. Numbers align right. */
function cell(text: string, width: number, color?: Style, alignRight = false): string {
  const padded = alignRight ? text.padStart(width) : text.padEnd(width);
  return color ? paint(padded, color, "bold") : padded;
}

const TAG = paint(TAG_TEXT, "cyan", "bold");
const METHOD_COLOR: Record<string, Style> = { GET: "blue", POST: "magenta", PUT: "yellow", PATCH: "yellow", DELETE: "red" };

function statusColor(status: number): Style {
  return status >= 500 ? "red" : status >= 400 ? "yellow" : status >= 300 ? "cyan" : "green";
}

/** One aligned log line: tag, method, status, duration, size, URL and an optional trailing note. */
function row(request: Request, status: string, time: string, size: string, note = ""): string {
  const method = cell(request.method, METHOD_WIDTH, METHOD_COLOR[request.method] ?? "gray");
  const sizeCell = paint(size.padStart(SIZE_WIDTH), "gray");
  const url = truncate(request.url, MAX_URL);
  return `${TAG} ${method} ${status} ${time} ${sizeCell}  ${url}${note ? `  ${paint(note, "gray")}` : ""}`;
}

/** A continuation line whose label ends just before the URL column, so its text lines up under the URL. */
function detail(label: string, text: string, color: Style): string {
  const indent = " ".repeat(URL_COLUMN - LABEL_WIDTH - 2);
  return `\n${indent}${paint(label.padEnd(LABEL_WIDTH), color)}  ${paint(text, "dim")}`;
}

/** Per-call log state kept in ky's `context`; ky builds a new `Request` for every retry, so it cannot key on that. */
const TRACE = "__httpTrace";
type Trace = { start: number; sent?: Promise<string> };
type Context = Record<string, unknown>;

function traceOf(context: Context): Trace | undefined {
  return context[TRACE] as Trace | undefined;
}

/** Restarts the clock for each attempt. */
function markStart(request: KyRequest, context: Context): void {
  const trace = traceOf(context);
  if (!trace) return;
  trace.start = performance.now();
  // A POST query (a TAP ADQL form, for example) lives in the body, so keep a preview of what was asked.
  if (request.body && !trace.sent) {
    trace.sent = request
      .clone()
      .text()
      .then(oneLine)
      .catch(() => "(unreadable)");
  }
}

/** Time since the attempt started, right-aligned; slow calls stand out in yellow (over 1 s) and red (over 5 s). */
function duration(context: Context): string {
  const trace = traceOf(context);
  if (!trace?.start) return " ".repeat(DURATION_WIDTH);
  const ms = Math.round(performance.now() - trace.start);
  const text = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  return paint(text.padStart(DURATION_WIDTH), ms >= 5000 ? "red" : ms >= 1000 ? "yellow" : "gray");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…(+${text.length - max} chars)` : text;
}

function oneLine(text: string): string {
  return truncate(text.replace(/\s+/g, " ").trim(), MAX_PREVIEW);
}

function errorLabel(error: Error): string {
  return `${error.name}: ${error.message}`;
}

/**
 * A success is one short line (method, status, time to the headers, size, URL); its body is never read.
 * A non-2xx response adds the detail needed to debug it: the content type, what was sent (POST bodies) and a preview
 * of the error body, read from a clone without blocking the caller, which reads the original.
 */
function logResponse(request: Request, context: Context, response: Response): void {
  if (!IS_SERVER) return;
  // Read the clock now, before the body arrives, so the next attempt cannot reset it first.
  const time = duration(context);
  const status = cell(String(response.status), STATUS_WIDTH, statusColor(response.status));
  if (response.ok) {
    const length = Number(response.headers.get("content-length"));
    console.info(row(request, status, time, length > 0 ? formatSize(length) : ""));
    return;
  }
  const type = response.headers.get("content-type") ?? "-";
  const log = response.status >= 500 ? console.error : console.warn;
  const color = statusColor(response.status);
  Promise.all([response.clone().arrayBuffer(), traceOf(context)?.sent])
    .then(([buffer, sent]) => {
      const asked = sent ? detail("sent", sent, "magenta") : "";
      const raw = TEXT_TYPE.test(type) ? new TextDecoder().decode(buffer) : "";
      // Proxy and gateway error pages are HTML; keep only their text so the reason is what shows.
      const text = raw ? oneLine(/html/i.test(type) ? raw.replace(/<!DOCTYPE[^>]*>|<[^>]+>/gi, " ") : raw) : "(binary body)";
      log(row(request, status, time, formatSize(buffer.byteLength), type) + asked + detail("got", text || "(empty body)", color));
    })
    .catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error);
      log(row(request, status, time, "?", type) + detail("why", `body not read: ${reason}`, color));
    });
}

/** A timeout or network failure: the reason and what was sent, since there is no response to show. */
function logFailure(request: Request, context: Context, error: Error): void {
  const line = row(request, cell("FAIL", STATUS_WIDTH, "red"), duration(context), "") + detail("why", errorLabel(error), "red");
  const sent = traceOf(context)?.sent;
  if (!sent) {
    console.error(line);
    return;
  }
  void sent.then((text) => console.error(line + detail("sent", text, "magenta")));
}

function extractMessage(data: unknown): string | undefined {
  if (typeof data === "string") return data || undefined;
  if (data && typeof data === "object") {
    // `message`, or an RFC 9457 Problem's `detail` / `title`.
    for (const key of ["message", "detail", "title"]) {
      const value = (data as Record<string, unknown>)[key];
      if (typeof value === "string" && value) return value;
    }
  }
  return undefined;
}

export type QueryParams = Record<string, string | number | boolean | undefined>;

/** Drops undefined and empty-string values so no empty query parameters are sent. */
function cleanParams(params?: QueryParams): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") out[key] = value;
  }
  return out;
}

export function apiGet<T>(url: string, searchParams?: QueryParams): Promise<T> {
  return api.get(url, { searchParams: cleanParams(searchParams) }).json<T>();
}

export function apiPost<T>(url: string, json?: unknown): Promise<T> {
  return api.post(url, json === undefined ? undefined : { json }).json<T>();
}

export function apiPut<T>(url: string, json?: unknown): Promise<T> {
  return api.put(url, json === undefined ? undefined : { json }).json<T>();
}

export function apiPatch<T>(url: string, json?: unknown): Promise<T> {
  return api.patch(url, json === undefined ? undefined : { json }).json<T>();
}

/** 204 No Content response: the body is not parsed. */
export async function apiDelete(url: string): Promise<void> {
  await api.delete(url);
}
