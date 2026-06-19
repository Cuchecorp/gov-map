import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["spike/**/*.test.ts"],
    passWithNoTests: true,
    // El bloque LIVE hace requests serializados con delay 2-3s LOCKED: amplio el
    // timeout para no abortar la corrida deliberada (la suite offline es instantanea).
    testTimeout: 120_000,
  },
});
