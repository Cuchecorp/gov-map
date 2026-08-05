// vitest.config.ts — config PROPIO del paquete @obs/news. Sin este archivo el paquete
// no es recorrido por `pnpm -r --filter "./packages/*" test` de la raíz (CI-DARK, Pitfall 8).
// Analog literal de packages/tramitacion/vitest.config.ts.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
