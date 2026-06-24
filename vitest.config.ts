// NOTA (TEST-09): este config NO lo usa `pnpm test`. El script raíz corre cada
// paquete con su PROPIO vitest.config (`pnpm -r --filter "./packages/*" test`) y la app
// con el suyo. Este archivo solo aplica si alguien corre `vitest run` directamente en la
// raíz — algo que NO cubre la app ni carga los setupFiles/alias de cada paquete. No
// confiar en él como cobertura total; es un fallback de conveniencia.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts"],
    passWithNoTests: true,
  },
});
