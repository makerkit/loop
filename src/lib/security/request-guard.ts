/**
 * Decides whether a request may reach Loop's server.
 *
 * Any website open in the browser can send requests to localhost (cross-site
 * requests, DNS rebinding), so every request must:
 * - be addressed to 127.0.0.1:<port> or localhost:<port> (Host)
 * - come from that same address when the browser says where it came from (Origin)
 * - carry the session token generated at launch
 *
 * Server function calls carry the token in a header, which other websites
 * cannot set without a CORS preflight Loop never answers. Page requests carry
 * it in an HttpOnly cookie, set the first time the user opens the launch URL
 * (`/?token=...`).
 *
 * Pure: no framework or Node imports, so it can be unit-tested and shared.
 */

export const SESSION_HEADER = "x-loop-session";
export const SESSION_QUERY_PARAM = "token";

export interface RequestGuardConfig {
  /** The random session token generated at launch. */
  token: string;
  /** The port Loop is listening on. Never derived from the request. */
  port: number;
}

export interface GuardedRequest {
  /** The full request URL. Only its path and query are used. */
  url: string;
  headers: Headers;
  handlerType: "serverFn" | "router";
}

export type RequestGuardResult =
  | { type: "allow" }
  | { type: "reject"; status: 403; reason: string }
  | { type: "redirect"; location: string; setCookie: string };

export function sessionCookieName(port: number) {
  return `loop_session_${port}`;
}

export function getAllowedHosts(port: number) {
  return [`127.0.0.1:${port}`, `localhost:${port}`];
}

export function getAllowedOrigins(port: number) {
  return getAllowedHosts(port).map((host) => `http://${host}`);
}

export function checkRequest(
  request: GuardedRequest,
  config: RequestGuardConfig,
): RequestGuardResult {
  const host = request.headers.get("host")?.trim().toLowerCase();

  if (!host || !getAllowedHosts(config.port).includes(host)) {
    return reject("Host not allowed");
  }

  const origin = request.headers.get("origin");

  // A present Origin must match exactly; this includes the opaque "null" origin
  if (origin !== null && !getAllowedOrigins(config.port).includes(origin.toLowerCase())) {
    return reject("Origin not allowed");
  }

  if (request.handlerType === "serverFn") {
    return safeEqual(request.headers.get(SESSION_HEADER), config.token)
      ? { type: "allow" }
      : reject("Missing or invalid session token");
  }

  const url = new URL(request.url);
  const queryToken = url.searchParams.get(SESSION_QUERY_PARAM);

  if (queryToken !== null) {
    if (!safeEqual(queryToken, config.token)) {
      return reject("Missing or invalid session token");
    }

    url.searchParams.delete(SESSION_QUERY_PARAM);

    return {
      type: "redirect",
      // Relative, so the redirect never depends on the Host header
      location: `${url.pathname}${url.search}${url.hash}`,
      setCookie: serializeSessionCookie(config),
    };
  }

  const cookieToken = readCookie(request.headers.get("cookie"), sessionCookieName(config.port));

  return safeEqual(cookieToken, config.token)
    ? { type: "allow" }
    : reject("Missing or invalid session token");
}

function reject(reason: string): RequestGuardResult {
  return { type: "reject", status: 403, reason };
}

function serializeSessionCookie(config: RequestGuardConfig) {
  // No `Secure`: Loop is served over plain http on 127.0.0.1
  return `${sessionCookieName(config.port)}=${encodeURIComponent(config.token)}; Path=/; HttpOnly; SameSite=Strict`;
}

function readCookie(header: string | null, name: string) {
  if (!header) {
    return null;
  }

  for (const part of header.split(";")) {
    const index = part.indexOf("=");

    if (index === -1) {
      continue;
    }

    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Constant-time string comparison, so the token cannot be guessed from
 * response timing.
 */
function safeEqual(value: string | null | undefined, expected: string) {
  if (typeof value !== "string" || expected.length === 0) {
    return false;
  }

  let diff = value.length ^ expected.length;

  for (let i = 0; i < expected.length; i++) {
    diff |= (value.charCodeAt(i) || 0) ^ expected.charCodeAt(i);
  }

  return diff === 0;
}
