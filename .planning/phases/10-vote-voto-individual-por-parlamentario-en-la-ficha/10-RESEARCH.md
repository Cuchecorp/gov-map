# Phase 10: VOTE — Voto individual por parlamentario en la ficha (BACKEND/conector) - Research

**Researched:** 2026-06-19
**Domain:** Promoción de un spike validado LIVE a conector de producción (`@obs/votos`) que enriquece el modelo `voto`/`votacion` existente (0008/0009) cruzando determinísticamente por `DIPID → id_diputado_camara`, + las queries/RPC que la sección VOTE de `/parlamentario/[id]` necesita (lista de votos, asistencia, voto×tema, rebeldías) bajo RLS public-read.
**Confidence:** HIGH para el conector (todo el pipeline ya existe en `@obs/tramitacion` y corrió LIVE en Phase 8); MEDIUM-HIGH para las queries de la ficha (se infieren del esquema 0008/0011 + patrón v1.0 `/proyecto/[boletin]`); las decisiones de esquema nuevo (asistencia/ausente, índice por parlamentario, rebeldías server-side) son las únicas piezas genuinamente nuevas y están marcadas como tales.

## Summary

El conector de producción es esencialmente **cero ingeniería nueva de fetch/parse/cruce**: `packages/tramitacion/src/{connector-camara, parse-camara-votacion, reconciliar-camara, writer, writer-supabase, ingest-run}.ts` ya implementan el flujo completo (descubrir → fetch en orden LOCKED → parse XML `tempuri.org` → cruce determinista por DIPID minteando `EnlaceConfirmado` → upsert idempotente por clave natural `(votacion_id, fuente_voter_id)`). Phase 8 lo corrió LIVE el 2026-06-19 con mapeo DIPID 100% sobre Leg-58. Promover `@obs/votos` significa darle a ese paquete (hoy solo `spike/`) un `src/` con un CLI/runner delgado que **reusa esos símbolos verbatim** y orquesta una corrida acotada de la legislatura vigente. [VERIFIED: codebase grep — los 6 archivos existen y exportan los símbolos]

La pieza que NO existe y que el planner debe decidir explícitamente: **la asistencia y las opciones no-nominales por diputado**. `parseCamaraVotoDetalle` OMITE deliberadamente toda opción que no sea sí/no nominal (No Vota / Abstención / dispensado / Pareo → `null` → descartado), y la columna `voto.seleccion` tiene un CHECK que solo admite `si|no|abstencion|pareo` (NO existe `ausente`). VOTE-03 pide mostrar "A favor / En contra / Abstención / Pareo / Ausente" Y la asistencia — eso requiere (a) extender el parser para emitir abstención/pareo/ausente como filas propias y (b) una migración menor que añada `ausente` al CHECK de `seleccion`. Sin esto, la ficha solo puede mostrar sí/no y NO puede mostrar asistencia honestamente. Esta es la decisión técnica central de la fase.

Las otras dos piezas nuevas: (1) **un índice `voto(parlamentario_id)`** (hoy solo existe `voto(votacion_id)`) — sin él, la query "todos los votos de este parlamentario" hace un seq-scan; es una migración trivial sobre 0008. (2) **Rebeldías (VOTE-05) DEBE computarse server-side** porque requiere `parlamentario.partido`, columna que está bajo RLS deny-by-default (anon NUNCA la lee); la mayoría-de-bancada por votación no puede calcularse en el cliente. La opción más limpia es un RPC `security definer` que devuelve solo el conteo+lista (datos públicos derivados), nunca la bancada cruda.

**Primary recommendation:** Promover `@obs/votos` como un paquete que reusa `@obs/tramitacion`/`@obs/ingest` verbatim y expone un runner acotado por legislatura vigente; añadir UNA migración (0019) que (a) agregue `ausente` al CHECK de `voto.seleccion`, (b) cree el índice `voto_parlamentario_id_idx`, (c) cree un RPC `votos_de_parlamentario(p_id, ...)` y un RPC `rebeldias_de_parlamentario(p_id)` ambos público-grant; extender `parseCamaraVotoDetalle` para emitir las 5 opciones (no solo sí/no). NUNCA fabricar un voto: ausente/no-ingestado son estados honestos distintos.

## User Constraints (from CONTEXT.md)

<user_constraints>
### Locked Decisions
- **Página nueva `/parlamentario/[id]`:** crear la primera ficha del parlamentario, con sección de votos. INT (Phase 11/12) y MONEY (14-16) agregan secciones después. Reusa VERBATIM el design system cívico de v1.0 (ProvenanceBadge, IdentityMarker, CamaraChip, tokens `--camara`/`--senado`/`--provenance`/`--identity-warn`).
- **Conector `@obs/votos` de producción:** promueve el spike de Phase 8 (`packages/votos/spike` → `packages/votos/src`). Reusa `@obs/ingest` en el orden LOCKED (assertAllowedUrl → robots → rateLimiter.wait → fetcher.get), reusa los parsers de v1.0 (`parseCamaraVotoDetalle`) y `reconciliarVotosCamara`. Cruce determinista por `DIPID` → `id_diputado_camara`, sin LLM, provenance por fila. Enriquece `voto`/`votacion` (modelo 0008/0009), NO crea modelo nuevo. Writer idempotente por clave natural. Usa el invariante tipado `EnlaceConfirmado` de Phase 9 para fijar el FK.
- **Layout de votos:** agrupada por votación/fecha, paginada; cada fila = opción (A favor/En contra/Abstención/Pareo/Ausente) + boletín enlazado a `/proyecto/[boletin]` + ProvenanceBadge. Reusa el patrón voto-a-voto de la ficha de proyecto v1.0.
- **Voto × tema:** faceta/filtro por materia reusando los embeddings/materia de v1.0; vista de lista. SIN score, SIN lenguaje de afinidad ("vota alineado con X" prohibido).
- **Rebeldías:** conteo bruto + lista de esas votaciones; etiqueta neutra ("votó distinto a su bancada N veces"); SIN juicio ni interpretación. Requiere conocer la bancada/partido del parlamentario (ya en la maestra) y el voto mayoritario de su bancada por votación.
- **Tres estados honestos por fila:** (a) enlazado-confirmado → link al parlamentario/voto (estado_vinculo='confirmado'); (b) presente-no-verificado → mención cruda + IdentityMarker, nunca link; (c) no-ingestado → vacío honesto explícito. Un vacío NUNCA se lee como "limpio/sin votos".

### Claude's Discretion
- Ubicación exacta del código de producción dentro de `packages/votos/src/`.
- Cómo se computa la mayoría de bancada para rebeldías (RPC vs vista materializada vs en el runner del conector) — el research recomienda RPC `security definer`.
- Cuáles votaciones recientes de Leg-58 incluir en la corrida acotada.

### Deferred Ideas (OUT OF SCOPE)
- Secciones INT (lobby/patrimonio) y MONEY de la ficha → Phases 11/12/14-16.
- Grafo NET → Phase 18.
- Backfill histórico masivo de todas las legislaturas → follow-up operativo (corrida LIVE grande vía GitHub Actions).
</user_constraints>

## Phase Requirements

<phase_requirements>
| ID | Description | Research Support |
|----|-------------|------------------|
| VOTE-02 | El conector `@obs/votos` ingiere el voto individual por diputado y lo cruza determinísticamente por `DIPID → id_diputado_camara`, enriqueciendo el modelo de voto existente con provenance por fila (sin LLM). | `reconciliarVotosCamara` ya mintea `confirmar(p.id,"determinista")` por DIPID; `runIngest`/`writer-supabase` ya upsertan idempotente por `(votacion_id, fuente_voter_id)`. El conector de prod es un runner delgado sobre estos. (Standard Stack, Pattern 1-2) |
| VOTE-03 | El ciudadano ve, en la ficha del parlamentario, la lista de sus votos (A favor/En contra/Abstención/Pareo/Ausente) y su asistencia, con la guarda de identidad aplicada. | **GAP**: el parser y el CHECK de `seleccion` solo soportan sí/no; falta `ausente` + abstención/pareo por diputado. Migración 0019 + extensión del parser (Pitfall 1, Architecture). Query por `voto(parlamentario_id)` + nuevo índice. VotoRow reusa la guarda LOCKED. |
| VOTE-04 | El ciudadano puede ver cómo vota un parlamentario por tema/materia del proyecto (reusa los embeddings de v1.0). | Join `voto → votacion → proyecto.materia` (faceta cruda) y/o `proyecto_embedding` para agrupación semántica. SIN score. (Pattern 4) |
| VOTE-05 | El ciudadano ve una métrica observable de "rebeldías" (cuántas veces votó distinto a su bancada), presentada como dato. | **GAP**: requiere `parlamentario.partido` (RLS deny-by-default) → debe computarse server-side vía RPC `security definer` que devuelve solo el conteo+lista pública. (Pattern 5, Pitfall 4) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch tras WAF (rate-limit/robots/UA/SSRF) | Conector `@obs/votos` (Node tier) reusando `@obs/ingest` | — | Política LOCKED vive UNA vez en `@obs/ingest`; el conector solo arma URLs y ensambla colaboradores. [VERIFIED: connector-camara.ts:59-65] |
| Parse XML `getVotacion_Detalle` | `@obs/tramitacion` (`parseCamaraVotoDetalle`) | — | `fast-xml-parser@5`; el shape ya está resuelto. **Necesita extensión** para opciones no-nominales (VOTE-03). |
| Cruce determinista DIPID→persona | `@obs/tramitacion` (`reconciliarVotosCamara`) | `@obs/identity` (`confirmar`) | Identificador oficial, sin LLM; mintea `EnlaceConfirmado` (IDENT-12). [VERIFIED: reconciliar-camara.ts:86] |
| Persistencia idempotente | `@obs/tramitacion` (`SupabaseTramitacionWriter`) | — | Upsert por `(votacion_id, fuente_voter_id)`; service key, bypassa RLS. [VERIFIED: writer-supabase.ts:90-99] |
| Query "votos de un parlamentario" | **API/DB** (RPC o `.from('voto').eq('parlamentario_id', ...)`) | Frontend Server Component (lectura) | Lectura por anon bajo RLS public-read; necesita índice `voto(parlamentario_id)`. |
| Rebeldías (mayoría de bancada) | **API/DB** (RPC `security definer`) | — | `parlamentario.partido` está bajo RLS deny-by-default → no se puede calcular client/anon-side. Debe vivir server-side. (Pitfall 4) |
| Voto×tema | **API/DB** (join voto→votacion→proyecto.materia / embedding) + Frontend | — | Faceta cruda por materia; sin score. |
| Render de votos + 3 estados | Frontend Server (Next.js 16 RSC) | — | Reusa VotoRow/IdentityMarker/ProvenanceBadge; la guarda de identidad ya está en VotoRow. |

## Standard Stack

No se instala NINGÚN paquete nuevo. Todo el conector reusa workspace packages ya presentes; las queries usan `@supabase/supabase-js` v2 (ya en `app/`) y SQL en una migración nueva.

### Core (reusado verbatim — ya instalado)
| Símbolo | De | Propósito | Por qué estándar |
|---------|----|-----------|--------------------|
| `CamaraConnector` | `@obs/tramitacion` | `fetchVotacionesBoletin` + `fetchVotacionDetalle` + `descubrirBoletines` en orden LOCKED | El conector validado LIVE; reusar, no forkear. [VERIFIED: connector-camara.ts] |
| `parseCamaraVotacion` / `parseCamaraVotoDetalle` | `@obs/tramitacion` | XML → `Votacion[]` (totales) / `CamaraVotoDetalle[]` por diputado | Maneja el shape REAL `tempuri.org`. **`parseCamaraVotoDetalle` necesita extensión** (ver GAP). [VERIFIED: parse-camara-votacion.ts:197-263] |
| `reconciliarVotosCamara` | `@obs/tramitacion` | Cruce determinista DIPID→`id_diputado_camara`, mintea `EnlaceConfirmado` | Choke point de minteo IDENT-12; fail-closed. [VERIFIED: reconciliar-camara.ts] |
| `runIngest` | `@obs/tramitacion` (`ingest-run.ts`) | Orquesta descubrir→fetch→parse→reconciliar→upsert, tolera fuentes vacías, aislado por boletín | Idempotente; el runner de `@obs/votos` puede llamarlo o un subset Cámara-only. [VERIFIED: ingest-run.ts:106] |
| `SupabaseTramitacionWriter` / `InMemoryTramitacionWriter` | `@obs/tramitacion` | Upsert idempotente por clave natural; dedup pre-lote | `onConflict: 'votacion_id,fuente_voter_id'`. [VERIFIED: writer-supabase.ts] |
| `VotoParaEscribir` / `aplanarVoto` / `confirmar` / `EnlaceConfirmado` | `@obs/tramitacion` + `@obs/identity` | FK branded — un `parlamentario_id` string crudo NO compila (IDENT-12) | El writer del voto YA exige el branded type. [VERIFIED: writer.ts:28-37, identity/index.ts] |
| `Fetcher`, `HostRateLimiter`, `RobotsGuard`, `assertAllowedUrl` | `@obs/ingest` | Política de red LOCKED (allowlist `camara.cl` sufijo ya cubre `opendata.camara.cl`) | Sin edición de allowlist (confirmado Phase 8). [VERIFIED: spike.ts:90, 08-SUMMARY] |
| `cargarMaestra` / `findWorkspaceRoot` | `@obs/tramitacion` (`ingest-cli.ts`) | Carga la maestra del seed autoritativo (186 filas, 155 con DIPID) | Read-only; alimenta el cruce. [VERIFIED: ingest-cli.ts:131] |
| `createServerSupabase` | `app/lib/supabase.ts` | Cliente anon server-only para las lecturas de la ficha (RLS public-read) | Patrón v1.0 de `/proyecto/[boletin]`. [VERIFIED: supabase.ts] |
| `VotoRow`, `VotoDetalle`, `IdentityMarker`, `ProvenanceBadge`, `CamaraChip`, `VotacionBar` | `app/components/*` | Render de voto con la guarda LOCKED de identidad + provenance | Reuso verbatim; VotoRow ya enlaza a `/parlamentario/${id}` SOLO si confirmado. [VERIFIED: voto-row.tsx:34-46] |

### Supporting
| Item | Propósito | Cuándo usar |
|------|-----------|-------------|
| `vitest` | Tests del runner + RPCs (offline con fixtures + LIVE-gated) | Siempre — gate Nyquist. [VERIFIED: votos/package.json] |
| `pgTAP` | Tests de las migraciones nuevas (CHECK `ausente`, RPCs, RLS grant) | Migración 0019 (espejo de los pgTAP de 0018). |
| `proyecto_embedding` + RPC `match_proyectos` | Faceta semántica de voto×tema (VOTE-04) | Si se quiere agrupar por tema vía embedding en vez de `materia` cruda. [VERIFIED: 0011] |

### Alternatives Considered
| En vez de | Se podría usar | Tradeoff |
|-----------|----------------|----------|
| Reusar `runIngest` completo (Senado+Cámara) | Un runner Cámara-only en `@obs/votos` | VOTE solo necesita Cámara (el voto individual viene de `opendata.camara.cl`); un runner Cámara-only evita arrastrar el provider LLM del Senado. Pero `runIngest` ya degrada fail-closed sin provider — reusarlo es menos código. Discreción del planner. |
| RPC `security definer` para rebeldías | Vista materializada `rebeldia` poblada por el conector | El RPC computa on-read (siempre fresco, simple); la vista materializada es más rápida pero requiere refresco por `pg_cron`. Para Leg-58 acotada, el RPC basta. |
| `voto.seleccion` += `ausente` | Tabla `asistencia` separada | Una columna `ausente` en `voto` (con `parlamentario_id` cruzado por DIPID del roster) mantiene un modelo; una tabla separada duplica el cruce. Recomendado: extender `seleccion`. |
| Índice b-tree `voto(parlamentario_id)` | Índice parcial `where parlamentario_id is not null` | El parcial es más pequeño (la mayoría de filas Senado son null) y sirve igual la query de la ficha (siempre filtra por un id concreto). Recomendado: parcial. |

**Installation:** Ninguna. `pnpm` ya tiene los workspace packages. La migración 0019 se aplica con el flujo de migraciones existente (`supabase db push` / `psql --db-url` — ojo BOM del `.env`, ver Pitfall 5).

## Package Legitimacy Audit

> **No aplica.** Esta fase instala CERO paquetes externos. Todo se importa de workspace packages in-repo (`@obs/ingest`, `@obs/tramitacion`, `@obs/identity`, `@obs/core`) y dependencias ya bloqueadas (`fast-xml-parser@5`, `@supabase/supabase-js@2`, `vitest`, `pgTAP`). No hay superficie de registry/slopcheck que auditar.

## Architecture Patterns

### System Data Flow (conector + ficha)

```
                          CONECTOR @obs/votos (Node/CI tier, server-only)
┌──────────────────────────────────────────────────────────────────────────────┐
│ runner (packages/votos/src/run.ts) — corrida ACOTADA Leg-58                     │
│   sample = boletines explícitos (14309, 18296, …) o descubrirBoletines(58)      │
│        │                                                                         │
│        ▼ reusa @obs/ingest en ORDEN LOCKED                                       │
│   assertAllowedUrl → robots.isAllowed → rateLimiter.wait(2–3s) → fetcher.get     │
│        │                                                                         │
│        ▼ (A) getVotaciones_Boletin?prmBoletin=  → Votacion[] + totales           │
│        ▼ (B) getVotacion_Detalle?prmVotacionId= → voto-a-voto                    │
│   parseCamaraVotacion / parseCamaraVotoDetalle  [GAP: emitir 5 opciones]         │
│        │                                                                         │
│        ▼ reconciliarVotosCamara(crudos, votacionId, maestra)                     │
│   DIPID ∈ maestra  → confirmar(p.id,"determinista") → estado='confirmado'        │
│   DIPID ∉ maestra  → enlace=null, estado='no_confirmado' (fail-closed)           │
│        │                                                                         │
│        ▼ SupabaseTramitacionWriter.upsert{Votacion,Votos}                        │
│   idempotente por (votacion_id, fuente_voter_id=DIPID)                           │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                     ▼  Postgres (voto / votacion / proyecto)
┌──────────────────────────────────────────────────────────────────────────────┐
│ FICHA /parlamentario/[id]  (Next.js 16 RSC, anon, RLS public-read)              │
│   createServerSupabase()                                                        │
│   ├─ VOTE-03 lista: RPC votos_de_parlamentario(p_id, limit, offset)             │
│   │      → join voto×votacion×proyecto, ordenado por fecha, paginado            │
│   │      → estados: confirmado(link) / no_confirmado(crudo+marker) / vacío      │
│   ├─ VOTE-04 voto×tema: facetar por votacion→proyecto.materia / embedding       │
│   └─ VOTE-05 rebeldías: RPC rebeldias_de_parlamentario(p_id) → conteo+lista     │
│        (security definer: lee partido bajo RLS, devuelve SOLO derivado público) │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
packages/votos/
├── package.json            # ya existe (@obs/votos); deps @obs/{core,ingest,tramitacion}; añadir @obs/identity si el runner lo toca
├── spike/                  # THROWAWAY de Phase 8 — eliminar o dejar como histórico
└── src/                    # PRODUCCIÓN (nuevo)
    ├── index.ts            # barrel: exporta el runner
    ├── run-camara-votos.ts # runner acotado: arma colaboradores + reusa runIngest/subset Cámara
    ├── run-camara-votos.test.ts        # offline (InMemoryWriter + fixtures)
    └── run-camara-votos.live.test.ts   # LIVE-gated (VOTOS_LIVE=1), corrida acotada

supabase/migrations/
└── 0019_voto_asistencia_y_ficha.sql    # ausente al CHECK + índice voto(parlamentario_id) + RPCs + grants

app/app/parlamentario/[id]/
├── page.tsx                # primera ficha del parlamentario; sección de votos
└── not-found.tsx
app/components/
├── parlamentario-header.tsx        # nuevo (espeja ficha-header.tsx)
├── votos-por-parlamentario.tsx     # nuevo: lista paginada + 3 estados + voto×tema + rebeldías
└── (reusa) voto-row, identity-marker, provenance-badge, camara-chip
```

### Pattern 1: Conector de producción = runner delgado que reusa el pipeline (NO reescribir)
**What:** El "conector de producción" no es código de fetch/parse/cruce nuevo — es un runner que ensambla los colaboradores LOCKED y llama el pipeline existente. El spike (`spike.ts`) ya demostró exactamente este ensamblaje; la versión de prod cambia (a) que SÍ escribe a Supabase (writer real, no in-memory) y (b) que acota por legislatura vigente.
**When:** Siempre para `@obs/votos`.
**Example:**
```typescript
// Source: derivado de spike.ts:87-97 + ingest-cli.ts:167-198 (patrón verbatim de prod)
import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import {
  CamaraConnector, SenadoConnector, runIngest,
  SupabaseTramitacionWriter, InMemoryTramitacionWriter,
  cargarMaestra, findWorkspaceRoot,
} from "@obs/tramitacion";

const deps = { fetcher: new Fetcher(), rateLimiter: new HostRateLimiter(), robots: new RobotsGuard({ allowlist: {} }) };
const maestra = cargarMaestra(findWorkspaceRoot(process.cwd()), log);
const writer = serviceKey ? new SupabaseTramitacionWriter({ url, serviceKey }) : new InMemoryTramitacionWriter();

const res = await runIngest({
  boletines,            // explícitos (corrida acotada) o vacío → descubrirBoletines(58)
  legislaturaId: 58,    // Leg vigente
  limite,               // recorte WAF/tiempo
  maestra, camara: new CamaraConnector(deps), senado: new SenadoConnector(deps), writer, log,
});  // idempotente: re-correr no duplica
```
[VERIFIED: ingest-cli.ts:167-198 es exactamente este ensamblaje en prod hoy]

### Pattern 2: El FK del voto SOLO se fija vía `confirmar()` (IDENT-12, ya enforced)
**What:** `reconciliarVotosCamara` es un mint site legítimo: en el match por DIPID llama `confirmar(p.id, "determinista")`; el miss deja `enlace: null`. El writer del voto exige `EnlaceConfirmado | null` — un string crudo NO compila. El planner NO debe tocar esto; ya está correcto.
**Example:**
```typescript
// Source: reconciliar-camara.ts:76-102 (verbatim)
const voto: VotoParaEscribir = p !== undefined
  ? { votacion_id, fuente_voter_id: dipid, mencion_nombre, enlace: confirmar(p.id, "determinista"),
      seleccion, metodo: "determinista", estado_vinculo: "confirmado" }
  : { votacion_id, fuente_voter_id: dipid || `seq:${i}`, mencion_nombre, enlace: null,
      seleccion, metodo: null, estado_vinculo: "no_confirmado" };  // fail-closed
```

### Pattern 3: Lectura de la ficha con los 3 estados honestos (RSC + RLS public-read)
**What:** Server Component lee `voto` por `parlamentario_id` (estado confirmado) PERO también debe poder mostrar el estado (b) presente-no-verificado. Sutileza: una fila `no_confirmado` tiene `parlamentario_id = null`, así que NO aparece al filtrar por `parlamentario_id = X`. Por eso "presente-no-verificado" en la ficha del parlamentario X solo es relevante si existe una mención cruda atribuible a X sin confirmar — en la práctica, para Cámara el DIPID confirma al 100%, así que (b) será raro; ocurre en Senado (cruce por nombre). El estado (c) no-ingestado es el empty-state explícito cuando el parlamentario no tiene NINGÚN voto en la DB (≠ "votó limpio").
**Example:**
```tsx
// Source: patrón de proyecto/[boletin]/page.tsx:155-179 + voto-row.tsx
const { data: votos } = await sb.rpc("votos_de_parlamentario", { p_id: id, p_limit: 20, p_offset: 0 });
if (!votos || votos.length === 0) {
  return <p>No hay votos ingeridos para este parlamentario en la legislatura vigente. (Esto NO significa que no haya votado: significa que aún no se han ingerido.)</p>;  // estado (c): vacío honesto
}
// cada fila: VotoRow ya aplica la guarda — link SOLO si estado_vinculo='confirmado' && parlamentario_id!=null
```

### Pattern 4: Voto×tema sin score (VOTE-04)
**What:** Facetar la lista de votos por el tema/materia del proyecto. Dos caminos, ambos SIN afinidad:
- **Cruda (preferente, simple):** join `voto → votacion → proyecto.materia`; agrupar/filtrar por el string `materia`. Es un dato literal de la fuente.
- **Semántica (opcional):** usar `proyecto_embedding` para agrupar proyectos por cercanía y ofrecer "temas" derivados; pero exponer SOLO la materia/título, jamás un número de afinidad voto↔tema.
**Anti-pattern PROHIBIDO:** cualquier columna/etiqueta del tipo "vota X% a favor en seguridad" presentada como afinidad, alineación o tendencia. Es un conteo crudo por faceta, nada más.
```sql
-- faceta cruda: cuántos sí/no/abst/pareo/ausente por materia para un parlamentario
select pr.materia, v.seleccion, count(*) as n
from voto v join votacion vo on vo.id = v.votacion_id
            join proyecto pr on pr.boletin = vo.boletin
where v.parlamentario_id = $1
group by pr.materia, v.seleccion;   -- la UI muestra conteos por materia; CERO score
```

### Pattern 5: Rebeldías server-side (VOTE-05) — RPC `security definer`
**What:** "Votó distinto a su bancada" requiere (1) el `partido` del parlamentario (RLS deny-by-default — anon NO lo lee) y (2) la opción mayoritaria de ese partido por votación. Ambos cálculos tocan `parlamentario.partido`, así que NO pueden vivir en el cliente ni en una query anon. Solución: un RPC `security definer` que lee `parlamentario` internamente y devuelve SOLO el derivado público (conteo + lista de votaciones donde difirió). Nunca expone la bancada cruda de nadie.
```sql
-- security definer: corre con privilegios del owner (puede leer parlamentario.partido);
-- devuelve SOLO datos públicos derivados (votacion_id + seleccion del parlamentario + mayoría).
create function rebeldias_de_parlamentario(p_id text)
returns table (votacion_id text, boletin text, fecha timestamptz,
               seleccion_propia text, mayoria_bancada text)
language sql stable security definer set search_path = '' as $$
  with yo as (select partido from public.parlamentario where id = p_id),
  mayoria as (  -- opción modal de la bancada por votación (solo votos confirmados)
    select v.votacion_id,
           mode() within group (order by v.seleccion) as mayoria
    from public.voto v join public.parlamentario p on p.id = v.parlamentario_id
    where p.partido = (select partido from yo) and v.estado_vinculo = 'confirmado'
    group by v.votacion_id
  )
  select v.votacion_id, vo.boletin, vo.fecha, v.seleccion, m.mayoria
  from public.voto v
  join mayoria m on m.votacion_id = v.votacion_id
  join public.votacion vo on vo.id = v.votacion_id
  where v.parlamentario_id = p_id
    and v.estado_vinculo = 'confirmado'
    and v.seleccion <> m.mayoria;   -- difirió de la mayoría de su bancada
$$;
grant execute on function rebeldias_de_parlamentario(text) to anon;
```
La UI muestra `count(*)` + la lista; etiqueta neutra "votó distinto a su bancada N veces", SIN juicio. [PATRÓN espeja el `security invoker` de `match_proyectos` en 0011, pero aquí DEBE ser `definer` porque toca `partido`.]

### Anti-Patterns to Avoid
- **`BaseConnector.run` para la corrida LIVE:** su caché diaria saltaría la re-corrida; usar el orden LOCKED directo (como el spike y `runIngest`). [CITED: connector-camara.ts:4-8]
- **Forkear el modelo `voto`/`votacion`:** CONTEXT lo prohíbe. Enriquecer 0008/0009, no crear modelo nuevo.
- **Fabricar un voto para "ausente":** ausente es asistencia, NO una opción de voto inventada; debe venir del roster oficial de la votación, marcado explícito. Nunca derivar "ausente" de "no aparece".
- **Calcular rebeldías en el cliente o leer `partido` desde anon:** viola RLS PII; `partido` es afiliación política (dato sensible Ley 21.719). Server-side `security definer` que solo emite el derivado.
- **Cualquier score/afinidad en voto×tema o rebeldías:** riesgo existencial #2 + Out-of-Scope explícito ("Scores de ideología/influencia"). Solo conteos y listas crudas.
- **Enlazar la mención cruda (estado b) al parlamentario:** VotoRow ya enlaza SOLO si confirmado; no "arreglar" eso.

## Don't Hand-Roll

| Problema | NO construir | Usar en su lugar | Por qué |
|----------|--------------|------------------|---------|
| Fetch tras WAF | delay/headers custom en el runner | `@obs/ingest` vía `CamaraConnector` | Política LOCKED en un solo sitio; copiarla diverge y arriesga ban. [CITED: connector-camara.ts] |
| Parse del detalle | nuevo `XMLParser` | `parseCamaraVotoDetalle` (extendido) | Ya maneja ambos shapes; solo extender opciones, no reescribir. [VERIFIED: parse-camara-votacion.ts:197] |
| Cruce DIPID→persona | `Map` a mano en el runner | `reconciliarVotosCamara` | Encapsula fail-closed + minteo `EnlaceConfirmado` + scoping por periodo/cámara. [VERIFIED: reconciliar-camara.ts] |
| Upsert idempotente | inserts manuales | `SupabaseTramitacionWriter` | `onConflict` + dedup pre-lote ya resuelto (CR-02). [VERIFIED: writer-supabase.ts:82-99] |
| FK de atribución | `parlamentario_id: string` | `VotoParaEscribir.enlace: EnlaceConfirmado | null` | IDENT-12: string crudo = error de compilación. [VERIFIED: writer.ts:28-37] |
| Render del voto + guarda | nuevo componente de fila | `VotoRow` / `IdentityMarker` / `ProvenanceBadge` | La guarda de identidad LOCKED ya vive en VotoRow. [VERIFIED: voto-row.tsx] |
| Cliente Supabase de la ficha | `createClient` ad-hoc | `createServerSupabase()` | Server-only, anon key nunca al browser. [VERIFIED: supabase.ts] |

**Key insight:** El 90% de la fase es promoción + 2 piezas de SQL nuevo (asistencia/índice + rebeldías RPC) + 1 ruta Next.js. La ingeniería de scraping/cruce ya existe y corrió LIVE.

## Runtime State Inventory

> Esta fase NO es rename/refactor, pero SÍ escribe estado runtime nuevo (votos enriquecidos) y promueve un paquete. Se inventaría lo relevante:

| Categoría | Items encontrados | Acción requerida |
|-----------|-------------------|------------------|
| Stored data | Filas `voto`/`votacion` en Supabase LOCAL (Phase 5 v1.0 ya escribió algunas de los boletines 14309/18296); la corrida de Phase 10 las ENRIQUECE (más votaciones) idempotentemente por clave natural. El remoto sa-east-1 puede no tener votos aún. | El conector es idempotente: re-correr no duplica. La corrida de prod escribe a LOCAL por default; el remoto es paso de operador (ver Environment). NO hay migración de datos destructiva. |
| Live service config | Ninguna externa (no n8n/Datadog/etc. en este proyecto). | None — verificado: el único servicio es Supabase, configurado por env vars. |
| OS-registered state | Ninguno. El conector se corre vía `pnpm`/CI, sin tareas OS registradas. | None. |
| Secrets/env vars | `SUPABASE_LOCAL_SERVICE_KEY` (writer), `SUPABASE_URL`/`SUPABASE_ANON_KEY` (ficha). Sin secretos nuevos. | None nuevos. El `.env` tiene BOM que rompe el CLI `supabase` (Pitfall 5). |
| Build artifacts | `packages/votos/spike/` queda obsoleto al crear `src/`. `packages/votos/package.json` puede necesitar `"exports"`/`"main"` apuntando a `src/index.ts` y añadir `@obs/identity` si el runner lo importa directo (hoy lo trae transitivo vía `@obs/tramitacion`). | Eliminar/archivar `spike/`; actualizar `package.json` exports. |

**Migración de la maestra al remoto:** el seed `parlamentario.seed.json` (155 DIPID) debe existir en el entorno donde corra el cruce; ya está en git (ID-09). Verificado: `cargarMaestra` lo lee del seed, no requiere DB.

## Common Pitfalls

### Pitfall 1: VOTE-03 pide asistencia + Abstención/Pareo/Ausente, pero el parser SOLO emite sí/no nominal
**Qué sale mal:** `parseCamaraVotoDetalle` descarta toda opción que no sea sí/no (`opcionDeVoto` devuelve `null` para No Vota/Abstención/dispensado → el caller hace `continue`). Y `voto.seleccion` CHECK = `si|no|abstencion|pareo` (sin `ausente`). Si se construye la ficha tal cual, NO hay datos de asistencia ni de abstención/pareo por diputado → VOTE-03 queda a medias y un "ausente" se confundiría con "no-ingestado" (rompe el estado (c) honesto).
**Por qué pasa:** El comportamiento fail-closed del parser era CORRECTO para v1.0 (no fabricar un sí/no inexistente), pero VOTE-03 ahora necesita el roll-call COMPLETO incluyendo no-voto/ausente como datos propios.
**Cómo evitar:** (a) Extender `parseCamaraVotoDetalle` (o un nuevo `parseCamaraRosterDetalle`) para emitir las 5 opciones: mapear `Opcion Codigo` 1→si, 0→no, y los códigos de Abstención/No Vota/dispensado/Pareo a `abstencion`/`pareo`/`ausente` según el catálogo real del WS (verificar los códigos exactos en la corrida LIVE — Phase 8 vio `4`=No Vota). (b) Migración 0019: `alter table voto drop constraint voto_seleccion_check; ... check (seleccion in ('si','no','abstencion','pareo','ausente'))`. (c) Actualizar `VotoSchema` (zod) y el type `Seleccion` en `@obs/tramitacion` Y en `app/lib/types.ts` + `VotoRow`'s `SELECCION_STYLE`. **Decisión para el planner/discuss:** confirmar que "Ausente" se deriva del roster de la votación (los diputados del periodo que NO aparecen en `<Votos>` o aparecen con código de no-asistencia), no de la ausencia de fila.
**Señales:** la ficha muestra solo sí/no; `total_abstencion`/`total_pareo` de la votación no cuadran con la suma de filas por diputado.

### Pitfall 2: No existe índice por `parlamentario_id` — la query de la ficha hace seq-scan
**Qué sale mal:** 0008 crea `voto_votacion_id_idx` (para la ficha del PROYECTO) pero NO un índice por `parlamentario_id`. La ficha del PARLAMENTARIO filtra por `parlamentario_id` → seq-scan sobre toda la tabla `voto` (que crece con cada votación × ~155 diputados).
**Cómo evitar:** Migración 0019 — `create index voto_parlamentario_id_idx on voto (parlamentario_id) where parlamentario_id is not null;` (parcial: las filas Senado no-confirmadas son null y no estorban). Para voto×tema y rebeldías que ordenan por fecha, considerar un índice compuesto si el `EXPLAIN` lo pide.
**Señales:** `EXPLAIN` de la query de la ficha muestra `Seq Scan on voto`.

### Pitfall 3: La corrida LIVE puede estar acotada en este entorno → degradar, nunca fabricar
**Qué sale mal:** El WAF/tiempo puede impedir una corrida completa de toda la legislatura. Si el conector "rellena" votaciones que no pudo traer, fabrica datos (riesgo existencial).
**Cómo evitar:** `runIngest` ya tolera fuentes vacías y aísla errores por boletín (`errores[]`, no aborta). La corrida de prod debe ser ACOTADA (boletines explícitos o `limite`), registrar qué se ingirió y qué no, y dejar el resto como estado (c) "no-ingestado" en la ficha. El backfill masivo es follow-up vía GitHub Actions (Deferred). NUNCA emitir una fila sin respaldo de fuente.
**Señales:** conteos de la corrida que no cuadran con `errores[]`; votos sin provenance.

### Pitfall 4: Rebeldías necesita `partido`, que está bajo RLS deny-by-default
**Qué sale mal:** Intentar leer `parlamentario.partido` desde el cliente/anon devuelve 0 filas (RLS 0005 sin policies para anon). Si se "arregla" abriendo `partido` a anon, se expone afiliación política (dato sensible Ley 21.719, contradice LEGAL-03).
**Cómo evitar:** RPC `security definer` (Pattern 5) que lee `partido` internamente y emite SOLO el conteo+lista derivada (votacion_id + seleccion propia + mayoría). `set search_path = ''` y `grant execute ... to anon`. NO añadir policy de SELECT sobre `parlamentario.partido`. Verificar con pgTAP que anon NO puede `select partido from parlamentario` pero SÍ puede `rpc('rebeldias_de_parlamentario', ...)`.
**Señales:** la query de bancada devuelve vacío bajo anon; o peor, `partido` aparece legible para anon.

### Pitfall 5: BOM en `.env` rompe el CLI `supabase` (aplicar migración / leer DB)
**Qué sale mal:** El `.env` tiene UTF-8 BOM que hace fallar el `supabase` CLI al aplicar 0019 o leer la maestra desde la DB.
**Cómo evitar:** Pasar `--db-url` explícito a `supabase`/`psql`, o leer la maestra del seed (`cargarMaestra`, que no toca DB). Para aplicar 0019 al remoto, usar el patrón de 0018 (pooler sa-east-1 con db-url explícita). [CITED: project memory env-credentials-reality, 09-03 SUMMARY]
**Señales:** `supabase` CLI error de parseo de env.

### Pitfall 6: El `boletin` de la votación debe enlazar a `/proyecto/[boletin]` con el sufijo completo
**Qué sale mal:** `votacion.boletin` es el boletín COMPLETO (con sufijo, "18296-05"), pero el WS de Cámara se consulta con el base ("18296"). Si la ficha enlaza con el base, el link a `/proyecto/[boletin]` rompe (la PK es el completo).
**Cómo evitar:** `runIngest` ya fija `votacion.boletin = boletinKey` (el del proyecto del Senado, completo). La ficha debe usar `votacion.boletin` tal cual para el `<Link href={/proyecto/${boletin}}>`. [VERIFIED: ingest-run.ts:167-175]
**Señales:** links de boletín 404.

## Code Examples

### RPC de la lista de votos paginada (VOTE-03)
```sql
-- Source: patrón derivado de match_proyectos (0011) + esquema voto/votacion/proyecto (0008)
-- security invoker (lee solo tablas público-read); ordena por fecha; paginado.
create or replace function votos_de_parlamentario(
  p_id text, p_limit int default 20, p_offset int default 0
)
returns table (
  votacion_id text, boletin text, fecha timestamptz,
  seleccion text, etapa text, camara text,
  origen text, fecha_captura timestamptz, enlace text
)
language sql stable
as $$
  select v.votacion_id, vo.boletin, vo.fecha, v.seleccion, vo.etapa, vo.camara,
         vo.origen, vo.fecha_captura, vo.enlace
  from voto v
  join votacion vo on vo.id = v.votacion_id
  where v.parlamentario_id = p_id and v.estado_vinculo = 'confirmado'
  order by vo.fecha desc nulls last
  limit p_limit offset p_offset;
$$;
grant execute on function votos_de_parlamentario(text, int, int) to anon;
```

### Lectura desde el Server Component (reusa createServerSupabase + VotoRow)
```tsx
// Source: patrón de proyecto/[boletin]/page.tsx:120-179
const sb = createServerSupabase();
const { data, error } = await sb.rpc("votos_de_parlamentario", { p_id: id, p_limit: 20, p_offset: 0 });
if (error) throw new Error(`No se pudieron leer los votos de ${id}: ${error.message}`);
// estado (c) vacío honesto si data.length === 0; estados (a)/(b) los aplica VotoRow por estado_vinculo
```

## State of the Art

| Old (v1.0 / spike) | Current (Phase 10) | Cuándo cambió | Impacto |
|--------------------|--------------------|--------------|---------|
| `packages/votos/spike/` throwaway | `packages/votos/src/` runner de prod que escribe a DB | Esta fase | El paquete deja de ser desechable. |
| `parseCamaraVotoDetalle` emite solo sí/no | Parser emite las 5 opciones (sí/no/abst/pareo/ausente) | Esta fase (GAP) | Habilita asistencia VOTE-03. |
| `voto.seleccion` CHECK sin `ausente` | + `ausente` (migración 0019) | Esta fase | Asistencia first-class. |
| Sin índice `voto(parlamentario_id)` | + índice parcial (0019) | Esta fase | Query de ficha eficiente. |
| Ficha solo del PROYECTO (`/proyecto/[boletin]`) | + ficha del PARLAMENTARIO (`/parlamentario/[id]`) | Esta fase | Primera ficha 360. |

**Deprecado/obsoleto:** `packages/votos/spike/spike.ts` (reemplazado por `src/`).

## Assumptions Log

| # | Claim | Sección | Riesgo si falla |
|---|-------|---------|-----------------|
| A1 | Los códigos exactos del WS para Abstención/Pareo/dispensado/No-Vota deben verificarse en la corrida LIVE (Phase 8 solo confirmó 1=sí, 0=no, 4=No Vota). El mapeo a `abstencion`/`pareo`/`ausente` es ASUMIDO hasta verlos. | Pitfall 1 | Si los códigos difieren, la asistencia se clasifica mal → confirmar en la corrida LIVE antes de fijar el mapeo. |
| A2 | "Ausente" se deriva del roster de la votación (diputados del periodo ausentes de `<Votos>` o con código de no-asistencia), NO de la ausencia de fila en la DB. | Pitfall 1 | Si el WS no entrega el roster completo por votación, "ausente" no es computable y debe omitirse honestamente (no fabricar). Decisión para discuss. |
| A3 | Un RPC `security definer` es la vía aceptada para rebeldías (vs vista materializada). | Pattern 5 | Si el revisor de seguridad prefiere materializada + pg_cron, cambia la implementación pero no el contrato (conteo+lista público). |
| A4 | La corrida de prod escribe al Supabase LOCAL por default; el remoto sa-east-1 es paso de operador. | Environment | Si se requiere remoto en esta fase, hay que aplicar 0019 al remoto (patrón 0018, pooler) y poblar votos allí. |
| A5 | El estado (b) presente-no-verificado es raro en Cámara (DIPID confirma 100%); aplica sobre todo a votos de Senado (cruce por nombre). | Pattern 3 | Si Leg-58 trae DIPIDs de periodos previos no en la maestra, habrá filas `no_confirmado` con `parlamentario_id=null` que NO aparecen en la ficha del parlamentario X — correcto fail-closed. |

## Open Questions

1. **¿"Ausente" y "Abstención/Pareo" se persisten como filas `voto` con el diputado cruzado, o solo como totales?**
   - Sabido: `votacion` ya tiene `total_abstencion`/`total_pareo`; el detalle por diputado de esas opciones hoy se descarta.
   - Incierto: si el WS `getVotacion_Detalle` lista a los abstenidos/ausentes con su DIPID (para cruzarlos) o solo los sí/no.
   - Recomendación: verificar en la corrida LIVE; si vienen con DIPID, persistir como filas `voto` con `seleccion='abstencion'|'pareo'|'ausente'` y el cruce determinista; si no, mostrar solo totales y marcar la asistencia individual como "no disponible" honestamente.

2. **¿El runner de `@obs/votos` reusa `runIngest` (Senado+Cámara) o un subset Cámara-only?**
   - Recomendación: Cámara-only para VOTE (el voto individual viene de Cámara); evita arrastrar el provider del Senado. Pero `runIngest` ya degrada sin provider, así que reusarlo es válido y menos código. Discreción del planner.

3. **¿Rebeldías incluye solo votaciones de Cámara (donde el cruce es 100%) o también Senado?**
   - Recomendación: limitar a `estado_vinculo='confirmado'` (ya en el RPC) — automáticamente incluye Cámara confirmada y solo el Senado confirmado determinísticamente. Mayoría de bancada calculada solo sobre confirmados (evita ruido de no-confirmados).

## Environment Availability

| Dependencia | Requerida por | Disponible | Versión | Fallback |
|-------------|---------------|-----------|---------|----------|
| `opendata.camara.cl` tras WAF | corrida del conector | ✓ (LIVE 2026-06-19, 0 errores) | — | si cae → degradar a lo ya ingerido, registrar, no fabricar |
| `@obs/{ingest,tramitacion,identity,core}` | reuso del pipeline | ✓ | in-repo | — |
| `fast-xml-parser` | parse | ✓ | 5.x | — |
| Supabase LOCAL (service key) | writer de prod | ✓ (Phase 5/9 lo usaron) | — | dry-run con InMemoryWriter si falta key |
| Supabase remoto sa-east-1 (pooler) | exposición pública | parcial (0018 aplicada; votos no aún) | — | aplicar 0019 + poblar = paso de operador (patrón 0018) |
| `parlamentario.seed.json` (155 DIPID) | cruce + (rebeldías: partido) | ✓ | en git (ID-09) | DB read (BOM gotcha) |
| `vitest` / `pgTAP` | gates | ✓ | repo dev deps | — |

**Faltantes sin fallback:** ninguno bloqueante. **Faltantes con fallback:** poblado del remoto (operador); lectura DB de la maestra (fallback: seed).

## Validation Architecture

> nyquist_validation: **enabled** (`.planning/config.json` → `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest` (Node) para el conector/runner; `pgTAP` para migración 0019/RPCs (espejo de 0018). [VERIFIED: votos/package.json, config.json] |
| Config file | `packages/votos/vitest.config.ts` (existe); pgTAP en `supabase/tests/` (patrón v1.0). |
| Quick run | `pnpm --filter @obs/votos test` (offline, InMemoryWriter + fixtures) |
| Full suite | `pnpm -r --filter "./packages/*" test` + `supabase test db` (pgTAP) |

### Phase Requirements → Test Map
| Req | Behavior (observable) | Test Type | Automated command | File Exists? |
|-----|----------------------|-----------|-------------------|-------------|
| VOTE-02 | Enriquecimiento idempotente: correr el runner 2× con el mismo input deja los mismos conteos de `voto` (no duplica) | unit | `pnpm --filter @obs/votos test` (InMemoryWriter: `writer.votos.size` estable tras 2 corridas) | ❌ Wave 0 |
| VOTE-02 | Cruce DIPID determinista: un DIPID en la maestra → `estado_vinculo='confirmado'`, `metodo='determinista'`, FK = `EnlaceConfirmado`; DIPID ausente → `parlamentario_id=null`, `no_confirmado` | unit | assert sobre `reconciliarVotosCamara` con fixture (ya cubierto en `reconciliar-camara.test.ts`; el runner lo re-verifica e2e) | ⚠️ parcial (existe en tramitacion) |
| VOTE-02 | Corrida LIVE acotada Leg-58 sin fabricar: `errores[]` registra fallos, no se emiten filas sin provenance | live smoke (gated `VOTOS_LIVE=1`) | `VOTOS_LIVE=1 pnpm --filter @obs/votos test` | ❌ Wave 0 |
| VOTE-03 | `voto.seleccion` admite `ausente`; el parser emite las 5 opciones por diputado | unit + pgTAP | parser test sobre fixture extendido; pgTAP: `insert ... seleccion='ausente'` pasa el CHECK | ❌ Wave 0 |
| VOTE-03 | La ficha muestra los 3 estados: confirmado=link, no_confirmado=crudo+marker, vacío=mensaje honesto (≠ "limpio") | component (RTL) | test de `votos-por-parlamentario.tsx` con 3 fixtures de estado | ❌ Wave 0 |
| VOTE-03 | Query de votos usa el índice `voto(parlamentario_id)` | pgTAP/EXPLAIN | `EXPLAIN` no muestra Seq Scan; pgTAP verifica que el índice existe | ❌ Wave 0 |
| VOTE-04 | Voto×tema facetea por materia con CONTEO crudo y CERO score/afinidad | unit/SQL | test del query de faceta: devuelve `(materia, seleccion, count)`; grep gate: ningún identificador "afinidad/alineado/score" en el código/SQL | ❌ Wave 0 |
| VOTE-05 | Rebeldías = conteo + lista; anon NO puede leer `parlamentario.partido` pero SÍ el RPC | pgTAP | pgTAP: `select partido from parlamentario` bajo anon = 0 filas/denegado; `rpc rebeldias_de_parlamentario` bajo anon devuelve filas | ❌ Wave 0 |
| VOTE-05 | Rebeldías es dato neutro (sin juicio) | component | test: la UI muestra "votó distinto a su bancada N veces", sin texto de juicio | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/votos test` (+ `--filter @obs/tramitacion test` si se toca el parser).
- **Per wave merge:** `pnpm -r --filter "./packages/*" test` + `supabase test db` (pgTAP 0019).
- **Phase gate:** suite completa verde + corrida LIVE acotada documentada (FINDINGS: qué se ingirió, errores, idempotencia verificada) + la ficha renderiza los 3 estados.

### Wave 0 Gaps
- [ ] `packages/votos/src/run-camara-votos.ts` + `.test.ts` (offline, InMemoryWriter) — cubre VOTE-02 idempotencia.
- [ ] `packages/votos/src/run-camara-votos.live.test.ts` (gated) — cubre la corrida LIVE acotada.
- [ ] Extender `parse-camara-votacion.ts` + su test para las 5 opciones (o un `parseCamaraRoster*`).
- [ ] `supabase/migrations/0019_voto_asistencia_y_ficha.sql` + pgTAP (`ausente` CHECK, índice, RPCs, grants, deny de `partido` a anon).
- [ ] `app/components/votos-por-parlamentario.tsx` + test RTL (3 estados, sin score).
- [ ] `app/app/parlamentario/[id]/page.tsx` + `not-found.tsx`.
- [ ] Actualizar `Seleccion` type + `VotoSchema` en `@obs/tramitacion` y `app/lib/types.ts` + `SELECCION_STYLE` en `VotoRow`.
- Framework install: ninguno.

## Security Domain

> `security_enforcement` no deshabilitado → incluido. Superficie: lectura outbound a gov público (sin auth) + lecturas DB bajo RLS + 1 RPC `security definer` que toca PII (partido).

### Applicable ASVS Categories
| ASVS Category | Aplica | Control estándar |
|---------------|--------|-----------------|
| V2 Authentication | no | Sin auth de usuario; conector usa service key server-side. |
| V3 Session | no | Lecturas stateless (anon RSC). |
| V4 Access Control | **yes** | RLS: `voto`/`votacion`/`proyecto` público-read; `parlamentario.partido` deny-by-default. El RPC de rebeldías es el ÚNICO canal que toca `partido`, y emite solo derivado público (LEGAL-03). pgTAP debe verificar que anon no lee `partido`. |
| V5 Input Validation | **yes** | El `[id]` del path se valida (patrón `P\d+` o regex de id) antes de tocar DB (espeja BOLETIN_RE en proyecto/[boletin]). XML vía `fast-xml-parser` + zod (`VotoSchema`). |
| V6 Cryptography | no | Nada hand-rolled. |
| (SSRF V5/V12) | **yes** | `assertAllowedUrl` deny-by-default antes de cada fetch del conector. [VERIFIED: allowlist.ts] |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Mitigación estándar |
|---------|--------|---------------------|
| Exposición de afiliación política (`partido`) a anon | Info-disclosure (Ley 21.719) | RLS deny-by-default en `parlamentario`; rebeldías vía `security definer` que emite solo conteo+lista; `set search_path=''`; pgTAP gate. |
| Path injection en `/parlamentario/[id]` | Tampering | Validar el id contra regex antes de la query; `.eq()` parametriza igual. |
| SSRF / WAF ban en el fetch | Tampering / DoS | `assertAllowedUrl` + 2–3s serial (`HostRateLimiter`) + robots + UA identificatorio (orden LOCKED). |
| Fabricación de votos/identidad (riesgo existencial #1/#2) | Tampering/Repudiation | Cruce determinista por DIPID; fail-closed (`no_confirmado` si no mapea); `EnlaceConfirmado` impide fijar FK desde string crudo; CERO score en voto×tema/rebeldías. |
| XML malformado | DoS | `fast-xml-parser` (sin entidades externas) + zod. |

## Sources

### Primary (HIGH — codebase, verificado esta sesión)
- `packages/votos/{package.json, spike/spike.ts}` — paquete a promover; ensamblaje LOCKED del runner.
- `packages/tramitacion/src/{connector-camara, parse-camara-votacion, reconciliar-camara, writer, writer-supabase, ingest-run, ingest-cli, model, index}.ts` — pipeline completo reusable + GAP del parser (solo sí/no).
- `packages/identity/src/index.ts` — `confirmar`/`EnlaceConfirmado` (IDENT-12).
- `packages/core/src/parlamentario.ts` — `partido`/`id_diputado_camara` (partido nullable, RLS deny).
- `supabase/migrations/{0005,0008,0009,0011,0012}.sql` — maestra (RLS deny), modelo voto/votacion (RLS public-read, índices), clave natural `fuente_voter_id` (CR-02), embeddings + RPC `match_proyectos` (grant anon), guarda de estado.
- `app/app/proyecto/[boletin]/page.tsx`, `app/components/{voto-row, voto-detalle, votacion-card}.tsx`, `app/lib/supabase.ts`, `app/lib/types.ts` — patrón de ficha RSC + guarda de identidad + tipos (Seleccion sin `ausente`).
- `.planning/phases/08-*/08-{SUMMARY,RESEARCH}.md` — corrida LIVE CONFIRMAR, shape XML, allowlist.
- `.planning/phases/09-*/09-01-SUMMARY.md` — invariante `EnlaceConfirmado`.

### Secondary (MEDIUM-HIGH)
- `.planning/STATE.md` — decisiones acumuladas (Phase 5 cruce por DIPID, guarda TRAM-06, Phase 8 confirmación).
- Project memory `env-credentials-reality.md` — gov reads OK, Supabase remoto DDL vía db-url, `.env` BOM gotcha.
- `CLAUDE.md` — stack LOCKED (Deno/Next.js 16/pgvector/HNSW, no hand-roll, server-only fetch).

## Project Constraints (from CLAUDE.md)
- **TypeScript/Deno + Next.js 16 App Router + Supabase (Postgres+pgvector+RLS).** Lenguaje único TS.
- **Todas las llamadas a fuentes gubernamentales server-only** (Edge Functions/jobs/RSC) — nunca desde el navegador; resuelve CORS del WAF y mantiene keys fuera del cliente.
- **Ingesta respetuosa:** rate-limit 2–3s, UA identificatorio, robots.txt, caché diaria — todo ya LOCKED en `@obs/ingest`.
- **Provenance por fila** (origen/fecha/enlace) en todo dato mostrado — riesgo rector.
- **Prohibido:** scores de afinidad/ideología, correlación donación→voto, conclusiones de causalidad. Aplica directo a VOTE-04 (voto×tema sin score) y VOTE-05 (rebeldías sin juicio).
- **RUT/PII (incl. `partido` como afiliación política) jamás a anon ni al LLM** (LEGAL-03) — rebeldías via `security definer`.
- **`@obs/...` workspace, idempotencia por clave natural, fail-closed en identidad.**
- **GSD enforcement:** cambios solo vía comando GSD (`/gsd:execute-phase`).

## Metadata

**Confidence breakdown:**
- Conector (promoción/reuso): HIGH — todo el pipeline existe, leído de fuente, corrió LIVE Phase 8.
- Queries de la ficha (lista/voto×tema): MEDIUM-HIGH — inferidas del esquema 0008/0011 + patrón v1.0; RPCs propuestos no existen aún.
- Asistencia/ausente (VOTE-03): MEDIUM — GAP real identificado; los códigos exactos del WS para opciones no-nominales necesitan verse LIVE (A1/A2).
- Rebeldías (VOTE-05): MEDIUM-HIGH — el `security definer` es el patrón correcto dado el RLS deny de `partido`; la implementación SQL es propuesta, no verificada en DB.

**Research date:** 2026-06-19
**Valid until:** ~2026-07-19 (código in-repo estable; el endpoint LIVE lo re-confirma la propia corrida del conector).
