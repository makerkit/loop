import { describe, expect, it } from "vitest";

import {
  SESSION_HEADER,
  checkRequest,
  sessionCookieName,
  type GuardedRequest,
} from "./request-guard";

const config = { token: "secret-token-abc", port: 3000 };
const cookie = `${sessionCookieName(3000)}=${config.token}`;

function request(
  handlerType: GuardedRequest["handlerType"],
  headers: Record<string, string>,
  url = "http://127.0.0.1:3000/",
): GuardedRequest {
  return { url, headers: new Headers(headers), handlerType };
}

describe("checkRequest: Host", () => {
  it.each(["127.0.0.1:3000", "localhost:3000", "LOCALHOST:3000"])("allows %s", (host) => {
    const result = checkRequest(
      request("serverFn", { host, [SESSION_HEADER]: config.token }),
      config,
    );

    expect(result).toEqual({ type: "allow" });
  });

  it.each(["evil.com:3000", "127.0.0.1:3001", "localhost", "127.0.0.1", "[::1]:3000", ""])(
    "rejects %s",
    (host) => {
      const result = checkRequest(
        request("serverFn", { host, [SESSION_HEADER]: config.token }),
        config,
      );

      expect(result).toMatchObject({ type: "reject", status: 403 });
    },
  );

  it("rejects a missing Host", () => {
    const result = checkRequest(request("serverFn", { [SESSION_HEADER]: config.token }), config);

    expect(result).toMatchObject({ type: "reject", reason: "Host not allowed" });
  });

  it("ignores the host in the request URL (DNS rebinding)", () => {
    const result = checkRequest(
      request(
        "serverFn",
        { host: "evil.com:3000", origin: "http://evil.com:3000", [SESSION_HEADER]: config.token },
        "http://evil.com:3000/_serverFn/abc",
      ),
      config,
    );

    expect(result).toMatchObject({ type: "reject", reason: "Host not allowed" });
  });
});

describe("checkRequest: Origin", () => {
  it("allows a request without Origin", () => {
    const result = checkRequest(request("router", { host: "127.0.0.1:3000", cookie }), config);

    expect(result).toEqual({ type: "allow" });
  });

  it.each(["http://127.0.0.1:3000", "http://localhost:3000"])("allows Origin %s", (origin) => {
    const result = checkRequest(
      request("serverFn", { host: "127.0.0.1:3000", origin, [SESSION_HEADER]: config.token }),
      config,
    );

    expect(result).toEqual({ type: "allow" });
  });

  it.each([
    "http://evil.com",
    "http://localhost:5173",
    "https://127.0.0.1:3000",
    "http://127.0.0.1:3000.evil.com",
    "null",
  ])("rejects Origin %s", (origin) => {
    const result = checkRequest(
      request("serverFn", { host: "127.0.0.1:3000", origin, [SESSION_HEADER]: config.token }),
      config,
    );

    expect(result).toMatchObject({ type: "reject", reason: "Origin not allowed" });
  });

  it("rejects a foreign Origin on page requests even with a valid cookie", () => {
    const result = checkRequest(
      request("router", { host: "127.0.0.1:3000", origin: "http://evil.com", cookie }),
      config,
    );

    expect(result).toMatchObject({ type: "reject", reason: "Origin not allowed" });
  });
});

describe("checkRequest: server functions", () => {
  it("rejects a call without the token header", () => {
    const result = checkRequest(request("serverFn", { host: "127.0.0.1:3000" }), config);

    expect(result).toMatchObject({ type: "reject", reason: "Missing or invalid session token" });
  });

  it("rejects a wrong token", () => {
    for (const token of ["wrong", "secret-token-ab", "secret-token-abcd", ""]) {
      const result = checkRequest(
        request("serverFn", { host: "127.0.0.1:3000", [SESSION_HEADER]: token }),
        config,
      );

      expect(result).toMatchObject({ type: "reject" });
    }
  });

  it("does not accept the cookie in place of the header", () => {
    const result = checkRequest(request("serverFn", { host: "127.0.0.1:3000", cookie }), config);

    expect(result).toMatchObject({ type: "reject" });
  });

  it("does not accept the token in the query string", () => {
    const result = checkRequest(
      request(
        "serverFn",
        { host: "127.0.0.1:3000" },
        `http://127.0.0.1:3000/_serverFn/abc?token=${config.token}`,
      ),
      config,
    );

    expect(result).toMatchObject({ type: "reject" });
  });
});

describe("checkRequest: pages (read-only requests)", () => {
  it("rejects a page request without the cookie", () => {
    const result = checkRequest(request("router", { host: "127.0.0.1:3000" }), config);

    expect(result).toMatchObject({ type: "reject", status: 403 });
  });

  it("rejects a wrong cookie", () => {
    const result = checkRequest(
      request("router", { host: "127.0.0.1:3000", cookie: `${sessionCookieName(3000)}=nope` }),
      config,
    );

    expect(result).toMatchObject({ type: "reject" });
  });

  it("rejects a cookie set for another port", () => {
    const result = checkRequest(
      request("router", {
        host: "127.0.0.1:3000",
        cookie: `${sessionCookieName(4000)}=${config.token}`,
      }),
      config,
    );

    expect(result).toMatchObject({ type: "reject" });
  });

  it("does not accept the header in place of the cookie", () => {
    const result = checkRequest(
      request("router", { host: "127.0.0.1:3000", [SESSION_HEADER]: config.token }),
      config,
    );

    expect(result).toMatchObject({ type: "reject" });
  });

  it("allows a valid cookie among others", () => {
    const result = checkRequest(
      request("router", { host: "localhost:3000", cookie: `a=1; ${cookie}; b=2` }),
      config,
    );

    expect(result).toEqual({ type: "allow" });
  });
});

describe("checkRequest: launch URL", () => {
  it("sets the cookie and redirects without the token", () => {
    const result = checkRequest(
      request(
        "router",
        { host: "127.0.0.1:3000" },
        `http://127.0.0.1:3000/prds?token=${config.token}&tab=stories#top`,
      ),
      config,
    );

    expect(result).toEqual({
      type: "redirect",
      location: "/prds?tab=stories#top",
      setCookie: `${sessionCookieName(3000)}=${config.token}; Path=/; HttpOnly; SameSite=Strict`,
    });
  });

  it("rejects a wrong token in the URL even with a valid cookie", () => {
    const result = checkRequest(
      request("router", { host: "127.0.0.1:3000", cookie }, "http://127.0.0.1:3000/?token=nope"),
      config,
    );

    expect(result).toMatchObject({ type: "reject" });
  });

  it("checks Host before accepting the launch URL", () => {
    const result = checkRequest(
      request("router", { host: "evil.com:3000" }, `http://evil.com:3000/?token=${config.token}`),
      config,
    );

    expect(result).toMatchObject({ type: "reject", reason: "Host not allowed" });
  });
});

describe("checkRequest: configuration", () => {
  it("rejects everything when the token is empty", () => {
    const result = checkRequest(
      request("serverFn", { host: "127.0.0.1:3000", [SESSION_HEADER]: "" }),
      { token: "", port: 3000 },
    );

    expect(result).toMatchObject({ type: "reject" });
  });
});
