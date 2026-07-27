# PROMPT — Corrida autónoma v12.0 "Validación general producto-a-producto" (Phases 113–125, TRES PASADAS)

> Pegar en una sesión LIMPIA de Claude Code (repo Observatorio), tras `/clear` — **una pasada por sesión**. El scaffolding ya existe: ROADMAP.md §v12.0 (13 fases 113-125 con success criteria y reglas rectoras, 13/13 reqs), REQUIREMENTS.md (LINK/FECHA/CRON/CRUCE/SUPA/E2E). NO re-descubrir; ejecutar.
>
> **Al terminar cada pasada: `/clear` y pegar el prompt de la siguiente.** Al terminar la pasada 3: audit-milestone → complete-milestone v12.0 → cleanup → tag v12.0 → push a Cuchecorp/gov-map (merge-no-rebase para preservar el tag).

---

## PASADA 1 — PRODUCTO: inventario + links + fechas (pegar tras `/clear`)

```
/gsd-autonomous --from 113 --to 117
```

Contexto rector de la pasada (leer ROADMAP.md §v12.0 Phase Details antes de planificar):

- **113 INV es RECTOR y load-bearing**: artefacto único (documento en la fase) que enumera TODA ruta pública × links que emite (internos / externos por tipo de fuente) × fechas visibles (con columna/RPC de origen, MARCANDO las que vienen de `fecha_captura`). Rutas dinámicas con sujetos concretos reales elegidos por SQL contra PROD (precedente 93-02: sujetos deterministas por psql). Método y cobertura declarados — cero rutas "asumidas". 114/115/116/122 y el E2E 125 consumen este inventario; su completitud la valida un Opus ANTES de avanzar.
- **114 LINK-INT**: cada link interno solicitado contra el deploy real (Worker propio — sin WAF, pero con mesura) → cero 404; cada ancla `#id` verificada contra el DOM destino (precedente v8.0: `section[id]`/scroll-margin solo lo cazó getComputedStyle en deploy). Corrida reproducible (script + salida guardada), fixes con evidencia antes/después. El deploy de los fixes puede viajar con 125.
- **115 LINK-EXT**: enumerar cada PATRÓN de URL externa (plantilla + dato que lo parametriza: boletín, prmID, idNorma, id audiencia) + muestra live estratificada ≥1 caso por patrón×host con **rate-limit 2-3s/host, UA identificatorio, robots.txt — JAMÁS ráfagas ni crawl exhaustivo (decisión operador 2026-07-27)**. Distinguir "patrón malo" (se arregla) de "fuente caída/WAF" (se declara, jamás se evade). Gotchas pagados: WAF camara.cl bloquea Node fetch → curl-first; prmID Cámara persistido (v9.0); portal Senado buildId cambia por deploy (jamás hardcodear).
- **116 FECHA-AUDIT → 117 FECHA-FIX**: veredicto por fecha (hecho / captura / ambigua) con archivo:línea, cruzado contra dato real de PROD (un sujeto por superficie). Gotchas LOCKED: `fecha_captura` es reloj de scraping y JAMÁS se presenta como el hecho (Phase 98: "fecha_captura mentirosa"); idiom aprobado "según fuente al…", **"captura" pelado PROHIBIDO** (v10.0); `citacion.fecha` es date-only medianoche UTC → la parte fecha UTC ES el día chileno, JAMÁS convertir tz (gotcha mayor v9.0 pasada 2). 117 corrige TODO hallazgo de 116 (o lo declara), guards de régimen + suite + tsc verdes.
- Si un fix de copy toca superficie nueva o vocabulario nuevo → **extender el linter anti-insinuación ANTES del copy** (patrón Wave-0 de v10.0/v11.0).

## PASADA 2 — CRONS + ESCALERA (pegar tras `/clear`) — **el operador PARTICIPA (checkpoint keys)**

```
/gsd-autonomous --from 118 --to 121
```

Contexto rector de la pasada:

- **118 CRON-AUDIT**: enumerar TODOS los workflows GH Actions + jobs pg_cron; veredicto verde/stale/roto por cron con evidencia OBSERVADA (última corrida gh, última fila escrita psql, `pnpm freshness`), causa por veredicto no-verde. Gotchas pagados: dos entrypoints CLI — verificar contra el YAML del cron cuál corre de verdad (gap 57-05); billing GH intermitente; `process.cwd` bajo `pnpm --filter exec` (v8.1); secrets: si falta `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` u otro secret en GH (deuda 110), es **checkpoint de operador — pedir UNA vez con pasos exactos zero-credential-value y seguir con lo no bloqueado**; el agente JAMÁS carga valores de secreto.
- **119 CRON-FIX**: cerrar cada gap accionable en código (reintentos/backoff con jitter, cursores, hash-check-antes-de-descargar, señales freshness) o diferirlo como deuda operador con razón+pasos. Dos etapas LOCKED (fuente→R2 content-addressed, R2→Supabase) y rate-limit 2-3s INTACTOS en todo conector tocado. Cron degrada honesto (`[skip] sin novedades`, stale visible), JAMÁS fabrica. MONEY/SERVEL siguen fuera del cron (gated).
- **120 ESCALERA-ON — flip `CLASIFICACION_ESCALERA=1` AUTORIZADO por el operador 2026-07-27** (verbatim: "Flip autorizado… tras shadow-eval verde y con rollback-by-config"). Orden DURO: (1) checkpoint operador — provisionar keys Workers AI (`CLOUDFLARE_ACCOUNT_ID` ya existe en .env; falta el API token con permiso Workers AI; posible GH secret si el cron lo corre en CI) — pedir UNA vez con pasos exactos; (2) drift canary confirma que el modelo servido = el del veredicto full-40 (mismatch = INVALIDA el veredicto y ABORTA el flip); (3) shadow-eval Granite vs DeepSeek LIVE verde (109-03: 10 casos, delay 2.5s); (4) rollback-by-config PROBADO (quitar la env var = DeepSeek incumbente byte-idéntico); (5) recién entonces el flip en la config del cron/CLI. Sin keys o shadow-eval no-verde → NO hay flip, cierre honesto documentado (resultado VÁLIDO). Guards integ-scope + provider-guard verdes SIEMPRE: **adjudicación de identidad y extracción strict-schema INTOCABLES**.
- **121 ESCALERA-DOC**: estado por tarea (routing / clasificación / juez / extracción / adjudicación) = extendida/no-extendida con la evidencia del veredicto full-40 v11.0 (routing flipeó a incumbent-stays; extracción VETADA por es-CL; juez Phi recall 0.917; solo clasificación APPROVED). Adjudicación marcada INTOCABLE por decisión explícita. Qué evidencia haría falta para extender cada pendiente. Regla LOCKED: ante la duda, SIEMPRE calidad.

## PASADA 3 — CRUCES + SUPABASE + E2E + cierre (pegar tras `/clear`)

```
/gsd-autonomous --from 122 --to 125
```

Contexto rector de la pasada:

- **122 CRUCE-SQL**: cada cruce visible recalculado con SQL verbatim contra PROD y comparado con el deploy — relaciones (5 bloques ficha), /comparar 4 ejes + VSIM ("coinciden en N de M" — cuadrar contra `coincidencia_votos_par`, precedente 104-03 3 pares), cruces de ficha/proyecto (0047-0050), panel actualidad (6 señales × SQL, precedente 104), lobby↔PL (cobertura declarada ~3.8%), lobby_sector_aporte (0 filas HONESTAS — stub estructural 0052, NO bug). Denominadores honestos (no_confirmado/pareo excluidos donde corresponde), query + ambos números registrados por discrepancia. Vacíos = vacíos honestos; copy sin causalidad.
- **123 SUPA-AUDIT**: skill `supabase-ops` + subagente `supabase-reviewer` como GATE — schema/RLS/grants/RPCs bounded/`PUBLIC_RPC_ALLOWLIST`/secdef+`search_path` contra la **DB VIVA** (no solo migraciones: 0059-0068 sin traza en `schema_migrations` es NORMAL, retomada en 0069; filtro `not exists (pg_depend deptype='e')` SIEMPRE). "0 offenders" se demuestra con la consulta. Guards lockdown Block A-E + Direction-B se EXTIENDEN si aparece punto ciego (patrón: guard primero).
- **124 SUPA-FIX**: cada fix = migración aditiva numerada (siguiente después de 0072) aplicada por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f` con pre-checks fail-closed (BOM esquivado), **JAMÁS `supabase db push`**; pgTAP contra el schema APLICADO cubriendo el defecto; re-audit 123 → 0 offenders en lo corregido. Cambio destructivo (drop/tipo/backfill) → delegar diseño a `supabase-architect` y BLOQUEAR en checkpoint operador.
- **125 E2E**: deploy Cloudflare agrupando los fixes de UI de 114/117/122 (build OpenNext en Docker `node:22-slim`, robocopy a `C:/Temp/obs-build` purgando `.pnpm-store` + re-escribir helper scripts tras el mirror, wrangler GLOBAL AppData OAuth — ojo wrangler sombreado por paquete Python —, `MSYS_NO_PATHCONV=1`, propagación 10-30s) → pasada BrowserOS por CADA superficie del inventario 113 con evidencia DOM; re-verificar links internos + muestra externa (rate-limit) + fechas + cruces sobre el deploy final; **flags no autorizados (MONEY, NOTIF) OFF y ausentes del DOM**; guards + suite verdes.
- **AL CERRAR LA PASADA (cierre del milestone)**: `/gsd:audit-milestone` → `/gsd:complete-milestone v12.0` → cleanup → tag v12.0 → push a Cuchecorp/gov-map (merge-no-rebase preserva el tag; `complete-milestone` archiva SOLO el milestone en curso). Checkpoint sin respuesta del operador = handoff documentado con evidencia lista, la corrida CIERRA igual (patrón v7/v9/v10/v11).

---

## Directivas comunes a las TRES pasadas (mismas de v6.x-v11, que cerraron completas)

- **Fable es el jefe**: planifica, dirime y controla; delega ejecución a agentes Sonnet o menores; **validadores Opus validan cada fase** (verifier/code-review). Smart-discuss auto-acepta recomendaciones; las decisiones del operador YA ESTÁN RESUELTAS — no re-preguntar: links externos = patrón+muestra; flip clasificación AUTORIZADO (con sus precondiciones); validar-y-arreglar; ante la duda SIEMPRE calidad.
- **Validar-y-arreglar**: fix inline de lo delegable (código, migraciones aditivas a PROD por precedente 0055+, redeploy). Solo destructivo/legal/secretos bloquea en checkpoint blocking-human.
- **Gates que un agente JAMÁS cruza**: flags `*_PUBLIC_ENABLED` (MONEY/NET/VSIM/NOTIF como estén — `CLASIFICACION_ESCALERA` NO es de esa familia y SÍ está autorizado tras sus precondiciones), sign-offs legales, escribir RUT, rotar credenciales, imprimir secrets, cargar valores de secreto en GH/dashboard.
- **Reglas LOCKED de siempre**: identidad fail-closed (name-match JAMÁS para votos/RUT); anti-insinuación (linter verde; extensión ANTES del copy); migraciones por psql --single-transaction; PostgREST cap 1k (`.order().range()` SIEMPRE); RPC pública nueva = aguja completa (>0044 cero-grant, secdef PII-safe, allowlist, bounded); RUT jamás cruza a un LLM; `response_format: json_schema` JAMÁS asumido; dos-etapas fuente→R2→Supabase; rate-limit 2-3s + curl-first ante WAF; fecha_captura JAMÁS es el hecho.
- **Secrets nuevos solo en `.env`**: placeholder en `.env.example` SIN valor, guard env-example verde.

## Contexto operativo (gotchas ya pagados)

- **Suite al inicio**: app ~1428 + packages verdes + `tsc` 0 + guards de régimen (anti-insinuación, lockdown 22, anti-flip vsim/notif/money, bento, name-match-rut, env-example, integ-scope, provider-guard). Cada plan la deja verde.
- **Sitio PROD**: https://observatorio-congreso.thevalis.workers.dev (v11.0 sin deploy propio; último deploy v10.0 `e89b79af`, CSP ENFORCED). Supabase ref `bctyygbmqcvizyplktuw` (sa-east-1, pooler IPv4).
- **BrowserOS**: MCP `http://127.0.0.1:9200/mcp`, wrapper `scripts/bros-cli.mjs`; screenshots en ráfaga tumban el MCP → sleep 8-10s; gates interactivos que el subagente no pueda cerrar los cierra el ORQUESTADOR; CDP timeout → reabrir página.
- **Queries DB viva**: `set -a; source .env; set +a` + psql read-only; JAMÁS imprimir la URL; PK bio `id=S1344` pero `parlid_senado=1344` numérico (gotcha 105-02).
- **Escalera (v11.0)**: `CLASIFICACION_ESCALERA` env-gate en `packages/cruces/src/clasificar-fichas-cli.ts` (default = DeepSeek incumbente byte-idéntico); shadow-eval + drift canary en 109-03; veredicto full-40 be0b1b9; Workers AI baseURL `https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1`, `max_tokens` explícito 2048 (default 256 trunca).
- **Deuda operador VIVA (fuera de alcance salvo que un checkpoint la cruce)**: RUT-01 + backfills LIVE (111-OPERATOR-CHECKPOINT.md), flip MONEY (112), provisión NOTIF (103-HUMAN-UAT), rotación B26 + CF secrets (110-02-OPERATOR-CHECKPOINT.md — el audit 118 la va a encontrar: checkpoint, no fix de agente).
- **v11.0 archivada**: fases en `milestones/v11.0-phases/`; roadmap histórico en `milestones/PRE-v12.0-ROADMAP-archive.md`. `.planning/phases/` está VACÍO — las fases 113+ se crean ahí.
