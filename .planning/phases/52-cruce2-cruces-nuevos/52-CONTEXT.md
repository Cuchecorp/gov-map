# Phase 52: CRUCE2 — Cruces nuevos con datos ya disponibles (P3) - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Encender los cruces de mayor ROI que NO requieren ingesta nueva (diagnóstico §3.2): (SC1) correr el clasificador sectorial ya escrito (`@obs/cruces`) sobre contrapartes y `proyecto_ficha` y re-materializar `cruce_senal` con cobertura real (>>30 señales, verificado por psql); (SC2) lobby×tramitación por ventana temporal como yuxtaposición pura fechada ("en el mismo período", jamás causal); (SC3) cruce inverso proyecto→agenda en la ficha de proyecto; (SC4) módulo de actualidad en el home. F47 (comparativos de votos) y F49 (asistencia comparada) son fases propias — NO se duplican aquí. Deploy = checkpoint operador fuera de fase.

</domain>

<decisions>
## Implementation Decisions

### Corrida del clasificador (SC1)
- Contrapartes: priorizar las que aparecen en audiencias con `estado_vinculo='confirmado'` (las únicas que generan señal en `materializar_cruces`); correr `clasificar-lobby-cli` en lotes con `--limite` hasta cubrirlas (MiniMax free 45k/sem alcanza). Dry-run primero.
- `proyecto_ficha`: clasificar TODAS las fichas con `clasificar-fichas-cli` (DeepSeek, bulk barato).
- Golden gate LIVE (`CRUCES_GOLDEN_LIVE=1`, cobertura ≥0.7 sobre muestra 10, errores=0) ANTES de la corrida masiva. Al final: `select cruces.materializar_cruces();` por psql + verificación con conteos (señales >>30, distinct parlamentarios/sectores).
- El AGENTE ejecuta la corrida localmente (CLIs vía `node scripts/run-with-env.mjs`, keys de `.env`; escritura de DATOS no-DDL — patrón de corridas LIVE previas lobby/NET/agenda), con conteos before/after en SUMMARY.

### Lobby×tramitación temporal (SC2)
- Criterio: audiencias de lobby en la MISMA SEMANA ISO en que el boletín fue citado en comisión (`citacion.semana_iso` + `citacion_punto.boletin` × `lobby_audiencia.fecha`) — ventana estrecha y defendible. NO la ventana completa de tramitación (años → coincidencia vacía de significado).
- Superficie: carril propio mt-12 en la ficha de PROYECTO ("Reuniones de lobby registradas en el mismo período"). SIN flag nuevo: es yuxtaposición de hechos fechados (como agenda×proyecto), NO señal acumulada tipo `cruce_senal`. Negative-match causal obligatorio.
- RPC nueva `lobby_en_tramitacion(p_boletin text)`: SECURITY DEFINER set search_path='', emite SOLO campos públicos (fecha, nombre de parlamentario confirmado, materia, enlace, semana coincidente/comisión), doble revoke + CERO grant (idiom 0047), entra a `PUBLIC_RPC_ALLOWLIST`, pgTAP acompañante. Apply = checkpoint operador. La UI degrada honesta pre-apply (RPC ausente → sección con estado honesto, jamás 500).
- Copy: "En la misma semana en que la comisión vio este proyecto se registraron N audiencias de lobby" + caveat 1×/sección ("coincidencia temporal; no implica relación") + fuente por fila.

### Proyecto→agenda inverso + home (SC3, SC4)
- SC3: query directa `.from("citacion_punto")` × `citacion` por boletín (tablas no-PII permitidas por el guard) — SIN RPC nueva. "Citado en {comisión} el {fecha}" como línea del bloque "¿Dónde está hoy?" (F51) cuando hay citación vigente/futura; historial breve opcional en el mismo carril de agenda del proyecto.
- SC4 home: 3 bloques compactos server-rendered bajo el hero — "Votado esta semana" (últimas votaciones con desenlace factual), "Urgencias vigentes" (REUSA la derivación de urgencia vigente de F51/estado-actual), "Última actualización de datos" (max `fecha_captura` por fuente). Cero JS cliente nuevo, cero carrusel.
- Queries del home: directas `.from()` sobre tablas no-PII (votacion, tramitacion_evento, proyecto, citacion) con límites acotados + React.cache — cero RPC nueva.
- Home rendering: `export const dynamic = "force-dynamic"` (patrón conocido post-F50; NO ISR — soporte OpenNext no verificado).

### Seguridad, verificación y doctrina (SC5)
- Migración nueva = 0048 (tras 0047 pendiente), doble revoke sin grant, pgTAP, allowlist actualizada. Apply a PROD = checkpoint operador ACUMULABLE con 0047 (un solo paso psql para ambas migraciones + pgTAPs).
- Escrituras de datos del clasificador permitidas al agente (no-DDL): `sector_id` + rebuild `cruce_senal` vía `materializar_cruces()`. Idempotente.
- NINGÚN flag `*_PUBLIC_ENABLED` se flipea (doctrina LOCKED). Los cruces sector ya están LIVE (0042 + Candado B aplicados); esta fase solo puebla datos.
- Verificación SC1: psql read-only contra PROD (conteos before/after, distinct, muestra de evidencia) pegada en SUMMARY.

### Claude's Discretion
- Microcopy exacto (banned-vocab del DESIGN-SYSTEM), layout de los bloques del home dentro del sistema crema/petróleo, tamaño de lotes del clasificador, orden interno de tareas.
- Forma exacta del retorno de `lobby_en_tramitacion` (columnas/orden) siempre que sea PII-safe y traiga provenance.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/cruces/src/clasificar-lobby-cli.ts` (:190 invocación, `--limite`/`--dry-run`, env `SUPABASE_SECRET_KEY`+`MINIMAX_API_KEY`; degrada a dry-run sin key) y `clasificar-fichas-cli.ts` (:237, DeepSeek `DEEPSEEK_API_KEY`, escribe `actualizarSectorFicha`).
- `packages/cruces/src/clasificar.ts:54-99` — routing ficha=DeepSeek(public/bulk) vs contraparte=MiniMax(personal/critical); `assertNoRutInLlmInput` PRIMERO (load-bearing).
- Golden gate: `packages/cruces/src/golden/golden-set.ts:35` (`COBERTURA_MIN=0.7`), LIVE gated por `CRUCES_GOLDEN_LIVE==="1"`.
- `cruces.materializar_cruces()` (0039, FULL REBUILD desde audiencias confirmadas con sector_id no-null); cron `23 3 * * *`; manual por psql.
- `scripts/run-with-env.mjs` — wrapper BOM-safe para CLIs que usan process.env directo.
- Ficha proyecto: `app/app/proyecto/[boletin]/page.tsx` (`.from proyecto_ficha:109/proyecto:150/tramitacion_evento:179/votacion:230`); bloque estado-actual F51 = `app/components/estado-actual-block.tsx` (derivación de urgencia vigente REUSABLE).
- Agenda: `citacion_punto` (0010:46-56, `boletin` nullable, `citacion_id`→`citacion` con comision/fecha/semana_iso); `/agenda` lee `.from("citacion")` directo.
- Home: `app/app/page.tsx` — solo hero SearchBox (pills LOCKED), cero queries. `app/components/search-box.tsx`.
- Lobby: `lobby_audiencia` (0021:30-49 — fecha, materia, parlamentario_id solo-confirmado, enlace_detalle, provenance) + `lobby_contraparte.sector_id` (0038).
- Guard: `app/lib/lockdown-guard.test.ts:165-181` `PUBLIC_RPC_ALLOWLIST` (15 RPCs); Block A bloquea TODO grant-to-anon/public en migraciones >0044 SIN excepciones (la exención F51 se revirtió); idiom = doble revoke. Ejemplo reciente completo: 0047 + su pgTAP (`not has_function_privilege('anon',...)`).
- `createServerSupabase()` = service_role (`SUPABASE_SECRET_KEY`), server-only; PII_TABLES prohibidas de `.from()` (incluye `cruce_senal` — leer señales SOLO vía RPC allowlisted).

### Established Patterns
- Corridas LIVE de datos por agente: dry-run → corrida acotada → verificación psql (patrón lobby 0→5.106, NET, agenda).
- RPC pública nueva: security definer + search_path='' + doble revoke + cero grant + allowlist + pgTAP + apply operador.
- Carriles mt-12 hermanos; honest-state 1×/sección; provenance por dato; banned-vocab negative-match.
- `dynamic = "force-dynamic"` para rutas con gate/datos vivos (gotcha F50: ruta estática horneada = 500).

### Integration Points
- `app/app/proyecto/[boletin]/page.tsx` — carril lobby-tramitación nuevo + línea de citación en estado-actual.
- `app/app/page.tsx` — módulo de actualidad (3 bloques).
- `supabase/migrations/0048_*.sql` + `supabase/tests/0048_*.test.sql` + allowlist.
- Suite app/ 497 verde baseline post-F51; `tsc -b` limpio; lockdown-guard verde.

</code_context>

<specifics>
## Specific Ideas

- Diagnóstico §3.2.1: "qué reuniones registró X mientras se tramitaba el boletín Y" / "quiénes se reunieron con diputados la semana en que la comisión vio el proyecto" — la segunda formulación es la implementada (ancla = semana ISO de citación).
- Diagnóstico §2.5: "Home = solo buscador. Un módulo de actualidad convertiría la portada en razón de retorno diario".
- `cruce_senal` hoy: 30 señales / 24 parlamentarios / 10 sectores (corrida acotada de F36 con 34/17.681 contrapartes clasificadas).

</specifics>

<deferred>
## Deferred Ideas

- F47 comparativos de votos y F49 asistencia comparada (fases propias desbloqueadas).
- Votación×sector (habilitado por esta corrida, pero la superficie es fase futura).
- Tiempos de tramitación por etapa (§3.2.3) y panorama de urgencias como página propia (§3.2.5 más allá del bloque home).
- Lobby×tramitación en la ficha de PARLAMENTARIO (dirección inversa).
- Buscador global unificado (§2.5).

</deferred>
