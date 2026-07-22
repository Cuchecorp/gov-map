import { defineConfig } from "vitest/config";

// Config DELIBERADA para correr los probes LIVE gated (*.live.test.ts) a mano:
//   node scripts/run-with-env.mjs pnpm --filter @obs/fichas exec vitest run --config vitest.live.config.ts
// NO se usa en CI ni en la suite normal (esa es vitest.config.ts, que EXCLUYE *.live.test.ts).
// El gate real sigue siendo SUPABASE_DB_URL + GEMINI_API_KEY en el env (describe.skip si no).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.live.test.ts"],
    exclude: ["**/node_modules/**"],
    passWithNoTests: true,
    testTimeout: 120_000,
  },
});
