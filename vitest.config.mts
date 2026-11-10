import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mirrors the "@/*" path in tsconfig.json so modules shared with the app
// resolve the same way under test.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    exclude: ["**/node_modules/**", "**/.next/**", "on_*/**"],
  },
});
