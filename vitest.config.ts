import path from "node:path";
import { defineConfig } from "vitest/config";

// Fast unit tests only. Database tests live in tests/integration (see vitest.integration.config.ts).
export default defineConfig({
  test: { environment: "node", include: ["tests/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
