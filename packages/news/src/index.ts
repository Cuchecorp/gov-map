// index.ts — barrel PLACEHOLDER de scaffolding (132-01 / Task 1).
//
// Existe SOLO para que `tsconfig.json` (composite: true, include: ["src/**/*.ts"]) tenga
// al menos un input: sin ningún .ts bajo src/, `tsc -b` aborta con TS18003 "No inputs were
// found in config file" (exit 1), rompiendo `pnpm typecheck` de TODA la wave 1 porque el
// reference "./packages/news" ya está en el tsconfig.json de la raíz.
//
// El plan 132-06 (wave 4) REEMPLAZA este archivo por el barrel final (>= 8 símbolos:
// FEEDS, NEWS_HOSTS, allowlistNews, assertFeedUrl, parser, connector, etc.).
// NO agregar aquí exports de módulos que todavía no existen — rompería este mismo tsc -b.
export const NEWS_PACKAGE = "@obs/news";
