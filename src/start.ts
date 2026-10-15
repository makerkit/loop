import { createMiddleware, createStart } from "@tanstack/react-start";

import { getPageSessionToken } from "#/lib/security/page-session-token";
import { SESSION_HEADER, checkRequest } from "#/lib/security/request-guard";
import { getSessionConfig } from "#/lib/security/session.server";

/**
 * Runs on every request to Loop's server: pages, server functions and
 * server routes, read-only or not. See request-guard.ts.
 */
const requestGuard = createMiddleware().server(async ({ next, request, handlerType }) => {
  const check = checkRequest(
    { url: request.url, headers: request.headers, handlerType },
    getSessionConfig(),
  );

  if (check.type === "reject") {
    return new Response(
      handlerType === "router" ? "Open Loop from the link in your terminal." : check.reason,
      {
        status: check.status,
        headers: { "content-type": "text/plain; charset=utf-8", ...SECURITY_HEADERS },
      },
    );
  }

  if (check.type === "redirect") {
    return new Response(null, {
      status: 302,
      headers: {
        location: check.location,
        "set-cookie": check.setCookie,
        "cache-control": "no-store",
        ...SECURITY_HEADERS,
      },
    });
  }

  const result = await next();

  // Server function results have no response object at this point; the headers matter for pages
  if (result.response) {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      result.response.headers.set(name, value);
    }
  }

  return result;
});

const SECURITY_HEADERS = {
  // Other websites must not frame Loop (clickjacking)
  "x-frame-options": "DENY",
  "content-security-policy": "frame-ancestors 'none'",
  // Never leak the URL (it may contain the token) to other sites
  "referrer-policy": "no-referrer",
};

export const startInstance = createStart(() => ({
  // Replaces Start's default CSRF middleware: the guard checks Host, Origin and the token
  requestMiddleware: [requestGuard],
  serverFns: {
    // Client side only: send the session token with every server function call
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);

      headers.set(SESSION_HEADER, getPageSessionToken());

      return fetch(input, { ...init, headers });
    },
  },
}));
