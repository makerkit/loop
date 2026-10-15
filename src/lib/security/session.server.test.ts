import { describe, expect, it } from "vitest";

import { getSessionConfig } from "./session.server";

describe("getSessionConfig", () => {
  it("reads the token once and removes it from the environment", () => {
    process.env.LOOP_SESSION_TOKEN = "launcher-token";
    process.env.LOOP_PORT = "4321";

    expect(getSessionConfig()).toEqual({ token: "launcher-token", port: 4321 });
    // Commands Loop runs (git, project scripts) inherit the environment
    expect(process.env.LOOP_SESSION_TOKEN).toBeUndefined();
    expect(getSessionConfig().token).toBe("launcher-token");
  });
});
