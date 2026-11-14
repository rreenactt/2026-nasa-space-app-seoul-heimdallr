import { type NextRequest, NextResponse } from "next/server";
import { contentSecurityPolicy } from "@/lib/csp";
import { REQUEST_ID_HEADER } from "@/lib/server/logger";

export function proxy(request: NextRequest) {
  // Build the CSP with a fresh nonce per request. Next.js rendering (script nonces) and the root layout (`x-nonce`) read the request headers.
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce, request.nextUrl.pathname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  // A fresh ID per request for the server logs; it replaces any value the client sent and is not returned.
  requestHeaders.set(REQUEST_ID_HEADER, crypto.randomUUID());

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Every path except static files, image optimization, the favicon, and image extensions.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
