# Phase 20: Deploy + Carga de Datos — Preview privado gov-map.com - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning
**Mode:** Runbook pre-armado por el orquestador (con todo el estado operativo ya descubierto en vivo). El plan-phase autónomo debe LEER este archivo entero antes de planificar.

<domain>
## Phase Boundary

Poner el Observatorio **en vivo como preview PRIVADO** en Cloudflare Workers (dominio objetivo `gov-map.com`) **entregando data real**, con el Supabase de la nube **poblado por ingesta LIVE corrida LOCALMENTE** (no GitHub Actions). MONEY y NET **apagados** (gated). NO es lanzamiento público (gate legal Ley 21.719 pendiente).

**Fuera de alcance:** encender MONEY/SERVEL/NET; lanzamiento público; construir features nuevas; Phases 17/18; implementar el rediseño de Phase 19 (eso es otra fase). Esta fase usa el frontend YA construido (v1.0+v2.0) tal cual.
</domain>

<decisions>
## Implementation Decisions

### Ingesta
- **Corre LOCAL, no en GitHub Actions** (preferencia explícita del usuario: no gastar Actions). Idempotente/reanudable; rate-limit 2–3s; en **lotes acotados** (por boletín/periodo) para no exceder el tiempo de un subagente executor.
- Escribe a la **nube**: los conectores leen `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY` del `.env`, que **ya apuntan al proyecto cloud** (`bctyygbmqcvizyplktuw.supabase.co`). No hace falta cambiar nada para que escriban a la nube.
- **Orden obligatorio** (dependencias FK): (1) maestra parlamentarios → (2) tramitación (proyectos/votaciones/eventos) → (3) embeddings de búsqueda (fichas) → (4) votos, lobby, patrimonio. MONEY/SERVEL **se omiten** (gated).
- **MONEY excluido**: NO correr `@obs/dinero` (`ingest`/`ingest:servel`). El frente MONEY queda sin data y gated.

### Deploy
- **wrangler directo** (`pnpm --filter app deploy`), usuario logueado. Sin GitHub ni Actions en el camino crítico.
- **Preview PRIVADO**: `noindex` (meta robots o `X-Robots-Tag`, o Cloudflare Access). `MONEY_PUBLIC_ENABLED` ausente/false. NET (grafo) no existe aún (Phases 17/18 sin construir) → naturalmente off.
- **gov-map.com**: se adjunta como custom domain cuando el dominio esté en la cuenta Cloudflare (paso DNS de operador). Mientras tanto, preview en `observatorio-congreso.<subdominio>.workers.dev`.

### Repo / GitHub
- GitHub **NO es requisito** del deploy (wrangler despliega directo). Subir el repo a GitHub privado queda **opcional** (backup/versionado) — `gh` está autenticado (cuenta `xenaquis`, scopes repo+workflow) si se quiere.

### Claude's Discretion
- Lotes/orden fino de la ingesta, mecanismo exacto de `noindex`, y si se usa snapshot vs `seed:live` para la maestra (ver code_context).
</decisions>

<code_context>
## Existing Code Insights — ESTADO OPERATIVO YA DESCUBIERTO (vivo, 2026-06-20)

### Credenciales / .env (todo verificado en vivo)
- **`.env` ya NO tiene BOM** (lo removí; antes rompía el CLI de supabase con "unexpected character '»'"). Mantener UTF-8 sin BOM al editar.
- **LLM/Embeddings**: `GEMINI_API_KEY`, `MINIMAX_API_KEY`, `DEEPSEEK_API_KEY` ✓.
- **Supabase**: `SUPABASE_API_URL=https://bctyygbmqcvizyplktuw.supabase.co`, `SUPABASE_SECRET_KEY` (service_role) ✓, `SUPABASE_DB_URL` (pooler sa-east-1, password NUEVO ya verificado conecta) ✓.
- **R2**: token regenerado con **Object Read & Write** → escritura **OK** (probe `scripts/r2-probe.ts` pasa: PUT/HEAD/GET/DELETE). Correr el probe con `deno run --allow-net --allow-read --allow-env --allow-sys scripts/r2-probe.ts` (el `--allow-sys` es OBLIGATORIO o da falso `NotCapable`).
- **`MERCADOPUBLICO_TICKET`** ✓ (puesto) — pero MONEY se omite igual.
- **FALTA**: `SUPABASE_URL` y `SUPABASE_ANON_KEY` NO están en `.env`. El frontend (`app/lib/supabase.ts`) lee `SUPABASE_URL` + `SUPABASE_ANON_KEY` (server-only, NO `NEXT_PUBLIC_`). `SUPABASE_URL` = el valor de `SUPABASE_API_URL`. El **anon key** hay que sacarlo del dashboard (Settings → API Keys → anon/publishable) — **INPUT DE OPERADOR**.

### Schema remoto (YA aplicado al 2026-06-20)
- Migraciones **0001–0025 aplicadas y registradas** en la nube. (0021/0022 tenían drift de tracking → resuelto con `supabase migration repair --status applied`; 0023/0024/0025 aplicadas con `db push`.) Objetos verificados con psql.
- **La DB de la nube está VACÍA de datos** (0 filas en parlamentario/proyecto/votacion/lobby/declaracion). Por eso esta fase la puebla.
- Extraer `SUPABASE_DB_URL` esquivando cualquier residuo: `python -c "raw=open('.env','rb').read().decode('utf-8',errors='ignore'); [print(l.split('=',1)[1].strip()) for l in raw.splitlines() if l.strip().startswith('SUPABASE_DB_URL=')]"`. psql 17.9 disponible en `/c/Users/Carlo/miniconda3/Library/bin/psql`.

### Runners de ingesta (monorepo pnpm + Deno; scripts por paquete)
Entrypoints CLI: `packages/<pkg>/src/*-cli.ts`. Invocación vía script pnpm del paquete:
- Maestra: `pnpm --filter @obs/identity seed:live`  (entrypoint `packages/identity/src/seed-cli.ts`). El seeder NUNCA auto-confirma ambiguos (van a 'revision'); confirma solo RUT-exacto o nombre único. Alternativa más rápida/determinista: cargar el snapshot `supabase/seeds/parlamentario.seed.json` (186 filas curadas) a la nube — **CONFIRMAR en `seed-cli.ts` si soporta cargar desde snapshot**; si no, usar `seed:live`.
- Tramitación: `pnpm --filter @obs/tramitacion ingest`  (`packages/tramitacion/src/ingest-cli.ts`) — **confirmar flags** (probablemente acepta boletines/limite para lotes acotados).
- Votos: paquete `@obs/votos` NO tiene script `ingest` ni CLI propio; Phase 10 usó un runner `runCamaraVotos` (corrida acotada por boletines). **Investigar cómo se dispara** (puede estar en tramitacion o un script). Cruza por DIPID determinístico.
- Lobby: `pnpm --filter @obs/lobby ingest`  (`packages/lobby/src/ingest-cli.ts`) — crawl leylobby 2 pasos; drift BLOQUEANTE (cuarentena).
- Patrimonio: `pnpm --filter @obs/probidad ingest`  (`packages/probidad/src/ingest-cli.ts`).
- Agenda (citaciones/sala): `pnpm --filter @obs/agenda ingest`  (opcional para la ruta `/agenda`).
- Embeddings/fichas: `packages/fichas/src/pipeline-cli.ts` (sin script pnpm dedicado — **correr con deno**; usa Gemini, dim 768). Necesario para que `/buscar` devuelva resultados.
- Adjudicación humana (si quedan filas 'revision'): `pnpm --filter @obs/adjudication revisor`.
- **MONEY (NO correr)**: `@obs/dinero` `ingest`/`ingest:servel`.
> NOTA: confirmar flags exactos leyendo cada `*-cli.ts` antes de correr. Correr en lotes acotados e idempotentes; verificar conteos con psql tras cada bloque.

### Deploy (frontend Next 16 → Cloudflare Workers vía OpenNext)
- Scripts en `app/package.json`: `deploy` = `opennextjs-cloudflare build && opennextjs-cloudflare deploy`; `preview`, `cf-build`, `upload`. Worker `observatorio-congreso` (`app/wrangler.jsonc`), main `.open-next/worker.js`, assets `.open-next/assets`.
- Secrets de RUNTIME del Worker (NO van en wrangler.jsonc): `wrangler secret put SUPABASE_URL`, `wrangler secret put SUPABASE_ANON_KEY`, `wrangler secret put GEMINI_API_KEY` (embeddings de búsqueda en runtime). Ver `docs/deploy-cloudflare.md`.
- **⚠️ Windows EPERM**: el build de OpenNext crea symlinks que Windows bloquea sin **Modo Desarrollador**. Mitigación: activar Modo Desarrollador de Windows, o correr el build/deploy en **WSL** (hay relays WSL en la máquina). Fallback último: workflow `deploy-cloudflare.yml` (needs secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID=10fb709d866bb5b06dd2a5d13c8dd472`) — única excepción a "no Actions".
- Cache ISR en R2: opcional ahora que R2 funciona (descomentar binding `NEXT_INC_CACHE_R2_BUCKET` en wrangler.jsonc + `r2IncrementalCache` en open-next.config.ts). No bloqueante.

### Repo hygiene
- `.env` está en `.gitignore` y NO tracked (solo `.env.example`). node_modules/.next no tracked. Seguro para GitHub si se sube.
</code_context>

<specifics>
## RUNBOOK — orden de ejecución sugerido para el run autónomo

**Pre-flight (operador / gates):**
- [ ] Operador pega `SUPABASE_ANON_KEY` (dashboard) — sin esto el frontend no lee la nube. Añadir a `.env`: `SUPABASE_URL=https://bctyygbmqcvizyplktuw.supabase.co` y `SUPABASE_ANON_KEY=<anon>`.
- [ ] (Para dominio) operador agrega `gov-map.com` a la cuenta Cloudflare. Si no está aún, desplegar a `*.workers.dev` y adjuntar dominio después.

**Bloque A — Poblar la nube (LOCAL, idempotente, rate-limit 2–3s, lotes acotados):**
1. Maestra: `pnpm --filter @obs/identity seed:live` (o cargar snapshot). Verificar `select count(*) from parlamentario` > 0 (esperado ~186).
2. Tramitación: `pnpm --filter @obs/tramitacion ingest` (lotes por boletín/periodo). Verificar `proyecto`, `votacion`, `tramitacion_evento` > 0.
3. Embeddings: correr `packages/fichas/src/pipeline-cli.ts` (deno). Verificar columna embedding poblada (búsqueda funcional).
4. Votos: runner Cámara (DIPID). Verificar `voto` > 0.
5. Lobby: `pnpm --filter @obs/lobby ingest`. Verificar `lobby_audiencia` > 0.
6. Patrimonio: `pnpm --filter @obs/probidad ingest`. Verificar `declaracion` > 0.
7. (Opcional) Agenda: `pnpm --filter @obs/agenda ingest`.

**Bloque B — Wiring + build + deploy:**
8. `.env`: `SUPABASE_URL` + `SUPABASE_ANON_KEY` presentes.
9. Preview privado: asegurar `noindex` (meta robots / `X-Robots-Tag`), `MONEY_PUBLIC_ENABLED` ausente.
10. `wrangler secret put SUPABASE_URL` / `SUPABASE_ANON_KEY` / `GEMINI_API_KEY`.
11. Build+deploy: `pnpm --filter app deploy`. Si EPERM en Windows → Modo Desarrollador o WSL.
12. (Cuando aplique) adjuntar `gov-map.com` como custom domain del worker.

**Bloque C — Verificación end-to-end:**
13. Abrir la URL desplegada (browseros): el landing carga; `/buscar?q=...` devuelve proyectos reales; una ficha `/parlamentario/[id]` muestra votos/lobby/patrimonio; NINGUNA sección MONEY visible (gated); no hay foto ni partido.
14. Confirmar `noindex` en la respuesta.

## browseros (para la verificación visual)
El cliente MCP de Claude Code tiene la lista de tools VIEJA cacheada (server actualizado a v0.0.119). Workaround: driver HTTP directo en `.planning/phases/19-.../refs/bros.py` (JSON-RPC a `127.0.0.1:9200/mcp`; `tabs/navigate/screenshot/read`). Para tools nativos: `/mcp` → browseros → Reconnect.
</specifics>

<deferred>
## Deferred Ideas
- **gov-map.com como dominio público + lanzamiento público** — bloqueado por sign-off legal Ley 21.719 (CLAUDE.md). El preview es privado/noindex.
- **MONEY en vivo** (ChileCompra/SERVEL) — gated hasta sign-off legal F13; no se ingesta ni se expone.
- **NET (grafo)** — Phases 17 (legal) + 18 (build) sin hacer; off.
- **Subir repo a GitHub privado** — opcional (backup); `gh` autenticado si se decide.
- **Implementar el rediseño de Phase 19** (fondo crema, header global, directorio de parlamentarios) — fase posterior; el preview usa el frontend actual.
- **Cache ISR en R2** — opcional ahora que R2 escribe.
</deferred>
