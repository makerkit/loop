import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts so tests don't load the app's plugins (Start, Nitro, devtools)
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
