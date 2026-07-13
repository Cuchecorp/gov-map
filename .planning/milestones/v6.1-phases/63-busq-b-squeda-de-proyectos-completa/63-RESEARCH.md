# Phase 63: BUSQ — Búsqueda de proyectos completa - Research

**Researched:** 2026-07-10
**Domain:** Backfill de corpus (ingesta dos-etapas TS/Deno + Node), extracción LLM (DeepSeek), embeddings (Gemini 768 / pgvector HNSW), enumeración de fuentes gubernamentales, honestidad de cobertura en Next.js SSR.
**Confidence:** HIGH (todo verificado contra el código en disco y la DB de PROD via psql read-only 2026-07-10; enumeración BUSQ-02 verificada contra la fuente live)

## Summary

La búsqueda solo ve 74 de 156 proyectos porque el pipeline de fichas es **ciego a los 82 proyectos que no tienen fila en `proyecto_ficha`**. Verificado en PROD (2026-07-10): `proyecto`=156, `proyecto_ficha`=74, `proyecto_embedding`=74, fichas con idea=60. Los 82 sin ficha **sí tienen datos de tramitación** (título real, origen `senado-wspublico`) — solo falta la derivación ficha+embedding. La causa raíz del gap: `runIngest` (tramitación) hace `upsertProyecto` pero **nunca crea la fila `proyecto_ficha`**; y `pipeline-cli` de `@obs/fichas` lee pendientes SOLO de `proyecto_ficha` (`leerPendientes` → `.eq("estado","pendiente")` o `.in("boletin", …)` sobre esa tabla). Sin una fila ficha 'pendiente', el backfill no los toca — ni con `--boletines` explícitos. **Este es el bloqueador central de BUSQ-01 y hay que resolverlo con un paso de seeding de filas `proyecto_ficha` (estado='pendiente') para todo `proyecto` que no tenga una** (upsert idempotente, sin DDL).

Para BUSQ-02 (corpus histórico), la enumeración es el problema: ni el WS de votaciones de la Cámara (`wscamaradiputados.asmx`) ni el XML per-boletín del Senado enumeran proyectos por año — hay que conocer el boletín de antemano. **La fuente de enumeración verificada es `WSLegislativo.asmx` de la Cámara**: `retornarMocionesXAnno?prmAnno={año}` + `retornarMensajesXAnno?prmAnno={año}` devuelven colecciones `ProyectoLey` con `NumeroBoletin`, `Nombre`, `FechaIngreso`, `CamaraOrigen`, `Autores` — enumerando TODAS las mociones (parlamentarias) y mensajes (Ejecutivo) por año de ingreso. Una llamada WS por año por método cubre una legislatura completa barato. Los boletines así enumerados entran por el MISMO camino existente (`run-tramitacion-prod-cli --boletines …` → proyecto+autores+R2, luego seed ficha + `pipeline-cli`).

Para BUSQ-03 (honestidad), `/buscar` no declara cobertura hoy y `pnpm freshness` no reporta N/M de búsqueda. Extensiones baratas: un contador `count(*)` server-side (cacheado) en `/buscar`, y una fila/sección de cobertura en freshness o un reporte equivalente. El techo honesto ya está instrumentado: `proyecto_ficha.estado`/`error_msg` registran causa (verificado: 8 RUT-bloqueados con `error_msg='input contains a RUT; RUT must never be sent to an LLM'`, 3 `LLM output failed schema validation`). **No inventar tracking nuevo — usar estas columnas.**

**Primary recommendation:** BUSQ-01 = agregar un paso de **seed de `proyecto_ficha` pendientes** (idempotente, LOCAL) que cierre el gap de 82, luego correr `pipeline-cli` LOCAL para procesarlos + `--reembed` de los 8 `v1` stale; BUSQ-02 = enumerar con `WSLegislativo retornarMociones/MensajesXAnno` por años de la legislatura vigente, ingerir vía `run-tramitacion-prod-cli --boletines` (R2 primero) + seed ficha + pipeline; BUSQ-03 = contador de cobertura real en `/buscar` + extensión de freshness. Todo LOCAL, rate-limit 2-3s, reanudable, techo honesto por causa registrada.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Diagnóstico (verificado 2026-07-09 via psql read-only, no re-investigar; RE-VERIFICADO 2026-07-10, idéntico):**
- `proyecto`: **156** · `proyecto_ficha`: **74** · `proyecto_embedding`: **74** · fichas con `idea_matriz`: **60**. → /buscar (RPC `match_proyectos`, HNSW cosine 768) solo ve 74; el usuario percibe "no encuentra los históricos / faltan ideas".
- Corpus actual = set incremental proyecto∪citacion_punto∪sesion_tabla_item (boletines vistos en agenda/votación/tabla desde jun-2026) — NO hay históricos por diseño previo.
- Techo conocido de v3 (2026-06-23): de los intentos previos quedaron 8 boletines RUT/WAF-bloqueados, 1 PDF escaneado, 5 sin idea literal. `proyecto_ficha` tiene columnas `estado`/`error_msg`/`texto_r2_path` — el pipeline YA registra causa; usarlas, no inventar tracking nuevo.
- Pipeline existente: `@obs/fichas` `pipeline-cli`/`correrPipeline` (fetch texto via R2 gate → DeepSeek extracción literal con golden gate ≥0.95 → Gemini embed 768 → upsert). Reanudable. HANDOFF-search-coverage-2026-06-23.md documenta cómo correrlo para faltantes.

**(a) Gap interno — BUSQ-01:**
- Backfill LOCAL con `pipeline-cli` para los 82 proyectos sin ficha + re-intento de los fallidos registrados. R2 primero (convención LOCKED). Reporte final por boletín: ok / techo-honesto(causa). Meta: fichas==embeddings==proyectos o diferencia 100% explicada.

**(b) Corpus histórico — BUSQ-02:**
- La fase DECIDE el alcance tras research de fuentes de enumeración. Alcance recomendado por defecto (ajustable por lo que la fuente permita): **legislatura actual completa (2022→hoy)**; si la enumeración lo hace barato, extender hacia atrás por años completos.
- Los proyectos nuevos entran por el MISMO camino: proyecto (tramitación) + ficha + embedding + autores (el pipeline de 59 ya cuelga del flujo) + crudo a R2 content-addressed ANTES de parsear.
- El set incremental del cron leyes-weekly NO debe explotar: el cron sigue en novedades acotadas; el histórico es one-shot LOCAL. Verificar que la ampliación no rompa los límites de la corrida semanal (criterio 5).

**(c) Honestidad de cobertura — BUSQ-03:**
- /buscar declara: "Busca sobre N proyectos de ley (alcance X)" — número REAL desde la DB (contar en server, cachear), no hardcodeado.
- Operador: cobertura N/M por señal (proyectos/fichas/ideas/embeddings) visible sin bucear — extender `pnpm freshness` con una sección "cobertura búsqueda" o reporte equivalente (elegir lo más barato).
- Ideas matrices: los imposibles conservan estado honesto en ficha ("idea matriz no disponible — {causa}" ya existe como patrón).

**Límites duros:**
- Backfill masivo = LOCAL (jamás GH Actions). Rate-limit 2-3s/host, UA, robots. R2 antes de parsear. Idempotente/reanudable (segunda corrida = solo faltantes). DeepSeek/Gemini con golden gates existentes intactos (extracción literal ≥0.95 sigue bloqueando). Cero flags, cero DDL salvo additivo estrictamente necesario (no se anticipa ninguno). GEMINI/DEEPSEEK keys de .env.
- Corridas largas: checkpoints de progreso en logs + resumible; si una fuente bloquea (WAF), backoff y techo honesto, jamás martillar.

### Claude's Discretion
- Fuente exacta de enumeración histórica y alcance final (documentar el porqué), batching, orden del backfill, dónde vive el contador de cobertura.

### Deferred Ideas (OUT OF SCOPE)
- Ingesta on-demand de boletín buscado ausente (encolar + "disponible pronto").
- Búsqueda full-text sobre el texto íntegro de las leyes.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUSQ-01 | Todo proyecto tiene ficha+embedding; backfill LOCAL completa el gap, reintenta fallidos, registra causa; techo honesto documentado. | **Root cause identificada:** 82 proyectos sin fila `proyecto_ficha` (verificado PROD). Fix = seed idempotente de filas `proyecto_ficha` estado='pendiente' para todo `proyecto` sin ficha, LUEGO `pipeline-cli`. Fallidos = 8 RUT-bloqueados (techo real, no fixeable) + 3 schema-fail (revisables). 8 embeddings `v1` stale → `--reembed`. |
| BUSQ-02 | Cobertura histórica ampliada; enumerar+ingerir alcance definido y declarado, LOCAL, R2 primero, idempotente. | **Fuente de enumeración verificada:** `WSLegislativo.asmx retornarMocionesXAnno` + `retornarMensajesXAnno` (`prmAnno`) → `ProyectoLey[]` con `NumeroBoletin`. Ingesta via `run-tramitacion-prod-cli --boletines` (R2 Etapa-1 existente) + seed ficha + pipeline. Alcance recomendado: legislatura 2022→2026 por años. |
| BUSQ-03 | Cobertura real visible al operador (freshness/metodologia) y declarada en /buscar si opera sobre subconjunto. | `/buscar` server-side (page.tsx) puede `count(*)` proyecto/embedding cacheado. `pnpm freshness` (catalog/query-runner/evaluate) extensible con señal de cobertura. Estados honestos ya existen en `proyecto_ficha.estado`/`error_msg`. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Enumerar proyectos históricos por año | Backend / CLI Node (LOCAL) | Fuente gob (Cámara WSLegislativo) | Backfill masivo = LOCAL (LOCKED); enumeración es una llamada WS por año, no per-request. |
| Descargar crudo → R2 (Etapa 1) | Backend / CLI + R2 (object storage) | — | Convención LOCKED dos-etapas: fuente→R2 ANTES de parsear; content-addressed. |
| Parsear R2 → Supabase (Etapa 2) | Backend / CLI + Supabase (DB) | — | Derivado reconstruible desde R2; nunca re-molesta la fuente. |
| Seed `proyecto_ficha` pendientes | Backend / CLI + Supabase | — | Cierra el gap 82; upsert idempotente por boletín (service key, server-side). |
| Extracción idea matriz (DeepSeek) | Backend / CLI + LLM externo | — | `criticality:bulk sensitivity:public`; gate RUT + golden ≥0.95 intactos. |
| Embedding 768 (Gemini) | Backend / CLI + LLM externo | — | `RETRIEVAL_DOCUMENT`; pgvector HNSW cosine. |
| Búsqueda semántica en runtime | Frontend Server (Next.js SSR, server-only) | Supabase RPC + Gemini | `import "server-only"`; key nunca al cliente; ya implementado. |
| Declaración de cobertura en /buscar | Frontend Server (SSR) | Supabase (count) | Número real cacheado server-side; no hardcodear. |
| Reporte de cobertura al operador | Backend / CLI (freshness) | Supabase (count read-only) | `pnpm freshness` ya es el canal de señales de ingesta. |
| Frescura del corpus nuevo | Backend / CI (leyes-weekly cron) | — | Cron = novedades acotadas; histórico = one-shot LOCAL (no re-backfill). |

## Standard Stack

Todo el stack ya existe en el repo — **esta fase NO introduce dependencias nuevas.** Se reusan paquetes del workspace.

### Core (reuso, no instalación)
| Paquete/Módulo | Rol en esta fase | Ubicación | Confianza |
|----------------|------------------|-----------|-----------|
| `@obs/tramitacion` `run-tramitacion-prod-cli.ts` | Ingesta proyecto+autores+eventos+votos, R2 Etapa-1, `--boletines` explícitos | `packages/tramitacion/src/run-tramitacion-prod-cli.ts` | HIGH [VERIFIED: leído] |
| `@obs/tramitacion` `CamaraConnector` | Fetch WS Cámara reusando política @obs/ingest (allowlist→robots→rate-limit→fetch) | `packages/tramitacion/src/connector-camara.ts` | HIGH [VERIFIED: leído] |
| `@obs/fichas` `pipeline-cli.ts` / `correrPipeline` | Backfill fichas+embeddings reanudable (texto→R2→DeepSeek→Gemini→upsert) | `packages/fichas/src/pipeline-cli.ts`, `pipeline.ts` | HIGH [VERIFIED: leído] |
| `@obs/fichas` `SupabaseFichasWriter` | `leerPendientes`, `upsertFicha`, `upsertEmbedding`, `marcarError` (idempotente por boletín) | `packages/fichas/src/writer-supabase.ts` | HIGH [VERIFIED: leído] |
| `@obs/ingest` `Fetcher/HostRateLimiter/RobotsGuard/R2Store/assertAllowedUrl` | Política LOCKED de ingesta respetuosa + SSRF + R2 content-addressed | `packages/ingest` | HIGH [VERIFIED: usado por conectores] |
| `@obs/llm` `DeepSeekProvider`, `GeminiEmbeddingProvider` | Extracción (json_object+zod) y embeddings 768; gates RUT/golden dentro del provider | `packages/llm` | HIGH [VERIFIED: referenciado] |
| `@obs/freshness` (catalog/query-runner/evaluate/cli) | Señales de frescura al operador; extensible a cobertura | `packages/freshness/src` | HIGH [VERIFIED: leído] |
| Next.js App Router `/buscar` (server-only `lib/buscar.ts`) | Runtime de búsqueda; punto de inserción de la declaración de cobertura | `app/app/buscar/page.tsx`, `app/lib/buscar.ts` | HIGH [VERIFIED: leído] |
| `fast-xml-parser` 5.x | Parsear el XML de `retornarMociones/MensajesXAnno` (nuevo parser de enumeración) | ya dependencia de `@obs/tramitacion` | HIGH [CITED: CLAUDE.md] |
| `zod` | Validar el shape enumerado (contrato de fuente) | ya en workspace | HIGH [CITED: CLAUDE.md] |

### Supporting
| Módulo | Rol | Cuándo |
|--------|-----|--------|
| `unpdf` | Extraer texto de PDFs (mensaje/moción); detecta escaneados (< 200 chars → null) | Ya en `texto-fuente.ts`; se ejerce en el backfill |
| `SnapshotWriter` / `source_snapshot` | Provenance del snapshot R2 (FND-08); alimenta señal R2 de freshness | Ya cableado en `run-tramitacion-prod-cli` |
| `psql` (`SUPABASE_DB_URL`) | Conteos de cobertura read-only (seed detection, reporte, verificación) | PGCLIENTENCODING=UTF8 (o LATIN1 si bytes inválidos) |

### Alternatives Considered
| En vez de | Se podría usar | Tradeoff |
|-----------|----------------|----------|
| Enumerar con `WSLegislativo retornarMociones/MensajesXAnno` (Cámara) | XML per-boletín del Senado `tramitacion.php` | El Senado NO enumera — exige conocer el boletín. Descartado como fuente de enumeración; sigue siendo la fuente de tramitación per-boletín. |
| Enumerar con `WSLegislativo` | `descubrirBoletines` del `CamaraConnector` (por sesiones/votaciones) | Verificado LIVE 2026-06-18: devuelve [] (el WS de votaciones no enumera proyectos por año). `WSLegislativo` sí. |
| Seed de `proyecto_ficha` en un paso dedicado | Extender `leerPendientes` a hacer `left join proyecto` y auto-crear | Auto-crear filas dentro del reader mezcla lectura y escritura; un paso de seed explícito (idempotente) es más claro y testeable, y no cambia el contrato del pipeline. |
| Contador de cobertura cacheado en `/buscar` (server) | Materialized view / RPC dedicado | `count(*)` sobre `proyecto`/`proyecto_embedding` es barato; cache Next.js (revalidate) evita DDL. RPC solo si se quiere exponer a anon con RLS. |

**Installation:** Ninguna. Verificado que `@obs/fichas`, `@obs/tramitacion`, `@obs/freshness` ya están en `pnpm-workspace.yaml`. Correr con `pnpm --filter @obs/<pkg> exec tsx src/<cli>.ts`.

## Package Legitimacy Audit

**N/A — esta fase no instala paquetes externos nuevos.** Todo el stack (`@obs/*` workspace, `fast-xml-parser`, `zod`, `unpdf`, `@supabase/supabase-js`, `openai`, `@google/genai`) ya está instalado y en uso en fases previas (v1.0–v6.0), verificado en `package.json` de cada paquete. No hay superficie de slopsquatting nueva. Si el planner decidiera añadir una lib (no se anticipa), correr el Package Legitimacy Gate antes.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
                          │  BUSQ-02: ENUMERACIÓN HISTÓRICA (nuevo, LOCAL)│
                          └─────────────────────────────────────────────┘
  [año 2022..2026] ──► WSLegislativo.asmx                (Cámara, política @obs/ingest:
        │               retornarMocionesXAnno?prmAnno=N   allowlist→robots→rate-limit 2-3s→fetch)
        │               retornarMensajesXAnno?prmAnno=N
        ▼
   fast-xml-parser ──► ProyectoLey[] { NumeroBoletin, Nombre, FechaIngreso, CamaraOrigen }
        │              (validar con zod = contrato de fuente)
        ▼
   lista de boletines históricos ─────────────┐
                                              │
  ┌────────────────────────────────────────── ▼ ──────────────────────────────────────┐
  │  CAMINO EXISTENTE DE INGESTA (idempotente, R2 primero)                              │
  │                                                                                     │
  │  run-tramitacion-prod-cli --boletines <lista>                                       │
  │     ├─ Etapa 1: fetch Senado/Cámara → envelope crudo → R2 (content-addressed,       │
  │     │           If-None-Match; existed=true ⇒ skip)                                 │
  │     └─ Etapa 2: parse R2/crudo → upsertProyecto + upsertAutores + votos + eventos   │
  │                 ──► tabla `proyecto` (+ proyecto_autor, votacion, voto)             │
  └─────────────────────────────────┬───────────────────────────────────────────────── ┘
                                     │
       ┌─────────────────────────────▼─────────────────────────────────┐
       │  BUSQ-01: SEED DE FICHAS PENDIENTES (nuevo paso, cierra gap 82) │
       │  para todo `proyecto` sin fila en `proyecto_ficha`:            │
       │     upsert proyecto_ficha { boletin, estado:'pendiente', … }   │  ← idempotente
       └─────────────────────────────┬─────────────────────────────────┘
                                     │
   ┌──────────────────────────────── ▼ ─────────────────────────────────────────────────┐
   │  pipeline-cli (@obs/fichas)  —  reanudable, LOCAL, rate-limit                        │
   │    leerPendientes(proyecto_ficha estado='pendiente')                                 │
   │      └─ resolverLink: SenadoConnector.fetchTramitacion → linkMensajeMocion           │
   │    obtenerTextoFuente(link)  → http→https, PDF magic-bytes, unpdf; R2 backup; null si:│
   │        link ausente / robots / SSRF / PDF escaneado (<200 chars) → DEGRADA HONESTO   │
   │    extraer(texto, provider=DeepSeek)  → idea_matriz + cuerpos  [gate RUT + golden]   │
   │    embedFicha  → Gemini 768 RETRIEVAL_DOCUMENT (idea si hay; si no título+materia)   │
   │    upsert: ficha 'pendiente' → embedding → ficha 'embebido'  (crash-safe order)      │
   │    fallo permanente → marcarError(estado='error', error_msg)  ← TECHO HONESTO        │
   │            ──► proyecto_ficha + proyecto_embedding                                    │
   └──────────────────────────────────┬───────────────────────────────────────────────── ┘
                                      │
        ┌──────────────────────────── ▼ ─────────────────────────────┐
        │  RUNTIME (ya existe)                                        │
        │  /buscar → embed query (Gemini RETRIEVAL_QUERY, server-only)│
        │          → RPC match_proyectos (HNSW cosine, threshold 0.59)│
        │          → hidrata `proyecto`                               │
        │  BUSQ-03: + declaración "Busca sobre N proyectos (alcance)" │
        │           N = count(proyecto_embedding) cacheado server-side│
        └────────────────────────────────────────────────────────────┘

  BUSQ-03 (operador):  pnpm freshness  ──► + señal cobertura N/M (proyecto/ficha/idea/embedding)
  Frescura del corpus nuevo:  leyes-weekly.yml (viernes) refresca proyecto∪citacion_punto∪
                              sesion_tabla_item con --limite 80  (NO re-backfilla histórico)
```

### Recommended Project Structure (dónde tocar)
```
packages/
├── tramitacion/src/
│   ├── connector-camara.ts        # AÑADIR: método enumerarProyectosXAnno (WSLegislativo)
│   ├── parse-camara-legislativo.ts# NUEVO: parse ProyectoLey[] (fast-xml-parser + zod)
│   └── run-enumerar-historico-cli.ts  # NUEVO (opción): CLI LOCAL que enumera años → boletines
├── fichas/src/
│   └── writer-supabase.ts         # AÑADIR: seedFichasPendientes() o CLI de seed
│       (o packages/fichas/src/seed-fichas-cli.ts NUEVO)
└── freshness/src/
    └── (catalog.ts | cli.ts)      # AÑADIR: señal de cobertura de búsqueda N/M
app/
├── app/buscar/page.tsx            # AÑADIR: banner "Busca sobre N proyectos (alcance X)"
└── lib/coverage.ts (NUEVO opción) # count(proyecto_embedding) server-only, cacheado
```

### Pattern 1: Seed idempotente de `proyecto_ficha` pendientes (cierra el gap BUSQ-01)
**What:** Antes de correr el pipeline, insertar una fila `proyecto_ficha` estado='pendiente' para cada `proyecto` que no tenga una. El pipeline entonces las "ve" y las procesa.
**When to use:** SIEMPRE antes del backfill de fichas cuando `count(proyecto) > count(proyecto_ficha)`.
**Why it's needed:** `runIngest` upserta `proyecto` pero nunca `proyecto_ficha` (verificado). `leerPendientes` lee `proyecto_ficha`, no `proyecto`. Sin seed, los 82 son invisibles incluso con `--boletines`.
```typescript
// Patrón (nuevo): seed idempotente. Espeja upsertFicha existente (onConflict 'boletin').
// SQL equivalente (read-only detection ya verificado en PROD 2026-07-10):
//   insert into proyecto_ficha (boletin, cuerpos_legales, estado, origen, fecha_captura)
//   select p.boletin, '[]'::jsonb, 'pendiente', 'fichas-seed', now()
//   from proyecto p left join proyecto_ficha f on f.boletin = p.boletin
//   where f.boletin is null
//   on conflict (boletin) do nothing;   -- idempotente
// En TS: SELECT los boletines sin ficha, luego writer.upsertFicha([{...estado:'pendiente'}])
// con ignoreDuplicates o do-nothing. NO tocar filas existentes (no re-abrir 'embebido'/'error').
```

### Pattern 2: Enumeración histórica via WSLegislativo (BUSQ-02)
**What:** Por cada año del alcance, GET `retornarMocionesXAnno?prmAnno={año}` y `retornarMensajesXAnno?prmAnno={año}`, parsear `ProyectoLey[]`, extraer `NumeroBoletin`.
**When to use:** One-shot LOCAL para poblar el corpus histórico. NO en el cron.
**Example:**
```typescript
// Nuevo método en CamaraConnector (reusa this.fetch = política LOCKED @obs/ingest):
const BASE_LEG = "https://opendata.camara.cl/camaradiputados/WServices/WSLegislativo.asmx";
async enumerarProyectosXAnno(anno: number): Promise<string[]> {
  const out = new Set<string>();
  for (const op of ["retornarMocionesXAnno", "retornarMensajesXAnno"]) {
    const xml = await this.fetch(`${BASE_LEG}/${op}?prmAnno=${anno}`); // rate-limit 2-3s dentro
    for (const m of xml.matchAll(/<NumeroBoletin>\s*([\d]+-\d+)\s*<\/NumeroBoletin>/g)) {
      if (m[1]) out.add(m[1]);
    }
  }
  return [...out];
}
// Preferir fast-xml-parser + zod para el shape completo si se quiere FechaIngreso/CamaraOrigen;
// regex basta para solo extraer boletines. Verificar el shape con UNA llamada live antes de
// codificar el parser (patrón "máx pocas fetches live" de CONTEXT).
```
**Source:** [CITED: opendata.camara.cl/camaradiputados/WServices/WSLegislativo.asmx?op=retornarMocionesXAnno] — verificado 2026-07-10: parámetro `prmAnno` (int); respuesta `ProyectoLey[]` con `NumeroBoletin` (string), `Nombre`, `FechaIngreso`, `Admisible`, `Autores`, `CamaraOrigen`, `Materias`, `TipoIniciativa`.

### Pattern 3: Declaración de cobertura server-side cacheada (BUSQ-03)
**What:** En `/buscar`, mostrar "Busca sobre N proyectos de ley (alcance X)" con N = `count(proyecto_embedding)` leído en el server y cacheado.
```typescript
// app/lib/coverage.ts (server-only). Cache con Next.js revalidate para no contar en cada request.
import "server-only";
import { createServerSupabase } from "@/lib/supabase";
export async function contarCoberturaBusqueda(): Promise<number> {
  const sb = createServerSupabase();
  const { count } = await sb.from("proyecto_embedding").select("*", { count: "exact", head: true });
  return count ?? 0;
}
// En page.tsx (Server Component): const n = await contarCoberturaBusqueda();
// Copy honesto: alcance = "legislatura 2022–2026" (o el que la fase decida e ingiera).
```

### Anti-Patterns to Avoid
- **Correr `pipeline-cli --boletines <82>` sin seed previo:** no procesará nada (los 82 no tienen fila `proyecto_ficha`; `leerPendientes` devuelve []). Bug silencioso "0 procesados".
- **Re-abrir fichas 'embebido'/'error' en el seed:** el seed debe ser `do nothing`/`ignoreDuplicates` por boletín — solo crea las faltantes. Reprocesar todo es caro y borra el techo honesto registrado.
- **Enumerar con el WS de votaciones (`wscamaradiputados.asmx`):** no enumera proyectos por año (verificado LIVE 2026-06-18: `retornarVotacionesXAnno` no expone boletines de proyecto por esa vía). Usar `WSLegislativo.asmx`.
- **Hardcodear N en /buscar:** el número debe venir de la DB (LOCKED). Un N stale miente.
- **Meter el histórico en el cron leyes-weekly:** el cron es novedades acotadas (`--limite 80` sobre proyecto∪agenda). El histórico es one-shot LOCAL. Mezclarlos rompe el criterio 5.
- **Reintentar RUT-bloqueados enviándolos al LLM:** el gate `assertNoRutInLlmInput` es compliance LOCKED (RUT nunca al LLM). Esos 8 son techo honesto permanente, NO un bug.
- **Backfill masivo en GitHub Actions:** convención LOCKED. `fichas-backfill.yml` existe pero es workflow_dispatch manual (escape hatch); el masivo va LOCAL.

## Don't Hand-Roll

| Problema | No construir | Usar | Por qué |
|----------|--------------|------|---------|
| Rate-limit / robots / SSRF / UA | Un fetch loop propio con `setTimeout` | `@obs/ingest` `Fetcher`+`HostRateLimiter`+`RobotsGuard`+`assertAllowedUrl` (via connectors) | Política LOCKED probada; el WAF gob bloquea ráfagas; SSRF allowlist deny-by-default. |
| R2 content-addressed + hash-check | PUT manual a R2 | `R2Store.putImmutable` (Etapa 1 en `runIngest`/`texto-fuente`) | `If-None-Match:*`, 412=existía=éxito idempotente; ya cableado. |
| Extracción idea matriz + guard RUT | Prompt+parse propio | `@obs/fichas` `extraer` (DeepSeekProvider con gate RUT + golden ≥0.95) | La fidelidad literal la garantiza el golden gate, no zod; el guard RUT es compliance. |
| Embedding 768 + normalización L2 | Llamar Gemini a mano | `GeminiEmbeddingProvider` / `embedFicha` (RETRIEVAL_DOCUMENT) | Dims/taskType/L2 correctos para HNSW cosine. |
| Idempotencia de upsert | INSERT + catch dup | `SupabaseFichasWriter.upsertFicha/Embedding` (onConflict 'boletin', dedupePorClave) | Evita `command cannot affect row a second time`; crash-safe order. |
| Reanudabilidad del backfill | Tracking en archivo | `proyecto_ficha.estado` ('pendiente'/'embebido'/'error') | Reanuda solo 'pendiente'; techo honesto en 'error'+error_msg. Ya en DB. |
| Señales de frescura al operador | Script SQL ad-hoc | `pnpm freshness` (catalog/query-runner/evaluate) | Canal establecido; extender el catálogo, no reinventar. |

**Key insight:** El 90% de esta fase es **orquestación de piezas existentes** + un paso nuevo pequeño (seed de fichas) + un método de enumeración nuevo (WSLegislativo). El riesgo NO está en construir cosas nuevas sino en (a) omitir el seed y creer que el pipeline "no funciona", y (b) elegir mal la fuente de enumeración.

## Runtime State Inventory

Esta es una fase de backfill/ingesta, no un rename — pero sí toca estado almacenado. Inventario relevante:

| Categoría | Items encontrados | Acción requerida |
|-----------|-------------------|------------------|
| Stored data (DB) | `proyecto`=156, `proyecto_ficha`=74 (66 embebido, 8 error), `proyecto_embedding`=74 (66 `v1-reembed` + 8 `v1` stale title-only), idea=60. **82 proyectos sin fila ficha.** | Data migration: seed 82 fichas pendientes + backfill pipeline; `--reembed` los 8 `v1` stale. |
| Stored data (R2) | Crudo content-addressed `fuente/recurso/fecha/sha256`; `fichas/texto-fuente/…` y `tramitacion/<boletin>/…`. Snapshots existentes se saltan (existed=true). | Ninguna extra: R2 primero es automático en el camino existente. |
| Live service config | `source_snapshot` (provenance R2) alimenta la señal R2 de freshness; se escribe best-effort en la ingesta. | Ninguna manual. |
| OS-registered state | Ninguno (no hay Task Scheduler/pm2 para este flujo; el cron vive en GitHub Actions). | None — verificado: solo `.github/workflows/*.yml`. |
| Secrets/env vars | `.env` presente con `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `R2_*`, `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL` — todos verificados presentes 2026-07-10. GH secrets (Cuchecorp/gov-map) para el cron: verificados VERDE en v6.0. | None — code lee de `.env`/process.env. Backfill LOCAL usa `.env`. |
| Build artifacts | `app/.open-next/` (build OpenNext), `app/.next/` (dev). Si se toca `/buscar` o `lib/`, redeploy via runbook 61-02 (docker Linux + wrangler). | Redeploy solo si cambia `app/` (BUSQ-03 UI). El backfill de datos se ve sin redeploy (SSR data-driven). |

## Common Pitfalls

### Pitfall 1: El pipeline "no procesa" los 82 (gap de seeding)
**What goes wrong:** `pipeline-cli` reporta "0 procesados" para los 82 boletines sin ficha, incluso con `--boletines`.
**Why it happens:** `leerPendientes` consulta `proyecto_ficha`; los 82 no tienen fila ahí. `runIngest` nunca creó la fila ficha (solo `proyecto`).
**How to avoid:** Paso de seed idempotente de `proyecto_ficha` estado='pendiente' ANTES del pipeline (Pattern 1). Verificar con `count(proyecto)==count(proyecto_ficha)` tras el seed.
**Warning signs:** `count(proyecto_ficha)` no sube tras correr el pipeline; logs "conjunto vacío".

### Pitfall 2: Elegir la fuente de enumeración equivocada
**What goes wrong:** `descubrirBoletines` (CamaraConnector, WS de votaciones) devuelve [] → "no hay históricos que enumerar".
**Why it happens:** El `wscamaradiputados.asmx` (votaciones) no enumera proyectos por año; verificado LIVE 2026-06-18.
**How to avoid:** Usar `WSLegislativo.asmx retornarMociones/MensajesXAnno` (verificado 2026-07-10). Confirmar el shape con UNA llamada live antes de codificar el parser.
**Warning signs:** Enumeración vacía para años con proyectos conocidos.

### Pitfall 3: PDF del mensaje/moción = link, no texto inline; escaneados degradan
**What goes wrong:** Se decodifica un PDF como UTF-8 → basura; o se espera texto y llega null.
**Why it happens:** `link_mensaje_mocion` del Senado resuelve a PDF. `texto-fuente.ts` detecta magic bytes `%PDF-` → unpdf; escaneados (<200 chars no-blancos) → null honesto (OCR diferido).
**How to avoid:** Ya manejado en el código. El "1 PDF escaneado" del techo conocido cae aquí — es techo real, registrar causa.
**Warning signs:** boletín queda con idea_matriz null y texto_r2_path presente.

### Pitfall 4: RUT en el texto fuente bloquea la extracción (compliance, no bug)
**What goes wrong:** 8 boletines fallan con `error_msg='input contains a RUT; RUT must never be sent to an LLM'`.
**Why it happens:** Guard de compliance LOCKED (`assertNoRutInLlmInput`) dentro del provider: RUT nunca va al LLM.
**How to avoid:** NO reintentar enviándolos al LLM. Registrar como techo honesto permanente (estado='error', causa=RUT). Contarlos en el reporte de cobertura como "no procesables por RUT".
**Warning signs:** reintentos repetidos gastando llamadas; error_msg RUT recurrente.

### Pitfall 5: Embeddings `v1` stale (title-only) contaminan la relevancia
**What goes wrong:** 8 embeddings `v1` son title-only (pre-reembed rico), degradan la búsqueda.
**Why it happens:** Corrida antigua sin idea matriz; el reembed rico (`v1-reembed`) cubrió 66 pero no los 8.
**How to avoid:** `pipeline-cli --reembed` re-embebe todos con bump de versión; o dirigido a esos 8. Verificar `select embedding_version, count(*) from proyecto_embedding group by 1` post-corrida.
**Warning signs:** `v1` sigue apareciendo en el conteo de versiones.

### Pitfall 6: El cron leyes-weekly explota con el corpus ampliado
**What goes wrong:** Tras ingerir históricos, la unión proyecto∪agenda crece; el cron refresca cientos de boletines → excede tiempo/WAF.
**Why it happens:** `boletinesARefrescar` incluye TODO `proyecto`. Con `--limite 80` (default) se recorta, pero prioriza agenda sobre proyectos ya ingeridos.
**How to avoid:** Verificar que `DEFAULT_LIMITE=80` sigue acotando; el orden (agenda primero) garantiza que lo reciente se refresca. Confirmar que la corrida semanal no re-backfilla el histórico (solo refresca cambios de etapa/votos). Documentar en la verificación (criterio 5).
**Warning signs:** leyes-weekly excede su ventana o el WAF empieza a 403ear.

### Pitfall 7: Contador de cobertura hardcodeado o stale
**What goes wrong:** `/buscar` dice "N proyectos" con un número fijo que miente tras el backfill.
**Why it happens:** Tentación de hardcodear en vez de `count(*)`.
**How to avoid:** Leer `count(proyecto_embedding)` server-side con cache Next.js (revalidate razonable, p.ej. 1h). LOCKED: número real desde DB.

## Code Examples

### Detección del gap (read-only, ya verificado en PROD)
```sql
-- Proyectos sin fila ficha (los 82 invisibles al pipeline):
select count(*) from proyecto p
left join proyecto_ficha f on f.boletin = p.boletin
where f.boletin is null;   -- => 82 (2026-07-10)

-- Cobertura por estado + techo honesto:
select estado, count(*) from proyecto_ficha group by estado;         -- embebido=66, error=8
select count(*) from proyecto_ficha where idea_matriz is not null and idea_matriz<>'';  -- 60
select embedding_version, count(*) from proyecto_embedding group by 1; -- v1=8, v1-reembed=66
```

### Backfill LOCAL end-to-end (secuencia recomendada)
```bash
# 0) (opción) enumerar históricos → lista de boletines (BUSQ-02)
pnpm --filter @obs/tramitacion exec tsx src/run-enumerar-historico-cli.ts --desde 2022 --hasta 2026
#    → escribe/imprime la lista de boletines nuevos

# 1) ingerir tramitación de los nuevos (R2 Etapa-1 automático) — BUSQ-02
pnpm --filter @obs/tramitacion exec tsx src/run-tramitacion-prod-cli.ts --boletines <lista>

# 2) seed de fichas pendientes para TODO proyecto sin ficha (cierra gap 82) — BUSQ-01
pnpm --filter @obs/fichas exec tsx src/seed-fichas-cli.ts    # NUEVO, idempotente

# 3) backfill fichas+embeddings (reanudable, rate-limit) — BUSQ-01
pnpm --filter @obs/fichas exec tsx src/pipeline-cli.ts --limite 200
#    reanudar: re-correr procesa solo estado='pendiente' restantes

# 4) re-embeber los 8 v1 stale — BUSQ-01
pnpm --filter @obs/fichas exec tsx src/pipeline-cli.ts --reembed

# 5) verificar cobertura
pnpm freshness            # + señal de cobertura (BUSQ-03)
```
**Source:** [VERIFIED: pipeline-cli.ts / run-tramitacion-prod-cli.ts leídos 2026-07-10]. Flags `--boletines`, `--limite`, `--reembed`, `--dry-run` confirmados. Sin `SUPABASE_SECRET_KEY` → degrada a dry-run (aviso).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Corpus = set incremental agenda∪votación∪tabla (sin históricos) | Corpus ampliado por enumeración `WSLegislativo` por año | Esta fase (63) | Búsqueda deja de ser "solo lo visto en agenda". |
| Pipeline asume filas `proyecto_ficha` pre-existentes | Seed explícito de fichas pendientes desde `proyecto` | Esta fase (63) | Cierra el gap estructural 82 (root cause del "solo 74"). |
| /buscar sin declaración de cobertura | Declaración "Busca sobre N proyectos (alcance)" cacheada | Esta fase (63) | Honestidad: el usuario sabe sobre qué buscó. |

**Deprecated/outdated:**
- `descubrirBoletines` por sesiones/votaciones (CamaraConnector): no enumera proyectos — no usar como fuente histórica (sigue siendo válido para votaciones).
- `obtenerinfoley` de BCN: obsoleto (404, CLAUDE.md) — irrelevante aquí.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `retornarMocionesXAnno`/`retornarMensajesXAnno` cubren TODAS las iniciativas (mociones=parlamentarias + mensajes=Ejecutivo) con `NumeroBoletin`. | Pattern 2 / BUSQ-02 | Si un tipo de iniciativa no aparece, el histórico queda incompleto — mitiga: confirmar shape con 1 llamada live + comparar conteo contra un año conocido antes de codificar. Documentado como discreción de la fase (alcance). |
| A2 | El WSLegislativo NO tiene WAF (fetch nativo Node OK, como el WS de votaciones/opendata). | Pattern 2 | Si hay WAF (como camara.cl citaciones), habría que usar `createCurlTransport` (@obs/agenda). Mitiga: primera llamada live detecta 403; el patrón curl-transport ya existe si se necesita. |
| A3 | El seed de fichas pendientes NO requiere DDL (la tabla `proyecto_ficha` ya existe con estado/error_msg). | Pattern 1 | Verificado contra migraciones 0011+0013 — sin riesgo. Solo INSERT ... ON CONFLICT DO NOTHING. |
| A4 | Alcance por defecto = legislatura 2022→2026 es "manejable" con rate-limit 2-3s LOCAL. | BUSQ-02 | Si la enumeración devuelve miles de boletines por año, el backfill de fichas (1 PDF+DeepSeek+Gemini por boletín, 2-3s) puede tardar horas. Mitiga: reanudable + checkpoints + `--limite`; la fase decide y documenta el alcance final tras ver los conteos de enumeración. |
| A5 | Cron leyes-weekly con `--limite 80` sigue acotado tras ampliar el corpus. | Pitfall 6 | Si el corpus supera ~80 y agenda es pequeña, algunos proyectos viejos no se refrescan semanalmente — aceptable (histórico no cambia de etapa a menudo). Verificar en criterio 5. |

## Open Questions

1. **¿Cuántos boletines devuelve la enumeración por año (2022–2026)?**
   - Qué sabemos: `retornarMociones/MensajesXAnno` existen y traen `NumeroBoletin`.
   - Qué falta: el volumen real por año (define si el alcance por defecto es viable en una corrida LOCAL razonable).
   - Recomendación: primera tarea de la fase = 1 llamada live por método/año, contar, decidir el alcance final y documentar el porqué (es discreción explícita de la fase).

2. **¿Los 3 boletines con `error_msg='LLM output failed schema validation'` (estado='embebido') son recuperables?**
   - Qué sabemos: quedaron embebidos con título+materia (no idea), pero la extracción falló schema.
   - Qué falta: si un reintento con el repair loop actual los recupera o son texto irregular.
   - Recomendación: incluirlos en el reintento del pipeline; si vuelven a fallar, techo honesto (registrar causa).

3. **¿Dónde vive el "alcance X" que declara /buscar?**
   - Qué sabemos: debe ser honesto y coincidir con lo realmente ingerido.
   - Recomendación: derivar de los datos (p.ej. rango de años de `FechaIngreso` / min-max boletín) o un string documentado en `/metodologia` + `/buscar`. Discreción de la fase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `.env` con SUPABASE/DEEPSEEK/GEMINI/R2 keys | Backfill LOCAL | ✓ | — (18 keys verificadas 2026-07-10) | — |
| `SUPABASE_DB_URL` (psql) | Detección/verificación cobertura | ✓ | — | supabase-js count() |
| `psql` en PATH | Queries read-only de verificación | ✓ | — (usado en esta research) | supabase-js |
| WSLegislativo.asmx (Cámara) | Enumeración BUSQ-02 | ✓ | — (endpoint live 2026-07-10) | curl-transport si WAF (A2) |
| tramitacion.senado.cl/wspublico | Tramitación + link mensaje/moción | ✓ | — (usado por conectores) | — |
| DeepSeek API | Extracción idea matriz | ✓ (key en .env) | V4 | degrada honesto (idea null) |
| Gemini API | Embeddings 768 | ✓ (key en .env) | gemini-embedding-001 | degrada (embed título+materia) |
| R2 (Cloudflare) | Etapa 1 crudo | ✓ (creds en .env) | S3-compat | texto en memoria, r2Path null (degrada) |
| tsx / pnpm | Correr CLIs | ✓ | pnpm workspace | — |

**Missing dependencies with no fallback:** Ninguna.
**Missing dependencies with fallback:** OCR de PDFs escaneados (diferido); si WSLegislativo tiene WAF → curl-transport (A2).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (raíz `vitest.config.ts`; cada paquete `test: "vitest run"`) |
| Config file | `vitest.config.ts` (raíz) + por paquete |
| Quick run command | `pnpm --filter @obs/fichas test` (o `@obs/tramitacion`, `@obs/freshness`) |
| Full suite command | `pnpm test` (todos los paquetes + `app`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUSQ-01 | Seed crea fila 'pendiente' solo para proyectos sin ficha; idempotente (no re-abre 'embebido'/'error') | unit | `pnpm --filter @obs/fichas exec vitest run src/seed-fichas.test.ts` | ❌ Wave 0 |
| BUSQ-01 | `correrPipeline` procesa 'pendiente', degrada honesto (null→título+materia), marca 'error' con causa | unit | `pnpm --filter @obs/fichas exec vitest run src/pipeline.test.ts` | ✅ (existe; ampliar) |
| BUSQ-01 | Backfill deja `count(proyecto)==count(proyecto_ficha)==count(embedding)` o diferencia explicada | integration (manual/DB) | `psql "$SUPABASE_DB_URL" -At -f scripts/verify-cobertura.sql` | ❌ Wave 0 (SQL) |
| BUSQ-02 | `enumerarProyectosXAnno` parsea `NumeroBoletin` de `ProyectoLey[]` (fixture XML) | unit | `pnpm --filter @obs/tramitacion exec vitest run src/parse-camara-legislativo.test.ts` | ❌ Wave 0 |
| BUSQ-02 | Enumeración reusa política @obs/ingest (rate-limit/robots/SSRF) — no fetch crudo | unit | `pnpm --filter @obs/tramitacion exec vitest run src/connector-camara.test.ts` | ✅ (existe; ampliar) |
| BUSQ-03 | `/buscar` muestra "Busca sobre N proyectos" con N desde DB (mock count) | unit (RTL) | `pnpm --filter ./app exec vitest run app/buscar/coverage.test.tsx` | ❌ Wave 0 |
| BUSQ-03 | freshness reporta señal de cobertura N/M | unit | `pnpm --filter @obs/freshness exec vitest run src/evaluate.test.ts` | ✅ (existe; ampliar) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/<paquete-tocado> test` (quick, < 30s por paquete)
- **Per wave merge:** `pnpm test` (suite completa; línea base v6.0 ~763 verde)
- **Phase gate:** Suite completa verde + verificación DB (conteos de cobertura) antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/fichas/src/seed-fichas.test.ts` — seed idempotente, solo faltantes (BUSQ-01)
- [ ] `packages/fichas/src/seed-fichas-cli.ts` — CLI de seed (o método en writer) (BUSQ-01)
- [ ] `packages/tramitacion/src/parse-camara-legislativo.test.ts` + `parse-camara-legislativo.ts` + fixture XML de `retornarMocionesXAnno` (BUSQ-02)
- [ ] `packages/tramitacion/src/run-enumerar-historico-cli.ts` (o método en CamaraConnector + wiring) (BUSQ-02)
- [ ] `app/app/buscar/coverage.test.tsx` + `app/lib/coverage.ts` (BUSQ-03)
- [ ] `scripts/verify-cobertura.sql` — conteos de cobertura para verificación/reporte
- [ ] Ampliar `evaluate.test.ts` / `catalog.ts` para la señal de cobertura de búsqueda (BUSQ-03)

## Security Domain

`security_enforcement: true`, ASVS level 1. Esta fase es backend/ingesta + un cambio menor de SSR.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Backfill LOCAL usa service key de `.env`; no auth de usuario nueva. |
| V3 Session Management | no | Sin sesiones nuevas. |
| V4 Access Control | yes | `match_proyectos` + tablas ficha/embedding tienen RLS public-read explícito (0011). El writer usa service key server-side (bypassa RLS). La cuenta de cobertura en /buscar solo lee `count(*)` (público). NO exponer columnas no-públicas. |
| V5 Input Validation | yes | `prmAnno` de enumeración = int validado (rango razonable) antes del fetch. `NumeroBoletin` parseado = validar con `BOLETIN_RE`/zod antes de mandarlo al WS (defensa: no basura al servidor gob). Query de /buscar ya capea ≤300 (T-07-09). |
| V6 Cryptography | no | Sin cripto nueva; R2 usa S3 SDK (TLS). |

### Known Threat Patterns for {backfill LOCAL + WSLegislativo + Gemini/DeepSeek + Next.js SSR}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via link_mensaje_mocion / URL WS | Tampering | `assertAllowedUrl` deny-by-default (allowlist gob) — ya en connectors y texto-fuente. |
| RUT/PII enviado a LLM | Information Disclosure | Guard `assertNoRutInLlmInput` LOCKED dentro del provider (fail-closed). 8 boletines correctamente bloqueados. NUNCA desactivar. |
| API keys (Gemini/DeepSeek/service) filtradas a cliente o logs | Information Disclosure | `import "server-only"` en lib/buscar; keys de `.env`/process.env, nunca en URL/body/logs; error.message de PostgREST no contiene la key (verificado en writers). |
| Ráfagas al servidor gob (DoS reputacional) | Denial of Service | Rate-limit 2-3s/host + UA identificatorio + robots (política @obs/ingest); backoff, jamás martillar. |
| Command injection en CLI (argv con secretos) | Elevation/Tampering | Secretos SOLO de `.env`/process.env, nunca por argv (patrón LOCKED de run-*-prod-cli e inputs por ENV en workflows). |
| Inyección de boletín malformado al WS | Tampering | `encodeURIComponent` + `BOLETIN_RE` (defensa: no mandar basura al WS gob). |

## Sources

### Primary (HIGH confidence)
- Código en disco (leído 2026-07-10): `packages/fichas/src/{pipeline-cli,pipeline,writer-supabase,texto-fuente,extraer}.ts`, `packages/tramitacion/src/{run-tramitacion-prod-cli,ingest-cli,ingest-run,connector-camara,connector-senado,writer,writer-supabase,parse-senado-tramitacion}.ts`, `packages/freshness/src/{catalog,cli,query-runner,evaluate}.ts`, `app/app/buscar/page.tsx`, `app/lib/buscar.ts`, `app/app/metodologia/page.tsx`, `supabase/migrations/{0011,0013}*.sql`, `.github/workflows/{leyes-weekly,fichas-backfill}.yml`.
- PROD DB (psql read-only, `SUPABASE_DB_URL`, 2026-07-10): conteos proyecto/ficha/embedding/idea, distribución de estado y error_msg, gap de 82, versiones de embedding, rango de boletines.
- [CITED: opendata.camara.cl/camaradiputados/WServices/WSLegislativo.asmx] — lista de operaciones (retornarMociones/MensajesXAnno, retornarProyectoLey, etc.), verificado 2026-07-10.
- [CITED: opendata.camara.cl/…/WSLegislativo.asmx?op=retornarMocionesXAnno] — parámetro `prmAnno`, respuesta `ProyectoLey[]` con `NumeroBoletin`/`Nombre`/`FechaIngreso`/`CamaraOrigen`/`Autores`.
- CLAUDE.md (Conventions LOCKED: dos etapas, hash-check, rate-limit 2-3s, backfill LOCAL) + MEMORY.md (gotchas v6.0: dos entrypoints CLI, deploy runbook).

### Secondary (MEDIUM confidence)
- WebSearch: existencia de `WSLegislativo.asmx` como servicio separado del de votaciones (cross-verificado con el WebFetch de la página del WS).
- HANDOFF-search-coverage-2026-06-23.md (histórico, marcado COMPLETED): manual de uso del pipeline-cli, causas de techo de v3.

### Tertiary (LOW confidence)
- Ninguna claim crítica depende solo de WebSearch sin verificación.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todo el código leído en disco; sin deps nuevas.
- Root cause BUSQ-01 (gap de seeding): HIGH — verificado en PROD (82 sin ficha) + trazado en el código (runIngest no crea ficha; leerPendientes lee ficha).
- Enumeración BUSQ-02: HIGH para "WSLegislativo enumera con NumeroBoletin" (verificado live); MEDIUM para volumen/alcance exacto (Open Question 1, discreción de la fase).
- Pitfalls / techo honesto: HIGH — causas verificadas en `error_msg` de PROD (RUT, schema, PDF escaneado).
- BUSQ-03 puntos de inserción: HIGH — /buscar y freshness leídos; sin DDL.

**Research date:** 2026-07-10
**Valid until:** 2026-08-10 (stack estable; re-verificar conteos de PROD antes de planificar si pasa el mes, y confirmar shape de WSLegislativo con 1 fetch live al inicio de la fase).
