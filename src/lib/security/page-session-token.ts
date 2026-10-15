import { createIsomorphicFn } from "@tanstack/react-start";

import { getSessionConfig } from "./session.server";

export const SESSION_META_NAME = "loop-session";

/**
 * The session token as the page knows it. The server renders it into a meta
 * tag (only after the request passed the guard); the browser reads it back so
 * server function calls can send it in a header.
 *
 * The token is never put in a JS-readable cookie: cookies are not scoped by
 * port, so a page on another localhost port could read it.
 */
export const getPageSessionToken = createIsomorphicFn()
  .server(() => getSessionConfig().token)
  .client(
    () =>
      document.querySelector<HTMLMetaElement>(`meta[name="${SESSION_META_NAME}"]`)?.content ?? "",
  );
