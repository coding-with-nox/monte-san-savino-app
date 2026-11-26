import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Node >= 25 ships its own global localStorage, which shadows the jsdom one.
const execArgv = Number(process.versions.node.split(".")[0]) >= 25 ? ["--no-experimental-webstorage"] : [];

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    poolOptions: { forks: { execArgv } },
    // Multi-step MUI interactions exceed the 5s default on a loaded machine.
    testTimeout: 20000,
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**"],
      exclude: ["src/**/__tests__/**", "src/test/**", "src/**/*.test.{ts,tsx}", "src/**/*.d.ts", "src/main.tsx"],
    },
  },
});
