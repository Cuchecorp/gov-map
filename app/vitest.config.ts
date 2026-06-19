import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` lanza fuera de un Server Component. En tests resolvemos su
      // build vacío (el mismo `react-server` export que usa Next server-side),
      // permitiendo testear módulos server-only (lib/buscar) sin el runtime de Next.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: [
      "lib/**/*.test.{ts,tsx}",
      "components/**/*.test.{ts,tsx}",
      "app/**/*.test.{ts,tsx}",
    ],
    setupFiles: ["./vitest.setup.ts"],
    passWithNoTests: true,
  },
});
