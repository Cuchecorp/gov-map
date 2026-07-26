# PROMPT — Corrida autónoma v11.0 "Capa LLM escalonada + cierre de deuda viva" (Phases 105–112, TRES PASADAS)

> Pegar en una sesión LIMPIA de Claude Code (repo Observatorio), tras `/clear` — **una pasada por sesión**. El scaffolding ya existe: ROADMAP.md §v11.0 (8 fases 105-112 con success criteria, 24/24 reqs), REQUIREMENTS.md (BENCH/TIER/INTEG/BCN/V7GATES/QT), research v11.0 en `.planning/research/` (STACK con ADDENDUM Workers AI / FEATURES / ARCHITECTURE / PITFALLS / SUMMARY). NO re-descubrir; ejecutar.
>
> **Al terminar cada pasada: `/clear` y pegar el prompt de la siguiente.** Al terminar la pasada 3: audit-milestone → complete-milestone v11.0 → cleanup → tag v11.0 → push a Cuchecorp/gov-map.

---

## PASADA 1 — BCN + BENCH spike (pegar tras `/clear`)

```
/gsd-autonomous --from 105 --to 107
```

Contexto rector de la pasada (leer ROADMAP.md §v11.0 + research/SUMMARY.md antes de planificar):

- **REGLA LOCKED del operador (rectora de TODO el milestone)**: ante la duda, SIEMPRE calidad. El escalonamiento optimiza latencia/costo ÚNICAMENTE donde el benchmark demuestra paridad. DeepSeek se queda donde luce; **la adjudicación de identidad (MiniMax, golden-1263) NI SE TOCA NI SE OBSERVA este milestone** (decisión operador 2026-07-26; Phi-juez-sobre-identidad DIFERIDO a v2).
- **105 (independiente, temprano)**: parser BCN senadores en ORIGEN — `hasPoliticalParty` URI→label legible en `@obs/bio` por mapeo determinista FAIL-CLOSED (URI desconocida jamás fabrica partido: omite/encola con causa), re-corrida de militancias afectadas → cero URI-como-partido en PROD (verificable por query), decisión documentada sobre `partidoLegible()` (cinturón 104-03: retirar o conservar con evidencia). Sin regresión del filtro por partido (la clave de faceta serializada RAW es por diseño — ver 104-03 en STATE).
- **106 (SPIKE load-bearing, gate DURO de 107-109)**: harness `packages/llm-bench` FUERA de la lib de runtime + golden sets es-CL NUEVOS POR TAREA (routing, clasificación, juez, paridad-extracción) estratificados del corpus REAL, sin leakage, CONGELADOS antes de integrar (precedente golden 32/1263 — el set se congela ANTES del schema). Métricas de PRIMERA CLASE separadas: calidad, latencia p50/p95, costo/1k, **tasa de fallo zod/structured-output** (omitirla sobre-recomienda modelos chicos).
- **HOST GRANITE (directiva operador 2026-07-26, ADDENDUM en STACK.md)**: **Cloudflare Workers AI es el candidato PRIMARIO para Granite** — `@cf/ibm-granite/granite-4.0-h-micro`, $0.017/$0.11 por M, 131K ctx, function calling, OpenAI-compat `baseURL = https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1` (la cuenta CF ya existe: Workers+R2). El spike DEBE: benchmarkear contra el endpoint Workers AI REAL (cuantización servida no declarada — números Ollama-local NO transfieren, Pitfall 9), fijar `max_tokens` explícito (default 256), registrar postura no-train/DPA de Workers AI para el gate `trainsOnInputs`, verificar fidelidad tool-calling servida. OpenRouter = fallback baseURL-swap. Phi-4-mini → OpenRouter (catálogo Workers AI no confirmado — verificar).
- **107**: adapters `GraniteProvider`/`PhiJudge` clonando el patrón `MiniMaxProvider` (tool_choice forzado + match de tool_call POR NOMBRE jamás posición — Phi alucina nombres de función — + zod + repair loop + guards `assertNoRutInLlmInput`/sensitivity IDÉNTICOS); juez Phi medido contra etiquetas HUMANAS (no contra el responder) con sesgos conocidos (self-preference, posición, verbosidad) sobre datos no-PII; **VEREDICTO POR TAREA con ε explícito** — déficit es-CL legal (fidelidad/negación) = VETO DURO para esa tarea, benchmarks en inglés irrelevantes. NADA se autoriza a integrar sin su gate verde.

## PASADA 2 — TIER plomería + INTEG (pegar tras `/clear`)

```
/gsd-autonomous --from 108 --to 109
```

Contexto rector de la pasada:

- **HALLAZGO RECTOR (research HIGH, grounded en código)**: el router existente de `packages/llm` (`selectProvider`/`loadRouterConfigFromEnv`) es DEAD CODE — cada consumidor instancia el provider concreto en el CLI (`fichas/src/pipeline-cli.ts`, `cruces/src/clasificar-lobby-cli.ts`). El seam correcto es un **`TieredProvider` decorador que `implements LLMProvider`**, drop-in en el punto de construcción; los cuerpos de consumidores NO cambian. `CompletionRequest.task` aditivo retro-compatible: sin `task` = comportamiento actual byte-por-byte.
- **108**: `TieredProvider` + `JudgeProvider` interfaz SEPARADA **ESCALATE-ONLY** (escala/rechaza, JAMÁS aprueba ni suaviza compuertas — juez débil que aprueba = teatro de validación) + config declarativa tarea→escalera + telemetría por llamada (modelo/tarea/latencia/costo/veredicto/escalación) SIN payload ni PII + escalación ACOTADA (1 hop por tier, presupuesto por ítem, estado terminal = revisión humana, sin loops). **Ruteo ENTRE pipelines, jamás mid-sesión** — prompt-cache DeepSeek de fichas intacto (verificable: `prompt_cache_hit_tokens` no regresiona). Todo testeable con `MockProvider` antes de tocar producción. Escalación por veredicto de juez o fallo zod, NUNCA por auto-confianza del modelo chico (miscalibrada).
- **109**: integrar UNA tarea reversible no-legal (clasificación o routing, la que el veredicto 107 aprobó — jamás extracción de idea-matriz ni adjudicación) con: provider-guard (zod+PII wrapper enumerando TODOS los providers) como PRIMER COMMIT (patrón lockdown-guard-first v10.0), golden set de la tarea como regresión CI PERMANENTE, shadow-evaluation ON antes de promover, guard estático que MUERDE impidiendo que la escalera toque `adjudicacion.*` y extracción strict-schema, rollback trivial por config (apagar escalera = incumbente, sin migración ni deploy especial), canario de drift del endpoint.
- **Si el veredicto 107 NO aprobó ninguna tarea** (paridad no demostrada): 109 se cierra HONESTO — plomería queda testeada con MockProvider, integración diferida documentada, el milestone no fabrica una integración sin evidencia. Ese resultado es VÁLIDO (la regla es calidad, no shipping de la escalera).

## PASADA 3 — V7GATES + cierre milestone (pegar tras `/clear`)

```
/gsd-autonomous --from 110 --to 112
```

Contexto rector de la pasada — **el operador PARTICIPA en esta pasada** (checkpoints blocking-human; responderá en la sesión):

- **110 (paralelizable, delegable)**: aplicar 0052/0053/0054 a PROD (`PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f`, runbooks 72/74, NUNCA `db push`; 0052 verificar constraint contra pg_constraint ANTES del drop, aplicar UNA vez) + pgTAP contra schema aplicado. Checkpoints operador: cargar `CLOUDFLARE_API_TOKEN`+`CLOUDFLARE_ACCOUNT_ID` en GH (billing verificado) + rotar DB password B26 (runbook 75; url vieja falla, nueva funciona, CI verde). El agente NO carga secretos ni rota.
- **111 (orden DURO)**: RUT-01 (operador escribe por runbook 69 — guard compilador `FilaRutCorroborada`: name-match JAMÁS escribe RUT) → backfills votos Cámara (runbook 66, `VOTOS_LIVE=1`, rate-limit 2-3s) y Senado (runbook 67, confirmar tokens `<SELECCION>` LIVE) → ChileCompra por RUT (runbook 70, POST RUT-01, cuota 10k/día reanudable, ticket solo en .env) + SERVEL .xlsx por elección (runbook 71, Etapa 1 = acto humano colocar .xlsx en R2). Cobertura N/M DECLARADA + invariantes (dipids no_confirmado=0). MONEY sigue OFF hasta 112.
- **112**: cold-reads sobre deploy real (68-BROWSEROS-GATE votos, 73 MONEY gated-preview, 75 no-regresión /red) → flip `MONEY_PUBLIC_ENABLED` **SOLO tras sign-off 21.719 del operador** en 13-LEGAL-DOSSIER (`signoff: approved`; el agente documenta, el operador firma y flipea; sin firma = MONEY OFF declarado honesto, la corrida CIERRA igual) → `audit-milestone`→`complete-milestone v7.0` con deuda restante explícita → marcador formal de cierre de las 5 quick tasks (260623-rtl, 260702-rbb, 260713-izo, 260715-bvd, 260722-eia) + STATE.md.
- **AL CERRAR LA PASADA (cierre del milestone v11.0)**: `/gsd:audit-milestone` → `/gsd:complete-milestone v11.0` → cleanup → tag v11.0 → push a Cuchecorp/gov-map. Checkpoint sin respuesta del operador = handoff documentado con evidencia lista, la corrida CIERRA igual (patrón v7/v9/v10).

---

## Directivas comunes a las TRES pasadas (mismas de v6.x-v10, que cerraron completas)

- **Fable es el jefe**: planifica, dirime y controla; delega ejecución a agentes Sonnet o menores (validadores Opus). Smart-discuss auto-acepta recomendaciones; las decisiones del operador YA ESTÁN RESUELTAS — no re-preguntar: escalonamiento solo tarea de menor riesgo este milestone; adjudicación intocable e inobservada; Workers AI candidato primario Granite; ante la duda SIEMPRE calidad.
- **Benchmark-first es gate DURO**: 106-107 producen el veredicto; 108 compone; 109 integra SOLO lo aprobado. Un veredicto "nada aprueba" es un resultado válido del milestone, no un fallo.
- **Autónomo y ordenado**: sin preguntas al operador salvo los checkpoints blocking-human diseñados (pasada 3 + si el spike necesita una API key nueva — p.ej. OpenRouter — pedirla UNA vez con instrucciones exactas y seguir con lo no bloqueado mientras tanto).
- **Gates que un agente JAMÁS cruza**: flags `*_PUBLIC_ENABLED` (MONEY/NET/VSIM/NOTIF como estén), sign-offs legales, escribir RUT, rotar credenciales, imprimir secrets, cargar valores de secreto en GH/dashboard.
- **Reglas LOCKED de siempre**: identidad fail-closed; anti-insinuación (linter verde, extensión ANTES del copy si aparece superficie nueva); migraciones por psql --single-transaction (NUNCA db push); PostgREST cap 1k (`.order().range()`); RPC pública nueva = aguja completa (>0044 cero-grant, security-definer PII-safe, PUBLIC_RPC_ALLOWLIST, bounded); RUT jamás cruza a un LLM (guard por construcción en TODO adapter nuevo — Granite/Phi incluidos); `response_format: json_schema` JAMÁS asumido (tool_choice forzado + zod por proveedor); dos-etapas fuente→R2→Supabase para toda ingesta (105 re-corrida bio incluida); rate-limit 2-3s + curl-first ante WAF.
- **Secrets nuevos solo en `.env`** (`CLOUDFLARE_ACCOUNT_ID` ya existe; posible `WORKERS_AI_API_TOKEN`/`OPENROUTER_API_KEY` nuevos): placeholder en `.env.example` SIN valor, guard env-example verde.

## Contexto operativo (gotchas ya pagados)

- **Suite al inicio**: app 1428 + packages (~1310) verdes + `tsc` 0 + 9 guards de régimen v10.0 (268 tests). Cada plan la deja verde.
- **Deploy** (solo si una fase lo necesita — 105 no toca frontend necesariamente, 112 sí para cold-reads): build OpenNext en Docker `node:22-slim`, robocopy a `C:/Temp/obs-build` (purgar `.pnpm-store` del mirror; re-escribir helper scripts tras cada mirror), wrangler GLOBAL AppData (OAuth; ojo wrangler sombreado por paquete Python), `MSYS_NO_PATHCONV=1`, propagación ~10-30s.
- **BrowserOS**: MCP `http://127.0.0.1:9200/mcp`, wrapper `scripts/bros-cli.mjs`; screenshots en ráfaga tumban el MCP → sleep 8-10s; gates interactivos que el subagente no pueda cerrar los cierra el ORQUESTADOR.
- **Queries DB viva**: filtro `not exists (pg_depend deptype='e')` SIEMPRE; psql read-only `set -a; source .env; set +a`, JAMÁS imprimir la URL. `schema_migrations` retomada en 0069 (0059-0068 sin traza — normal).
- **Ollama local (spike 106)**: `ollama pull granite4:micro-h` + `phi4-mini`, OpenAI-compat `http://localhost:11434/v1` — superficie /v1 PARCIAL (tool-calling o `format:json`, jamás json_schema). Si Ollama no está instalado, pedir al operador instalarlo o ir directo a los endpoints hosted (Workers AI/OpenRouter) para TODO el benchmark.
- **Workers AI**: `baseURL = https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1`, auth Bearer API token con permiso Workers AI (el operador lo crea si no existe — checkpoint de provisión, pedir UNA vez).
- **Sitio PROD**: https://observatorio-congreso.thevalis.workers.dev (v10.0 `e89b79af`, CSP ENFORCED). Supabase ref `bctyygbmqcvizyplktuw` (sa-east-1, pooler IPv4).
- **Relación con v7.0**: sus fases 64-75 viven en `.planning/phases/` (v7.0 NO archivado — se archiva en 112 con `complete-milestone v7.0`; NO tocarlas antes). Runbooks load-bearing ahí: `66-BACKFILL-RUNBOOK.md`, `67-BACKFILL-SENADO-RUNBOOK.md`, `69-BACKFILL-RUT-RUNBOOK.md`, `70-BACKFILL-CHILECOMPRA-RUNBOOK.md`, `71-BACKFILL-SERVEL-RUNBOOK.md`, `72-APPLY-RUNBOOK.md`, notas 74/75. OJO: `phases.clear` los borra — si un comando de lifecycle los elimina antes de 112, `git restore .planning/phases/` los recupera. La DB viva YA tiene 283.550 votos confirmados (cifra corregida Phase 98 — NO 548k; el backfill 66/67 los AMPLÍA, no parte de cero).
- **NOTIF (v10.0)**: inerte hasta provisión operador (103-HUMAN-UAT) — FUERA de v11.0, no tocar.
