# Phase 67: VOTO P3d — Paridad Senado (voto individual por nombre) - Research

**Researched:** 2026-07-14
**Domain:** Ingesta de voto individual del Senado (name-based reconciliation) por el wire dos-etapas R2 ya existente
**Confidence:** HIGH (todo el código relevante fue leído en esta sesión, no es memoria de entrenamiento)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (from `<decisions>` + `<specifics>`)
- **Dos etapas SIEMPRE** (fuente→R2 crudo content-addressed primero; R2→Supabase con `--from-r2` replay). Mismo wire que Phase 66; R2 Stage-1 falla → gatea Stage-2 (fail-closed, fix CR-01 de Phase 66).
- **Senado por NOMBRE**: el cruce NO es DIPID-determinista (el Senado no expone DIPID). Vínculo por nombre normalizado → estado `probable` o `no_confirmado`, NUNCA `confirmado` fabricado. `fuente_voter_id = seq:<n>` como identificador estable de la fila, no un FK a persona.
- **Fail-closed**: sin provider Senado, `runIngest` no inventa votos.
- **Rate-limit 2-3s, UA identificatorio**; backfill masivo LOCAL reanudable; paginar PostgREST `.range()`.
- **Disciplina de atribución (SC#4)**: solo `confirmado` se muestra como voto atribuido a la persona; `probable/no_confirmado` no se presenta como "votó X".
- `fuente_voter_id = seq:<n>` para filas Senado (no fabricar FK).
- `--from-r2` replay para Etapa 2 sin re-tocar `votaciones.php`.
- Backfill LOCAL (operador), igual que Cámara (Phase 66).

### Claude's Discretion
Todo lo anterior dentro de las reglas LOCKED (dos etapas + fail-closed). El "cómo" del wire del path Senado en `--from-r2` es discreción del planner.

### Deferred Ideas (OUT OF SCOPE)
- Superficie ciudadana del voto (ficha, sí/no/abstención/pareo/ausente con fuente/fecha/enlace) → **Phase 68**. NO construir UI aquí.
- Mejora del vínculo Senado a `confirmado` vía un identificador estable del Senado (fuera de alcance).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOTO-01 (Senado) | El ciudadano puede ver cómo votó individualmente cada parlamentario en una votación de sala — sentido literal (a favor / en contra / abstención / pareo / ausente), con fuente, fecha y enlace. VOTO-01 mapea a Phase 66 (Cámara) + Phase 67 (Senado); esta fase cubre la porción **Senado**. | Toda la cadena Senado (fetch `votaciones.php` → `parseSenadoVotaciones` → `reconciliarVotosSenado` → upsert) YA EXISTE y ya está enrutada dentro de `runIngest` (paso 4). Ver Standard Stack y Architecture Patterns. |
</phase_requirements>

## Summary

**El código del path Senado ya existe Y ya está enrutado.** `runIngest` (`packages/tramitacion/src/ingest-run.ts`, paso 4) ya hace, por cada boletín: `senado.fetchVotaciones(base)` → `parseSenadoVotaciones(xml, boletinKey)` → `reconciliarVotosSenado(...)` → `votosBoletin.push(...)` → upsert idempotente. El fail-closed (SC#3) ya está implementado con `PROVIDER_DEGRADA_FAIL_CLOSED` (un homónimo sin LLM → `no_confirmado`, no aborta el boletín). El `fuente_voter_id = seq:<n>` (SC#2) ya lo produce `reconciliarVotosSenado` (`seq:${crudo.votoSeq}`). El `EnlaceConfirmado` solo se mintea en la rama `determinista`; `probable`/`revision`/`no_confirmado` dejan `enlace: null` (guarda LOCKED IDENT-12).

**Lo que esta fase realmente hace es EJECUTAR (backfill LOCAL) el path que ya está wired, y cerrar el ÚNICO gap real de wiring: el replay `--from-r2` DESCARTA los votos del Senado.** En `run-camara-votos.ts` (líneas 211-218) el `senadoFake` del modo `--from-r2` devuelve `""` en `fetchVotaciones()` — es decir, en replay los votos de la Cámara se reconstruyen del envelope pero **los del Senado no**. El envelope R2 (`ingest-run.ts` línea 284) sí guarda `votXml` de la Cámara, pero **no guarda el XML de votaciones del Senado** (`senVotXml`); el envelope shape es `{ boletin, tramXml, votXml, detalles }` — no hay campo para el crudo de votaciones nominales del Senado.

**⚠️ CORRECCIÓN NECESARIA AL FRAMING DE LA FASE (resolver en discuss/plan antes de ejecutar):** la descripción de la fase dice "Senado por nombre → `probable/no_confirmado`; **nunca** un FK confirmado fabricado". El código LOCKED (verificado esta sesión) NO es "nunca confirmado": si un nombre del Senado es **único** en la maestra+periodo, `correrPipeline` devuelve `determinista` y el reconciliador **mintea `confirmado`** vía `confirmar()` (reconciliar-senado.ts línea 148-152; test línea 72-108). Esto es intencional y correcto (VOTO-03 exige link solo si `confirmado`, y un match determinista NO es una fabricación — es la misma disciplina de la Cámara). La lectura correcta de la regla LOCKED es: **nunca `confirmado` por NAME-MATCH AMBIGUO/heurístico** (homónimos, auto-aceptar del LLM → esos van a `probable`, jamás vinculan). Un match determinista único SÍ puede ser `confirmado` sin violar nada. El planner NO debe escribir código que degrade el determinista a `probable` — eso rompería la paridad con la Cámara y el test existente.

**Primary recommendation:** No crear conector, parser ni reconciliador. Esta fase = (1) cerrar el gap de replay Senado (`votXmlSenado` en el envelope + `senadoFake.fetchVotaciones()` sirviéndolo), (2) tests offline con fixture de `votaciones.php` que ejerzan `probable`/`no_confirmado`/`confirmado`-determinista y `seq:<n>`, (3) runbook operador-LOCAL para el backfill LIVE de `votaciones.php` (gated, rate-limit 2-3s), (4) confirmar SC#4 como invariante de disciplina (no UI). El backfill LIVE + write PROD es checkpoint de operador (igual que 66-02).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch `votaciones.php` XML (rate-limited, robots, SSRF) | Conector (`@obs/tramitacion` `SenadoConnector`, sobre `@obs/ingest`) | — | Ya existe; reusa la política LOCKED de red de `@obs/ingest`. Server-only (backfill LOCAL). |
| Parse XML Senado → `Votacion` + `VotoSenadoCrudo[]` | Parser (`parse-senado-votacion.ts`) | — | Ya existe; `fast-xml-parser`, `mapSeleccion`, `votoSeq`. |
| Reconciliación por nombre → estado_vinculo + `seq:<n>` | Pipeline identidad (`@obs/adjudication` `correrPipeline`) vía `reconciliar-senado.ts` | LLM opcional (`@obs/llm` MiniMax, gated) | Ya existe; guarda LOCKED IDENT-12: solo determinista mintea `EnlaceConfirmado`. |
| Orquestación dos-etapas (R2 crudo → Supabase) | Runner (`ingest-run.ts` `runIngest`) | Runner votos (`run-camara-votos.ts`) | `runIngest` ya invoca el path Senado. El gap está en el envelope R2 y el replay `--from-r2`. |
| Backfill LOCAL (operador) | CLI operador (`run-votos-masivo-cli.ts`) | — | Ya construye R2Store + writer; el `--boletines-file` cubre boletines del Senado. |
| Cobertura por estado_vinculo | Módulo cobertura (`cobertura.ts`) | — | Ya existe (Phase 66). El invariante DIPID-maestra es Cámara-específico; ver Open Questions Q3. |
| Superficie ciudadana (ficha) | **Phase 68 — OUT OF SCOPE** | — | SC#4 aquí es invariante de disciplina, no UI. |

## Standard Stack

Sin paquetes nuevos. Todo el stack ya está instalado y en uso en `@obs/tramitacion` / `@obs/votos`.

### Core (ya presentes)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fast-xml-parser` | 5.x (per CLAUDE.md) | Parse del XML de `votaciones.php` | Ya usado en `parse-senado-votacion.ts` (`ignoreAttributes:false, parseTagValue:false`). |
| `@obs/adjudication` (`correrPipeline`) | workspace | Pipeline de identidad asistida (blocking + LLM + fail-closed) | Ya usado por `reconciliar-senado.ts`; guarda LOCKED IDENT-12. |
| `@obs/identity` (`confirmar`, `EnlaceConfirmado`) | workspace | Branded FK — único mint site en la rama determinista | Impide que un string crudo se cuele como FK (no compila). |
| `@obs/ingest` (`R2Store`, `SnapshotWriter`, `Fetcher`, `HostRateLimiter`, `RobotsGuard`) | workspace | Etapa 1 R2 + política de red LOCKED | Ya threaded en Phase 66. |
| `@supabase/supabase-js` | ^2.108.2 | Writer + cliente cobertura | Ya dep directa de `@obs/votos` (añadida en Phase 66). |
| `zod` | 3.x/4.x | `VotoSchema.parse` (defensa-en-profundidad) | Ya validando en `reconciliar-senado.ts`. |

**Installation:** Ninguna. `pnpm --filter @obs/votos test` y `pnpm --filter @obs/tramitacion test` corren tal cual.

## Package Legitimacy Audit

**No aplica.** Esta fase no instala paquetes externos nuevos. Todo el stack ya vive en el monorepo (mismas versiones pinneadas por `@obs/tramitacion` / `@obs/identity` / `@obs/votos`). Si el planner introdujera un paquete (no debería), corre el Package Legitimacy Gate antes.

## Architecture Patterns

### System Architecture Diagram (path Senado, dentro de `runIngest`)

```
                         ┌──── backfill LOCAL (operador) ────┐
                         │  run-votos-masivo-cli.ts          │
                         │  --boletines-file <senado.txt>    │
                         │  (o --from-r2 <path> para replay) │
                         └───────────────┬───────────────────┘
                                         │  runCamaraVotos(opts)
                                         ▼
                              ┌──────────────────────┐
                              │  runCamaraVotos       │  reenvía r2Store/snapshotWriter/fromR2
                              │  (run-camara-votos.ts)│  ── NORMAL ──► runIngest
                              └──────────┬────────────┘  ── fromR2 ──► construye fakes + runIngest
                                         │
                              ┌──────────▼────────────────────────────────────┐
                              │ runIngest (ingest-run.ts) — por boletín:       │
                              │                                                │
                              │  paso 2: senado.fetchTramitacion → Proyecto    │
                              │  paso 3: camara.fetchVotaciones → detalle      │
                              │           reconciliarVotosCamara (DIPID det.)  │
                              │  paso 4: senado.fetchVotaciones(base)  ◄─────── votaciones.php XML
                              │           → parseSenadoVotaciones               │
                              │           → reconciliarVotosSenado (por NOMBRE) │
                              │              vía correrPipeline:                │
                              │               determinista → confirmado + FK    │
                              │               probable(LLM) → null, 'probable'   │
                              │               revision/no_match → null, 'no_conf'│
                              │              fuente_voter_id = seq:<votoSeq>     │
                              │                                                │
                              │  Etapa 1 R2: putImmutable(envelope) ── LOCKED ──┤ 412 existed → skip Etapa 2
                              │              FALLO put (no-412) → GATEA Etapa 2  │ (CR-01)
                              │  Etapa 2: writer.upsertVotos(...) idempotente   │
                              └────────────────────────────────────────────────┘
                                         │
                                         ▼
                              voto rows  (votacion_id, fuente_voter_id=seq:<n>,
                                          mencion_nombre, parlamentario_id|null,
                                          seleccion, estado_vinculo, provenance)
```

### Pattern 1: El path Senado YA vive en `runIngest` paso 4
**What:** No hay un "run-senado-votos" separado. El Senado es un paso más dentro del mismo `runIngest` que la Cámara usa. `runCamaraVotos` (mal nombrado: hace ambas cámaras) construye `buildSenadoConnector()` por defecto y lo pasa a `runIngest`.
**When to use:** Siempre. El backfill Senado sale de correr `run-votos-masivo-cli` con boletines del Senado — el mismo CLI que la Cámara.
**Example:**
```typescript
// Source: packages/tramitacion/src/ingest-run.ts (paso 4, líneas 228-247) — leído esta sesión
try {
  const senVotXml = await opts.senado.fetchVotaciones(base);
  const senVotaciones = parseSenadoVotaciones(senVotXml, boletinKey);
  for (const sv of senVotaciones) {
    votacionesBoletin.push(sv.votacion);
    const votos = await reconciliarVotosSenado(sv.votos, opts.maestra, reconcOpts(sv.votacion.id));
    votosBoletin.push(...votos);
  }
} catch (err) {
  errores.push({ boletin: boletinFull, etapa: "senado-votaciones", mensaje: ... });
}
```

### Pattern 2: Fail-closed sin provider Senado (SC#3) — YA implementado
**What:** `runIngest` inyecta `PROVIDER_DEGRADA_FAIL_CLOSED` cuando no hay `opts.provider`. Un homónimo (blocking generó candidatos, sin match determinista) → el provider devuelve `no_match` (confianza 0) en vez de LANZAR → el voto degrada a `no_confirmado` con mención cruda, y el boletín NO se aborta. Los votos deterministas nunca tocan el provider.
**When to use:** Toda corrida LIVE sin MiniMax (gated por credencial). "No inventa votos" = concretamente: sin provider real, un nombre ambiguo NO se resuelve a una persona (queda `no_confirmado`, `parlamentario_id=null`); jamás se elige un candidato al azar.
**Example:**
```typescript
// Source: packages/tramitacion/src/ingest-run.ts (líneas 53-65) — leído esta sesión
const PROVIDER_DEGRADA_FAIL_CLOSED: LLMProvider = {
  id: "degrada-fail-closed",
  trainsOnInputs: false,
  async complete<T>(_req, schema): Promise<T> {
    return schema.parse({ decision: "no_match", chosen_id: null, confidence: 0, evidence: [], conflicts: ["sin adjudicador LLM en la corrida (gated); degrada fail-closed"] });
  },
};
// ...
const senadoProvider = opts.provider ?? PROVIDER_DEGRADA_FAIL_CLOSED;
```
Nótese que `reconciliar-senado.ts` tiene ADEMÁS un `PROVIDER_AUSENTE` que **lanza** — pero `runIngest` nunca lo usa porque siempre pasa `senadoProvider`. El `PROVIDER_AUSENTE` solo aplica si alguien llama `reconciliarVotosSenado` sin opts (contrato del slice E2E). No tocar.

### Pattern 3: `seq:<n>` como discriminador de fila Senado (SC#2) — YA implementado
**What:** El Senado solo trae nombre; dos homónimos/menciones vacías colapsarían en la misma clave `(votacion_id, fuente_voter_id)`. El discriminador NO colisionante es el índice posicional del voto en el XML (`crudo.votoSeq`, asignado en `parse-senado-votacion.ts` línea 196 como el `idx` del `forEach`). El reconciliador lo emite como `fuente_voter_id: seq:${crudo.votoSeq}`.
**Example:**
```typescript
// Source: packages/tramitacion/src/reconciliar-senado.ts (líneas 170) — leído esta sesión
fuente_voter_id: `seq:${crudo.votoSeq}`,
```
El `votoSeq` es el índice EN LA FUENTE **antes de filtrar** (selecciones garbled se omiten después) → estable e idempotente entre re-ingestas mientras el XML mantenga orden. Ver Pitfall 3.

### Anti-Patterns to Avoid
- **Crear un `run-senado-votos.ts` / `connector-senado` nuevo:** ya existen y ya están enrutados. Prohibido por el HALLAZGO RECTOR (v7.0 = wiring, no net-new).
- **Degradar el match determinista único del Senado a `probable`:** el framing "nunca confirmado" es impreciso. Determinista único = `confirmado` legítimo (paridad con Cámara, VOTO-03). Rompería `reconciliar-senado.test.ts` línea 72-108.
- **Construir UI de voto aquí:** es Phase 68. SC#4 es invariante de disciplina.
- **Name-match para atribuir sin pipeline:** jamás. Todo cruce Senado pasa por `correrPipeline` (blocking + fail-closed).
- **Guardar el XML del Senado votaciones fuera del envelope R2:** violaría "dos etapas" en replay (ver Pitfall 1, el gap real).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fetch respetuoso de `votaciones.php` | fetch propio con setTimeout | `SenadoConnector.fetchVotaciones` (rate-limit + robots + SSRF LOCKED) | Ya ensambla la política LOCKED de `@obs/ingest`; el WAF gubernamental bloquea ráfagas. |
| Parse del XML nominal del Senado | DOMParser / regex | `parseSenadoVotaciones` | Ya maneja `<votacion>` array/objeto, totales, `mapSeleccion` (garbled→omite), `votoSeq`, provenance. |
| Cruce por nombre | comparación de strings | `reconciliarVotosSenado` → `correrPipeline` | Blocking + adjudicación + guarda IDENT-12 + fail-closed. El name-match ingenuo es el riesgo existencial #1. |
| Estabilizar filas homónimas | hash del nombre | `seq:<votoSeq>` (índice posicional) | Ya resuelto (CR-02); un hash del nombre colapsaría dos menciones idénticas. |
| Replay sin re-fetch | re-scrapear | `--from-r2` (envelope R2) | DEBT-01. **Pero requiere el fix del envelope Senado (Pitfall 1).** |
| Idempotencia | delete+insert | upsert `onConflict:'votacion_id,fuente_voter_id'` | Ya en el writer. |

**Key insight:** El 95% de esta fase es ejecución + un fix de plumbing de ~2 campos. La tentación de "reescribir el path Senado limpio" es exactamente lo que el HALLAZGO RECTOR prohíbe.

## Runtime State Inventory

> Fase de EJECUCIÓN/wiring con un backfill (escritura de datos nuevos), no un rename. Aun así, el backfill toca estado almacenado.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Tabla `voto` (Supabase): el backfill Senado INSERTA filas `voto` con `fuente_voter_id = seq:<n>`, `parlamentario_id` null salvo determinista. Idempotente por `(votacion_id, fuente_voter_id)`. Tabla `votacion` gana filas `id='senado:...'`. | Data-population (no migración de schema — el schema 0019 ya soporta `ausente` y `estado_vinculo`). Backfill LOCAL, gated operador. |
| Live service config | R2: el backfill escribe crudo content-addressed bajo `tramitacion/<boletin>/<fecha>/<sha>.json`. Hoy el envelope NO incluye el XML de votaciones nominales del Senado → el crudo Senado no queda reconstruible por `--from-r2`. | **Fix de envelope** (código): añadir `votXmlSenado` al envelope + servirlo en el `senadoFake`. |
| OS-registered state | Ninguno — no hay cron/task nuevo. El cron de leyes es semanal y fuera de alcance aquí (backfill = LOCAL manual). | None — verificado por STATE.md (66-02 backfill es LOCAL operador, no cron). |
| Secrets/env vars | `SUPABASE_API_URL`/`SUPABASE_SECRET_KEY` (write PROD), `R2_*` (Etapa 1), `MINIMAX_*`/LLM (opcional, gated). Todos ya existentes en `.env`, leídos por `run-votos-masivo-cli.ts` (BOM-safe `loadEnv`). Ningún key nuevo. | None — reusa los del CLI. Si no hay LLM, degrada fail-closed (SC#3). |
| Build artifacts | `packages/*/dist/*.d.ts` (stale). No relevante para la ejecución (tests corren sobre `src/` vía tsx/vitest). | None. |

**El envelope R2 hoy (verificado):** `{ boletin, tramXml, votXml, detalles }` (ingest-run.ts línea 284; run-camara-votos.ts línea 192-197). `votXml` es de la **Cámara** (`fetchVotacionesBoletin`). NO hay campo para el XML de `votaciones.php` del Senado. Este es el gap que gatea el replay Senado.

## Common Pitfalls

### Pitfall 1: `--from-r2` DESCARTA los votos del Senado (el gap real de la fase)
**What goes wrong:** En replay, `senadoFake.fetchVotaciones()` devuelve `""` (run-camara-votos.ts línea 216-217), y el envelope R2 nunca guardó el XML de `votaciones.php`. Resultado: un backfill Senado escribe crudo a R2 pero al re-ingerir con `--from-r2` (p.ej. tras un cambio de schema o un fix del reconciliador) los votos del Senado NO se reconstruyen — solo la tramitación (`tramXml`) y los votos de Cámara. Viola la regla LOCKED "R2 = verdad cruda reconstruible; re-ingestar SIEMPRE desde R2".
**Why it happens:** El wire de Phase 66 se centró en la Cámara; el envelope shape se copió VERBATIM de `ingest-cli.ts` (que tampoco cubría votaciones nominales del Senado como campo dedicado).
**How to avoid:** (1) Añadir `votXmlSenado: string | null` al envelope en `ingest-run.ts` (capturarlo donde hoy se hace `senVotXml`, análogo a `votXmlCrudo`). (2) En `run-camara-votos.ts` modo `--from-r2`, el `senadoFake.fetchVotaciones()` debe devolver `envelope.votXmlSenado ?? ""`. (3) Test: `--from-r2` con un envelope que trae `votXmlSenado` puebla ≥1 voto Senado con `seq:<n>` sin fetch.
**Warning signs:** Un replay reporta `votos` menor que la corrida original; cobertura Senado cae a 0 tras `--from-r2`.

### Pitfall 2: `votaciones.php` puede venir vacío (boletín en primer trámite Cámara)
**What goes wrong:** Tratar `<votaciones></votaciones>` como error.
**Why it happens:** Un proyecto que aún no llegó al Senado no tiene votaciones nominales.
**How to avoid:** YA manejado — `parseSenadoVotaciones` devuelve `[]` sin lanzar; `runIngest` lo trata como no-error (el `try/catch` solo captura fallos de fetch/parse reales). No cambiar.
**Warning signs:** `errores` con etapa `senado-votaciones` para boletines que legítimamente no tienen votos Senado (sería un falso error).

### Pitfall 3: `votoSeq` estable solo si el orden del XML es determinista
**What goes wrong:** Si la fuente reordena los `<VOTO>` entre corridas, `seq:<n>` apunta a otra persona y el upsert por `(votacion_id, seq:<n>)` "mueve" un voto.
**Why it happens:** `votoSeq` es el índice posicional en la fuente, no un id oficial (el Senado no expone uno).
**How to avoid:** Aceptar el trade-off documentado (es la única llave disponible). El replay `--from-r2` MITIGA esto: re-ingerir del MISMO crudo R2 preserva el orden byte-a-byte → `seq:<n>` estable. Otra razón más para cerrar Pitfall 1: el crudo R2 es la fuente de verdad del orden.
**Warning signs:** Cambios inexplicables de `mencion_nombre` para un `(votacion_id, seq:<n>)` fijo entre re-ingestas LIVE (no en replay).

### Pitfall 4: Framing "nunca confirmado" vs. código (determinista → confirmado)
**What goes wrong:** El planner escribe un guard que fuerza todo voto Senado a `probable`/`no_confirmado`, degradando el match determinista único.
**Why it happens:** La descripción de la fase dice "nunca un FK confirmado fabricado" y se lee como "nunca confirmado".
**How to avoid:** La regla real es "nunca confirmado por match AMBIGUO/heurístico". Determinista único = `confirmado` legítimo (test reconciliar-senado.ts línea 72-108, invariante VOTO-03). NO tocar la rama determinista. Documentar la distinción en el plan y en el commit.
**Warning signs:** `reconciliar-senado.test.ts` caso "nombre único → confirmado" empieza a fallar.

### Pitfall 5: Escribir a PROD sin loguear el destino (LOCAL vs REMOTO)
**What goes wrong:** Un backfill apunta a la DB equivocada.
**How to avoid:** YA implementado — `run-votos-masivo-cli.ts` línea 111 loguea `writer Supabase REMOTO (url)` antes de escribir. Mantener. El backfill LIVE Senado es checkpoint de operador (igual que 66-02).

## Code Examples

### Fetch de votaciones del Senado (ya existe)
```typescript
// Source: packages/tramitacion/src/connector-senado.ts (líneas 50-54) — leído esta sesión
async fetchVotaciones(boletinBase: string): Promise<string> {
  const url = `${BASE}/votaciones.php?boletin=${encodeURIComponent(boletinBase)}`;
  return this.fetch(url); // assertAllowedUrl → robots → rateLimiter.wait → fetcher.get
}
```
Nota Pitfall 1 del conector: el Senado se consulta con el boletín **BASE sin sufijo** (`18296`, no `18296-05`). `runIngest` ya llama `baseDe(boletinFull)`.

### Reconciliación por nombre con guarda LOCKED (ya existe)
```typescript
// Source: packages/tramitacion/src/reconciliar-senado.ts (líneas 145-176) — leído esta sesión
switch (res.tipo) {
  case "determinista":
    v = { enlace: confirmar(res.parlamentarioId, "determinista"), metodo: "determinista", estado_vinculo: "confirmado" };
    break;
  case "probable":
    v = { enlace: null, metodo: "llm", estado_vinculo: "probable" }; // NUNCA vincula a la ficha
    break;
  case "revision":
  case "no_confirmado":
  default:
    v = { enlace: null, metodo: null, estado_vinculo: "no_confirmado" };
    break;
}
const voto: VotoParaEscribir = {
  votacion_id: votacionId,
  fuente_voter_id: `seq:${crudo.votoSeq}`, // discriminador estable (CR-02)
  mencion_nombre: mencionNombre,
  enlace: v.enlace, seleccion: crudo.seleccion, metodo: v.metodo, estado_vinculo: v.estado_vinculo,
};
```

### El fix del envelope (lo que la fase debe AÑADIR — patrón, no código final)
```typescript
// ingest-run.ts — capturar el crudo de votaciones Senado (análogo a votXmlCrudo de Cámara):
let votXmlSenadoCrudo: string | null = null;
// en el paso 4:
const senVotXml = await opts.senado.fetchVotaciones(base);
votXmlSenadoCrudo = senVotXml;
// en el envelope Etapa 1:
const envelope = { boletin: boletinFull, tramXml: tramXmlCrudo, votXml: votXmlCrudo,
                   votXmlSenado: votXmlSenadoCrudo, detalles: detallesCrudos };

// run-camara-votos.ts modo --from-r2 — el senadoFake sirve el crudo Senado:
const senadoFake = {
  async fetchTramitacion() { return envelope.tramXml ?? ""; },
  async fetchVotaciones() { return envelope.votXmlSenado ?? ""; }, // ← hoy devuelve ""
} as unknown as SenadoConnector;
```
El planner debe verificar el shape exacto del envelope en AMBOS sitios (`ingest-run.ts` línea 284, `run-camara-votos.ts` línea 192) + `ingest-cli.ts` (por si comparte el shape) y mantenerlos sincronizados. Retro-compatibilidad: `votXmlSenado` opcional (`?? ""`) para envelopes viejos sin el campo.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Runner Senado separado | Path Senado dentro de `runIngest` paso 4 | v2.0 (código base) | No crear runner Senado; correr el CLI compartido con boletines Senado. |
| Envelope `{ boletin, tramXml, votXml, detalles }` (Cámara-céntrico) | **Debe** añadir `votXmlSenado` | esta fase | Cierra el gap de replay Senado (Pitfall 1). |
| FK como string crudo | `EnlaceConfirmado` branded (IDENT-12) | — | Solo `confirmar()` en la rama determinista mintea FK; string crudo no compila. |

**Deprecated/outdated:** El framing "Senado nunca confirmado" es impreciso respecto al código LOCKED — ver Pitfall 4 y Assumptions A1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | La regla LOCKED es "nunca `confirmado` por match ambiguo"; un match determinista único del Senado SÍ es `confirmado` legítimo. Basado en el código+test leídos, NO en la descripción de la fase. | Summary / Pitfall 4 | Si el operador realmente quiere CERO confirmado del Senado (aun determinista), el planner debe añadir un guard explícito y actualizar `reconciliar-senado.test.ts` — cambio de comportamiento LOCKED que requiere confirmación humana antes de ejecutar. |
| A2 | El envelope R2 hoy NO guarda el XML de votaciones nominales del Senado (solo `tramXml` + `votXml` de Cámara). | Runtime State / Pitfall 1 | Si en realidad ya lo guarda en otro campo, el fix es solo el `senadoFake` (menos trabajo). Verificable leyendo el envelope en los 3 sitios antes de codear. |
| A3 | El backfill LIVE Senado + write PROD es checkpoint de operador (paridad con 66-02), no algo que el agente ejecute. | Validation / Pitfall 5 | Si el agente corre el LIVE, quema WAF/cuota sin sign-off. STATE.md confirma el patrón LOCAL-operador. |
| A4 | Los códigos/tokens de `<SELECCION>` del Senado (Sí/No/Abstención/Pareo) NO fueron confirmados LIVE en esta sesión; `mapSeleccion` los infiere por prefijo string (`startsWith("si"|"no"|"abst"|"pareo")`), no por código numérico como la Cámara. | Open Questions Q2 | Si el Senado usa códigos numéricos o tokens distintos (p.ej. "A FAVOR"), `mapSeleccion` los omitiría (garbled→null→voto descartado). Gap de verificación LIVE análogo a Phase 64. |

## Open Questions

1. **¿El operador quiere CERO `confirmado` del Senado, o `confirmado` solo si determinista único (paridad Cámara)?**
   - What we know: el código LOCKED mintea `confirmado` en determinista; la descripción de la fase dice "nunca confirmado fabricado".
   - What's unclear: si "fabricado" excluye el determinista único (mi lectura) o incluye todo.
   - Recommendation: tratar A1 como la interpretación por defecto (determinista único = confirmado OK). Si discuss-phase o el operador dice lo contrario, es un cambio de comportamiento LOCKED → guard explícito + test actualizado + nota en commit. NO degradar el determinista silenciosamente.

2. **¿Qué tokens exactos usa `<SELECCION>` en `votaciones.php` LIVE?**
   - What we know: `mapSeleccion` matchea por prefijo `si|sí|no|abst|pareo`; un token desconocido → `null` → voto omitido (WR-03, no se fabrica clasificación).
   - What's unclear: si el Senado emite "A FAVOR"/"EN CONTRA"/códigos numéricos → serían omitidos silenciosamente.
   - Recommendation: **SPIKE LIVE acotado (operador, gated)** contra 1-2 boletines Senado con votaciones conocidas, capturar el XML crudo a R2, y fijar los tokens observados con un test de fixture. Igual que el gap de códigos de Phase 64 (Abstención/Pareo nunca confirmados live → fijados con test). Si no se puede correr LIVE, marcar como riesgo residual con fixture basado en el shape documentado en `parse-senado-votacion.ts`.

3. **¿La cobertura Senado necesita un invariante análogo al DIPID-maestra de la Cámara?**
   - What we know: `reportarCobertura` cuenta por `estado_vinculo` (sirve para Senado) + un invariante "0 DIPID-maestra no_confirmado" que es **Cámara-específico** (el Senado no tiene DIPID).
   - What's unclear: si se quiere una métrica Senado (p.ej. % `confirmado` vs `probable`/`no_confirmado` por votación).
   - Recommendation: reusar `porEstado` (ya agnóstico de cámara) para reportar cobertura Senado; NO forzar el invariante DIPID sobre filas Senado (colapsaría). Una métrica Senado dedicada es opcional/nice-to-have, no bloqueante.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Tests offline (vitest/tsx) | Ejecutor (todos los tests) | ✓ | vitest ^3, tsx ^4 | — |
| `tramitacion.senado.cl/wspublico/votaciones.php` | Backfill LIVE (operador) | No verificado esta sesión | — | Replay `--from-r2` desde crudo R2 ya capturado; SPIKE gated. |
| R2 (`R2_*` en `.env`) | Etapa 1 + `--from-r2` | Asumido presente (66-02 lo usó) | — | Sin R2, Etapa 1 se omite con WARN (degrada honesto); pero replay Senado requiere R2. |
| Supabase PROD (`SUPABASE_API_URL`/`SECRET_KEY`) | Write del backfill | Asumido presente | — | `--dry-run` / in-memory (no escribe). |
| MiniMax / LLM provider (gated) | Resolver homónimos Senado | Opcional | — | `PROVIDER_DEGRADA_FAIL_CLOSED` → homónimo = `no_confirmado` (SC#3). |

**Missing dependencies with no fallback:** Ninguna para la porción de código/tests (offline). El LIVE Senado es checkpoint de operador, no bloquea el trabajo del agente.

**Missing dependencies with fallback:** El endpoint LIVE `votaciones.php` — el agente NO lo toca; el fix de código + tests offline + runbook son completos sin él.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.0.0 (run vía tsx) |
| Config file | Ninguno dedicado en `@obs/votos` (usa defaults + `main: ./src/index.ts`); `@obs/tramitacion` idem |
| Quick run command | `pnpm --filter @obs/votos test` |
| Full suite command | `pnpm --filter @obs/votos test && pnpm --filter @obs/tramitacion test && pnpm --filter @obs/votos typecheck` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOTO-01 (Senado) | `votaciones.php` XML → voto Senado con `seq:<n>` + estado correcto | unit (fixture) | `pnpm --filter @obs/tramitacion test reconciliar-senado` | ✅ (reconciliar-senado.test.ts — determinista/probable/no_confirmado/seq) |
| VOTO-01 (Senado) | Path Senado enrutado en `runIngest` (fetch→parse→reconcile→upsert) | unit | `pnpm --filter @obs/tramitacion test` | ⚠️ parcial — el fixture Senado en runIngest/run-camara-votos está VACÍO hoy (`fakeSenado` devuelve `<Votaciones></Votaciones>`) → **Wave 0: fixture Senado NO vacío** |
| VOTO-01 (Senado) | `--from-r2` replay reconstruye votos Senado (fix Pitfall 1) | unit | `pnpm --filter @obs/votos test run-camara-votos` | ❌ Wave 0 — no existe; el replay Senado hoy descarta votos |
| VOTO-01 (Senado) | SC#3 fail-closed sin provider → homónimo = `no_confirmado`, no aborta | unit | `pnpm --filter @obs/tramitacion test` | ✅ (reconciliar-senado.test.ts caso revisión/no_match); ⚠️ falta un test a nivel `runIngest` con fixture Senado poblado |
| VOTO-01 (Senado) | Backfill LIVE `votaciones.php` (rate-limit 2-3s) | manual-only (operador-LOCAL, gated) | `VOTOS_LIVE=1 tsx packages/votos/src/run-votos-masivo-cli.ts --boletines-file <senado.txt>` | ⚠️ runbook — no automatizable en CI (WAF/write PROD) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/votos test` (offline, rápido).
- **Per wave merge:** `pnpm --filter @obs/votos test && pnpm --filter @obs/tramitacion test && pnpm --filter @obs/votos typecheck` (sin regresión al reconciliador/parser/golden compartido — grep-gate `git diff` vacío en `reconciliar-senado.ts` si el fix es solo en `ingest-run.ts`/`run-camara-votos.ts`).
- **Phase gate:** Suite completa verde + `tsc -b` verde antes de `/gsd:verify-work`. Backfill LIVE PROD = checkpoint de operador (fuera del gate automático).

### Wave 0 Gaps
- [ ] Fixture Senado NO vacío en `run-camara-votos.test.ts` (hoy `fakeSenado.fetchVotaciones` → `<Votaciones></Votaciones>`) — un fixture de `votaciones.php` con ≥2 votos (uno determinista→`confirmado`, uno homónimo→`no_confirmado`) que pruebe el path Senado end-to-end en `runIngest`.
- [ ] Test `--from-r2` con `votXmlSenado` en el envelope → reconstruye votos Senado sin fetch (conectores que lanzan si se tocan) — cubre el fix de Pitfall 1.
- [ ] Test de idempotencia + `seq:<n>` a nivel runIngest para el path Senado (dos homónimos no colapsan).
- [ ] Runbook operador-LOCAL `67-BACKFILL-SENADO-RUNBOOK.md` (espejo de `66-BACKFILL-RUNBOOK.md`): boletines Senado, `--boletines-file`, `VOTOS_LIVE`/rate-limit, reporte de cobertura por estado.
- [ ] (Opcional, gated) SPIKE LIVE para fijar los tokens de `<SELECCION>` del Senado (Open Q2 / A4).

*(La infra de test existe; los gaps son fixtures Senado no-vacíos + el test del fix de replay.)*

## Security Domain

`security_enforcement: true`, ASVS Level 1, block_on: high.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Backfill server-only con service key de `.env`; sin auth de usuario. |
| V3 Session Management | no | — |
| V4 Access Control | sí (indirecto) | El write PROD usa `SUPABASE_SECRET_KEY` (service_role, bypassa RLS) — patrón LOCKED del proyecto (Camino A). El backfill es LOCAL/operador; el guard CI anti-PII de `app/` no aplica a `packages/votos` (no expone endpoints). |
| V5 Input Validation | sí | `VotoSchema.parse` (zod) valida cada fila antes de escribir; `mapSeleccion`/`intParse` rechazan tokens/enteros garbled (no fabrican datos). SSRF allowlist en `assertAllowedUrl` para `votaciones.php`. |
| V6 Cryptography | no | sha256 solo para content-addressing R2 (no secreto). |

### Known Threat Patterns for este stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Atribución de un voto a la persona equivocada (name-match) | Tampering / Repudiation | Guarda IDENT-12: solo determinista mintea `EnlaceConfirmado`; ambiguo → `probable`/`no_confirmado` sin FK. Riesgo existencial #1 del proyecto. |
| Fabricación de una clasificación de voto (token garbled → "abstención") | Tampering | `mapSeleccion`→null → voto OMITIDO (WR-03); nunca se coacciona a una opción contada. |
| SSRF vía `boletin` en la URL de `votaciones.php` | Tampering / Info Disclosure | `assertAllowedUrl` + `encodeURIComponent` del boletín; host fijo `tramitacion.senado.cl`. |
| Ráfagas al WAF gubernamental | DoS (contra la fuente) | `HostRateLimiter` 2-3s serial (LOCKED, no override); backfill LOCAL acotado; `--from-r2` = 0 fetch. |
| Derivado sin crudo reconstruible | Repudiation (pérdida de provenance) | CR-01: fallo de `putImmutable` GATEA la Etapa 2. **Extender al crudo Senado (Pitfall 1).** |

Sin superficie de seguridad nueva si el fix se limita a plumbing del envelope (no toca el reconciliador, no crea endpoints, votos = dato público DIPID+nombre, no PII/RUT).

## Sources

### Primary (HIGH confidence — leídos esta sesión)
- `packages/tramitacion/src/ingest-run.ts` — `runIngest`, paso 4 Senado, fail-closed provider, Etapa 1 R2 + CR-01, envelope shape.
- `packages/tramitacion/src/reconciliar-senado.ts` — guarda IDENT-12, `seq:<n>`, mint solo determinista.
- `packages/tramitacion/src/reconciliar-senado.test.ts` — invariantes determinista/probable/no_confirmado/seq.
- `packages/tramitacion/src/parse-senado-votacion.ts` — `mapSeleccion`, `votoSeq`, tolerancia a vacío.
- `packages/tramitacion/src/connector-senado.ts` — `fetchVotaciones`, boletín base sin sufijo.
- `packages/votos/src/run-camara-votos.ts` — reenvío r2Store/snapshotWriter/fromR2, `senadoFake` (gap de replay).
- `packages/votos/src/run-camara-votos.test.ts` — patrón de fixtures + wire dos-etapas (P66).
- `packages/votos/src/run-votos-masivo-cli.ts` — CLI operador, R2Store de `.env`, cobertura.
- `packages/tramitacion/src/model.ts` — `EstadoVinculo`, `VotoSchema`.
- `.planning/phases/66-.../66-01-SUMMARY.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `67-CONTEXT.md`.

### Secondary (MEDIUM)
- `CLAUDE.md` — `fast-xml-parser` para XML Senado, dos etapas LOCKED, fail-closed, rate-limit.

### Tertiary (LOW)
- Tokens LIVE de `<SELECCION>` del Senado — NO verificados esta sesión (A4/Open Q2).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todo el código leído directamente; cero paquetes nuevos.
- Architecture: HIGH — el path Senado en `runIngest` fue leído línea por línea; el gap de replay está localizado (Pitfall 1).
- Pitfalls: HIGH para el gap de replay y fail-closed; MEDIUM para el framing "nunca confirmado" (requiere confirmación operador, A1); LOW para tokens `<SELECCION>` LIVE (A4).

**Research date:** 2026-07-14
**Valid until:** ~30 días (código estable; el único movimiento externo es el shape del XML de `votaciones.php`, verificable solo LIVE).

## RESEARCH COMPLETE

**Phase:** 67 - VOTO P3d — Paridad Senado (voto individual por nombre)
**Confidence:** HIGH

### Key Findings
- El path Senado (fetch `votaciones.php` → parse → `reconciliarVotosSenado` → upsert) YA EXISTE y YA está enrutado dentro de `runIngest` paso 4. Fail-closed (SC#3) y `seq:<n>` (SC#2) ya implementados. Esta fase = ejecución + un fix de plumbing, NO net-new.
- **Gap real único:** `--from-r2` DESCARTA los votos del Senado — el envelope R2 no guarda el XML de `votaciones.php` y el `senadoFake` del replay devuelve `""`. Fix: añadir `votXmlSenado` al envelope + servirlo (Pitfall 1).
- **Corrección de framing (A1/Pitfall 4):** "Senado nunca confirmado" es impreciso. El código mintea `confirmado` para un match determinista único (paridad Cámara, VOTO-03). La regla LOCKED real es "nunca confirmado por match ambiguo". NO degradar el determinista sin confirmación del operador.
- Tests offline cubren reconciliar-senado; los gaps de Wave 0 son fixtures Senado NO vacíos en runIngest/run-camara-votos + el test del fix de replay.
- Backfill LIVE `votaciones.php` = checkpoint de operador-LOCAL (paridad 66-02); tokens de `<SELECCION>` LIVE no verificados (gap tipo Phase 64, A4).

### File Created
`.planning/phases/67-voto-p3d-paridad-senado-voto-individual-por-nombre/67-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Código leído; cero paquetes nuevos. |
| Architecture | HIGH | Path Senado en runIngest leído; gap localizado. |
| Pitfalls | HIGH/MEDIUM | Gap de replay HIGH; framing "nunca confirmado" MEDIUM (A1); tokens LIVE LOW (A4). |

### Open Questions
1. ¿Cero `confirmado` Senado o `confirmado` solo si determinista único (paridad Cámara)? → default A1; cambio de comportamiento requiere confirmación operador.
2. Tokens exactos de `<SELECCION>` LIVE → SPIKE gated (operador) o riesgo residual con fixture.
3. ¿Métrica de cobertura Senado dedicada? → reusar `porEstado`; NO forzar el invariante DIPID-maestra (Cámara-only).

### Ready for Planning
Research complete. El planner puede crear PLAN.md: (Wave code) fix del envelope Senado + `senadoFake` + fixtures/tests Senado no-vacíos; (Wave 0) runbook operador-LOCAL. Confirmar A1 con el operador antes de tocar la rama determinista.
