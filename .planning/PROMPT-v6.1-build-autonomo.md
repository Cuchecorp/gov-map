# PROMPT — Corrida autónoma v6.1 "Entendible y completo" (Phases 62–63)

> Pegar en una sesión LIMPIA de Claude Code (repo Observatorio). Todo el scaffolding ya existe: REQUIREMENTS.md, ROADMAP (v6.1, fases 62-63), CONTEXT por fase con diagnóstico verificado. NO re-descubrir; ejecutar.

---

## Prompt para pegar

```
/gsd-autonomous --from 62 --to 63
```

Directivas de la corrida (mismas que v6.0, que cerró completa):

- **Fable es el jefe**: planifica, dirime y controla; delega ejecución a agentes Sonnet o menores. Smart-discuss auto-acepta recomendaciones (los CONTEXT.md ya traen las decisiones LOCKED y el diagnóstico con conteos verificados — no re-investigar lo ya medido).
- **Autónomo y ordenado**: sin preguntas al operador salvo decisión genuinamente suya; checkpoints automated-first.
- **BrowserOS obligatorio** como gate de comprensión (MCP `http://127.0.0.1:9200/mcp`, wrapper `scripts/bros-cli.mjs`, páginas ocultas, capturas desktop+390px, lectura fría → veredicto). Si el MCP está caído, pedir al operador levantarlo — no fingir capturas.
- **Gates que un agente JAMÁS cruza**: flags `*_PUBLIC_ENABLED`, sign-offs legales, DDL destructivo, backfill masivo en GH Actions, evasión de WAF, imprimir secrets.

## Qué se construye

**Phase 62 — RED entendible** (`.planning/phases/62-red-grafo-de-relaciones-entendible/62-CONTEXT.md`):
`/red` hoy renderiza ~136 nodos apiñados (layout rejilla por cámara, `red-graph.tsx` fn `posicion`) y el "vecindario" del seed no filtra. Objetivo: ego-network real (seed + vecinos directos, tope + "ver más" honesto), layout radial determinista alfabético (F18 LOCKED: cero force-simulation, la posición nunca implica afinidad), estado sin-seed que orienta, móvil usable, leyenda reescrita. Gate: lectura fría BrowserOS "comprensible" con evidencia before/after (el screenshot del operador 2026-07-09 es el "antes").

**Phase 63 — BUSQ completa** (`.planning/phases/63-busq-b-squeda-de-proyectos-completa/63-CONTEXT.md`):
Diagnóstico verificado: 156 proyectos / 74 fichas / 74 embeddings / 60 ideas. (a) backfill LOCAL con `@obs/fichas` pipeline-cli para el gap + reintento de fallidos con causa por boletín (columnas estado/error_msg ya existen); (b) ampliar corpus histórico — research de fuente de enumeración, alcance recomendado legislatura 2022→hoy, backfill LOCAL R2-primero rate-limited reanudable, entra por el mismo camino (tramitación+ficha+embedding+autores); (c) /buscar declara cobertura real ("Busca sobre N proyectos…") + cobertura N/M visible al operador (extender `pnpm freshness`). Golden gates existentes intactos.

## Contexto operativo (gotchas ya pagados — v6.0)

- **Deploy**: build OpenNext en Docker `node:22-slim` (NUNCA alpine ni build Windows); copiar fuente a `C:/Temp` antes de montar (OneDrive lentísimo); wrangler GLOBAL: `node "C:/Users/Carlo/AppData/Roaming/npm/node_modules/wrangler/bin/wrangler.js" deploy --config wrangler.jsonc`. Runbook completo: `milestones/v6.0-phases/61-*/61-02-SUMMARY.md`.
- **Verificar contra el entrypoint del YAML del cron**, no contra el paquete (gap 57-05: dos CLIs).
- psql: `PGCLIENTENCODING=UTF8`, BOM U+FEFF en `.env`; migraciones >0044 SIN grants a anon (Camino A service_role); pgTAP usa `col_is_null`.
- fast-xml-parser: verificar shape real con `node -e` antes de confiar en claves (`#text` vs clave nombrada — bug de autores).
- Suite al inicio de la corrida: 738 verde + tsc limpio. Cada plan la deja verde.
- Sitio PROD: https://observatorio-congreso.thevalis.workers.dev (última versión `051a6cf0`).

## Al cerrar

audit-milestone → complete-milestone v6.1 → cleanup → tag → push. Deuda que NO es de esta corrida: gates humanos (F13/F17/0042, RUT-01, B26) + backlog v6.0 (source_snapshot multi-fuente, lobby --from-r2, cursor leylobby, CLOUDFLARE_API_TOKEN).
```
