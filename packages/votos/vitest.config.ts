import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // El probe LIVE (*.live.test.ts) golpea el WAF gubernamental con delay 2-3s y solo
    // corre con VOTOS_LIVE=1 (describe.skip si no). Se EXCLUYE del glob por defecto para
    // que ni se colecte en la suite normal/CI (defensa si la env-var se filtra) — se
    // corre a mano apuntando al archivo. Así el timeout de 120s no contamina la suite.
    exclude: ["**/node_modules/**", "**/*.live.test.ts"],
    passWithNoTests: true,
    // El bloque LIVE hace requests serializados con delay 2-3s LOCKED: amplio el
    // timeout para no abortar la corrida deliberada (la suite offline es instantanea).
    testTimeout: 120_000,
  },
});
