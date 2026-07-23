# Phase 90: PERSONAS P2a — Conector bio oficial dos-etapas + membresía de comisiones (GATE de 91) - Research

**Researched:** 2026-07-22
**Domain:** Ingesta dos-etapas (fuente→R2→Supabase) de bio oficial + militancia + membresía de comisiones, con allowlist de minimización 21.719, identidad fail-closed, sobre stack TS/Deno + Supabase ya validado.
**Confidence:** HIGH para el camino de diputados (probado en vivo, 200 OK, DIPID matchea la maestra); MEDIUM para senadores (BCN SPARQL estable pero vocabulario de predicados y join `persona/{id}`→`parlid_senado` pendiente de spike de ejecución); MEDIUM-BAJO para comisiones (ambos WSComisiones opendata en MANTENCIÓN — fuente re-derivada abajo).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Fuentes y conectores**
- Diputados: `WSCamaraDiputados getDiputados` (opendata.congreso.cl, XML por HTTP GET, sin SOAP) — trae `Militancia_Actual`/`Militancias_Periodos` + Distrito. `fast-xml-parser` ya en repo. **⚠️ CORRECCIÓN EMPÍRICA (ver Verdicts): este endpoint NO sirve — devuelve 632 diputados históricos con `Militancias_Periodos` VACÍO 100%. El endpoint correcto es `retornarDiputadosPeriodoActual` en `opendata.camara.cl` — probado 200 OK, 155 diputados vigentes, militancias pobladas, DIPID = `id_diputado_camara` de la maestra.**
- Senadores: SPIKE BCN SPARQL (`datos.bcn.cl`, ontología biografías — MEDIUM, probar EN VIVO) con degradación honesta a ficha senado.cl (cheerio) si el endpoint es inestable.
- Membresía de comisiones: fuente elegida por evidencia curl-first durante research. No asumir — probar.
- Package nuevo `packages/bio` (`@obs/bio`), espejo estructural de `packages/lobby`, reusando `@obs/ingest`.

**Modelo de datos (migración >0058 → es la 0059)**
- `parlamentario_bio` (1:1): profesión + campos vetados de bio oficial, provenance inline.
- `parlamentario_militancia`: histórico de partidos (partido, desde, hasta, es_actual), clave natural, provenance inline.
- `comision` + `comision_membresia`: modelo de comisiones (nombre, cámara, tipo) y membresía (parlamentario_id FK, cargo), provenance inline.
- `parlamentario.partido` (columna existente) se ACTUALIZA desde `Militancia_Actual` con fecha_captura fresca; histórico en tabla de militancias.
- RLS deny-by-default en TODAS las tablas nuevas (RLS habilitada, CERO policies, cero `grant … to anon` — regla >0044 lockdown-guard Block A). Las RPCs públicas de lectura nacen en Phase 91.

**Allowlist de campos (minimización 21.719)**
- PERMITIDOS en tablas servidas: nombre, militancias (partido + fechas), región/distrito/circunscripción, profesión, períodos del cargo, comisiones, cámara.
- EXCLUIDOS (SOLO en R2 crudo): RUT, familiares/terceros, fecha de nacimiento, email/teléfono personal, cualquier PII no esencial al cargo electo.
- El allowlist se implementa EN EL PARSER (los campos excluidos jamás llegan al modelo tipado) y se prueba con test que muerde.

**Identidad (fail-closed LOCKED)**
- Diputados: match determinista por `id_diputado_camara` (DIPID exacto); sin match → skip + reporte, JAMÁS fabricar.
- Senadores: `parlid_senado` si la fuente lo trae; si no, `matchDeterminista` de `@obs/identity`; ambigüedad → no escribir.
- NO se crean parlamentarios nuevos: la maestra es autoritativa.
- FK tipado con `EnlaceConfirmado` (branded type) donde aplique.

**Operación**
- CLI `run-bio-cli` espejo de `run-camara-lobby-cli`: flags `--dry-run`, `--from-r2 <path>`, `--xml-file` (bypass WAF), loadEnv BOM-safe.
- Corrida LIVE acotada la ejecuta el AGENTE (1-3 requests con rate-limit 2-3s); curl-first si WAF bloquea fetch de Node.
- Dos etapas SIEMPRE: crudo a R2 content-addressed (`bio/<recurso>/<fecha>/<sha256>.xml`, If-None-Match: *), luego parse+write leyendo del crudo; `--from-r2` reconstruye.
- Sin cron nuevo en esta fase.
- Migración a PROD por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f` (NUNCA `db push`); pgTAP para las tablas nuevas.

### Claude's Discretion
- Forma exacta de columnas/constraints de las 4 tablas nuevas (guiarse por 0021_lobby.sql).
- Detalles del SPIKE BCN SPARQL (query concreta, criterio de estabilidad para degradar).
- Si `parlamentario_bio` amerita ser columnas en `parlamentario` en vez de tabla — decidir en plan según cardinalidad real.

### Deferred Ideas (OUT OF SCOPE)
- Cron de refresco de bio (absorber en roster-weekly) — post-94 o v9.x.
- Fotos/avatares de parlamentarios — fuera de alcance v9.0.
- Histórico de períodos parlamentarios completo multi-legislatura — evaluar en v10.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BIO-01 | Conector de biografía oficial dos-etapas (fuente→R2→Supabase): WSCamaraDiputados para diputados + fuente Senado/BCN para senadores (SPIKE SPARQL BCN); PII de terceros/familiares queda en R2 | Endpoint diputados **corregido** a `retornarDiputadosPeriodoActual` (probado LIVE, DIPID = maestra, militancias pobladas, PII presente → allowlist obligatorio). BCN SPARQL **estable** (200 OK JSON, ontología `Militancy`/`PositionPeriod` presente) como fuente senadores, con fallback ficha senado.cl. Patrón dos-etapas = espejo de `run-camara-votos.ts`/`run-camara-lobby.ts` con `R2Store.putImmutable` |
| BIO-05 | Membresía de comisiones ingerida y modelada (hoy NO existe) — prerequisito de BIO-02/BIO-04 y CIT-04 | Modelo `comision` + `comision_membresia` sobre plantilla 0021. **Fuente re-derivada:** ambos WSComisiones de opendata (camara.cl y congreso.cl) están en `/mantencion.html` (302) HOY. Candidatos vivos: `citaciones_semana.aspx` (Cámara, HTML, WAF→curl) y `senado.cl` comisiones (PHP). Ver sección Comisiones + Open Question 1 |
</phase_requirements>

## Summary

Esta fase construye `@obs/bio` como espejo estructural de `@obs/lobby`/`@obs/votos`, ingiere bio oficial + militancia + membresía de comisiones en dos etapas (R2→Supabase), aplica un allowlist de minimización EN EL PARSER, y modela 4 tablas nuevas (migración 0059) con RLS deny-by-default. Es GATE de 91: sin la columna de bio y la membresía de comisiones, la ficha de 91 no monta.

El research empírico (9 requests curl, rate-limit 2-3s, UA identificatorio) produjo tres verdicts que **corrigen la CONTEXT** y deben propagarse al plan:

1. **Diputados — endpoint corregido.** La decisión CONTEXT (`getDiputados` en `opendata.congreso.cl`) es INCORRECTA: devuelve 632 diputados históricos con `<Militancias_Periodos />` vacío al 100% y sin distrito/región. El endpoint correcto —y el que ya alimentó el seed— es **`retornarDiputadosPeriodoActual`** en `opendata.camara.cl`: 200 OK, 155 diputados vigentes, `<Militancias>` con `<Partido>{Id,Nombre,Alias}` + fechas, y `<Id>` = `id_diputado_camara` de la maestra (match determinista directo). Trae PII (`FechaNacimiento`, `RUT`, `RUTDV`, `Sexo`) → el allowlist del parser DEBE excluirlos.

2. **BCN SPARQL — ESTABLE.** El endpoint `https://datos.bcn.cl/sparql` responde 200 OK con JSON válido en <1s; la ontología `bcn-biographies` está completa (`Militancy` 3.405, `PositionPeriod` 8.833, `PoliticalParty` 136, `Parliamentary`, `Senador`). Es viable como fuente de militancia de senadores. Caveat MEDIUM: los predicados exactos (no son `hasParty`/`startDate`) requieren un mini-spike de descubrimiento en ejecución, y el join `persona/{id}` de BCN → `parlid_senado` de la maestra no es directo (BCN indexa por su propio id de persona, no por PARLID) — por eso se conserva el fallback ficha senado.cl.

3. **Comisiones — fuente re-derivada.** Ambos `WSComisiones.asmx` de opendata (`opendata.camara.cl` y `opendata.congreso.cl`) redirigen a `/mantencion.html` (302) HOY; NO son fuente confiable. `WSDiputado.asmx` (que SÍ está vivo) no expone comisiones ni región/distrito. Fuente de comisiones queda como Open Question 1: candidatos vivos son `citaciones_semana.aspx` (Cámara, HTML, tras WAF, curl-first) y las páginas de comisiones de `senado.cl`. Debe probarse al inicio del plan; si ninguna trae integrantes con IDs, BIO-05 degrada a "catálogo de comisiones sin membresía" con estado honesto.

**Primary recommendation:** Construir `@obs/bio` espejando `@obs/lobby` (parse-*.ts + run-*.ts + writer-supabase.ts + run-bio-cli.ts), usar `retornarDiputadosPeriodoActual` (NO getDiputados) para diputados con allowlist-en-parser probado por fixture-PII-que-muerde, BCN SPARQL para militancia de senadores con fallback ficha senado.cl, migración 0059 con las 4 tablas deny-by-default sobre plantilla 0021, y resolver la fuente de comisiones con un curl-spike al inicio del plan (Open Question 1).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch bio/militancia/comisiones de fuentes gubernamentales | Conector Deno/TS (`@obs/bio`, server-only) | — | LOCKED: llamadas a fuentes NUNCA desde navegador (WAF+CORS); dos-etapas |
| Persistencia crudo inmutable | R2 (Cloudflare, S3 API) vía `R2Store` | — | Etapa 1 LOCKED: crudo content-addressed antes de parsear |
| Allowlist de minimización (drop PII) | Parser (`@obs/bio` parse-*.ts) | — | El campo excluido jamás llega al modelo tipado que ve el writer (defensa por construcción) |
| Match determinista de identidad | `@obs/identity` (`matchDeterminista`) + DIPID exacto | — | Fail-closed; único escritor de FK; sin match → skip |
| Persistencia derivada (bio/militancia/comisiones) | Supabase Postgres (`SupabaseBioWriter`, service_role) | — | Etapa 2 LOCKED: lee de R2, escribe con service key, upsert idempotente |
| Modelo de datos + RLS | Migración SQL 0059 (deny-by-default) | pgTAP | RPCs públicas y allowlist NACEN en 91, no aquí |
| Orquestación de la corrida | CLI operador/agente (`run-bio-cli.ts`) | — | 1-3 requests acotados; curl-first ante WAF; `--from-r2` replay |

## Standard Stack

### Core (todo YA en el repo — CERO dependencias nuevas)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fast-xml-parser` | 5.x (`npm:fast-xml-parser@5`) | Parsear XML de `retornarDiputadosPeriodoActual` | Ya en `@obs/tramitacion`/`@obs/votos`; parser puro JS rápido `[VERIFIED: repo grep]` |
| `@obs/ingest` | workspace | `Fetcher`, `HostRateLimiter`, `RobotsGuard`, `R2Store`, `sha256Hex`, `SnapshotWriter`, `DailyCache` | Colaboradores LOCKED de dos-etapas; UA identificatorio + rate-limit 2-3s ya cableados `[VERIFIED: packages/ingest/src/index.ts]` |
| `@obs/identity` | workspace | `matchDeterminista`, `normRut`, `isRutValido`, `EnlaceConfirmado` branded type | Único escritor de FK; fail-closed por construcción `[VERIFIED: packages/identity/src/deterministic.ts]` |
| `@obs/core` | workspace | `Parlamentario`, `normalizarNombre` | Tipos de la maestra `[VERIFIED: repo]` |
| `@supabase/supabase-js` | v2 (`^2.108.2`) | `SupabaseBioWriter` (service_role, upsert onConflict) | Ya dep de `@obs/lobby`/`@obs/votos` `[VERIFIED: repo]` |
| `cheerio` | 1.2.0 (`npm:cheerio@1.2.0`) | Fallback ficha senado.cl + posible parse de comisiones HTML | Ya en `@obs/lobby` (parse-leylobby, parse-camara-lobby) `[VERIFIED: repo]` |
| `fetch` nativo | — | BCN SPARQL (`Accept: application/sparql-results+json`) + deep-links | Cliente SPARQL = fetch + JSON.parse; CERO cliente RDF `[VERIFIED: STACK.md §3]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | 3.x/4.x | Validar forma del XML de diputados (contrato de fuente) | Compuerta de validación de contrato; el XML mal formado falla-loud antes de escribir |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `retornarDiputadosPeriodoActual` (opendata.camara.cl) | `getDiputados` (opendata.congreso.cl) | **NO usar getDiputados: militancias 100% vacías, 632 históricos, sin distrito. Probado.** |
| BCN SPARQL para militancia senadores | Ficha senado.cl (cheerio) | Fallback si el vocabulario BCN/join es intratable en el spike; degradación honesta LOCKED |
| WSComisiones opendata | citaciones_semana.aspx / senado.cl comisiones | opendata WSComisiones en mantención (302) HOY — no confiable |

**Installation:**
```bash
# NADA nuevo. Solo se crea packages/bio con las deps ya en el monorepo:
#   import { XMLParser } from "fast-xml-parser";
#   import { Fetcher, HostRateLimiter, RobotsGuard, R2Store, sha256Hex } from "@obs/ingest";
#   import { matchDeterminista } from "@obs/identity";
#   import { createClient } from "@supabase/supabase-js";
#   import * as cheerio from "cheerio";   // fallback senado.cl / comisiones HTML
```

**Version verification:** `fast-xml-parser@5`, `@supabase/supabase-js@^2.108.2`, `cheerio@1.2.0` ya declaradas y en uso en `packages/lobby`/`packages/votos` `[VERIFIED: repo grep]`. Sin instalación nueva.

## Package Legitimacy Audit

> No aplica en sentido de instalación: esta fase NO instala paquetes externos nuevos. Todas las deps (`fast-xml-parser`, `@supabase/supabase-js`, `cheerio`, `zod`, workspaces `@obs/*`) ya están en el monorepo y en uso productivo desde v2.0–v8.1. No hay superficie de slopsquatting nueva.

| Package | Registry | Estado en repo | Disposition |
|---------|----------|----------------|-------------|
| fast-xml-parser@5 | npm | En uso (@obs/tramitacion, @obs/votos) | Aprobado (preexistente) |
| @supabase/supabase-js@2 | npm | En uso (@obs/lobby, @obs/votos) | Aprobado (preexistente) |
| cheerio@1.2.0 | npm | En uso (@obs/lobby) | Aprobado (preexistente) |
| zod | npm | En uso (validación de contrato) | Aprobado (preexistente) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Runtime State Inventory

> Esta es una fase de INGESTA NET-NEW (crea tablas y datos nuevos), no un rename/refactor. Inventario acotado a lo que afecta el diseño:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `parlamentario` (0005) ya tiene 186 filas con `id_diputado_camara`/`parlid_senado` sembrados; `parlamentario.partido` poblado desde el seed (fecha_captura 2026-07-13). Esta fase lo REFRESCA desde `Militancia_Actual`. | Code: writer actualiza `parlamentario.partido` + fecha_captura. Data: 155 dip + 31 sen a re-poblar bio. |
| Live service config | R2 bucket `observatorio` (crudo va a `bio/<recurso>/<fecha>/<sha>.xml`, prefijo nuevo). | None — prefijo nuevo, no colisiona con votos/lobby/agenda. |
| OS-registered state | Ningún cron nuevo en esta fase (CONTEXT: cron diferido). `roster-weekly.yml` NO se toca. | None — verificado en CONTEXT (deferred). |
| Secrets/env vars | Reusa `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`, `R2_*` de `.env` (BOM-safe loadEnv). Sin secreto nuevo (BCN y opendata son GET anónimos). | None — sin key nueva. |
| Build artifacts | `packages/bio` nuevo → nuevo `tsconfig` con `references` (NO `paths` — gotcha Phase 43: path-aliases rompen `tsc -b`). Añadir al workspace pnpm. | Build: registrar en pnpm-workspace + referencias tsconfig del monorepo. |

**Nothing found in category:** OS-registered state y Secrets confirmados sin cambios (CONTEXT deferred el cron; fuentes anónimas).

## Empirical Verdicts (probado EN VIVO 2026-07-22, curl, rate-limit 2-3s, UA identificatorio)

### VERDICT 1 — Diputados: `retornarDiputadosPeriodoActual` ✅ (NO `getDiputados`)

**Endpoint que FUNCIONA:** `GET https://opendata.camara.cl/camaradiputados/WServices/WSDiputado.asmx/retornarDiputadosPeriodoActual`
- HTTP **200**, 179.061 bytes, 1.0s, XML directo (sin SOAP envelope). WAF NO bloquea curl. `[VERIFIED: live curl]`
- **155 `<DiputadoPeriodo>`** (cámara vigente completa en 1 request).
- `<Id>` = **DIPID = `id_diputado_camara`** de la maestra (probado: seed `id_diputado_camara="1009"`; XML trae `<Id>1074</Id>` etc. → match determinista directo). `[VERIFIED: seed + live]`
- Militancias POBLADAS: cada diputado trae `<Militancias>` → N× `<Militancia>` con `<FechaInicio>`, `<FechaTermino>`, `<Partido>{<Id>,<Nombre>,<Alias>}`. Histórico completo + actual (la `Militancia` con `FechaTermino` más futura / abierta = actual). `[VERIFIED: live, 315 Militancia / 155 dip]`
- **PII PRESENTE (allowlist DEBE excluir):** `<FechaNacimiento>` (poblado), `<RUT>` / `<RUTDV>` (vacíos hoy pero presentes en el schema), `<Sexo Valor=..>`. `[VERIFIED: live]`
- **NO trae:** Región, Distrito, Circunscripción, Profesión, Comité, Comisiones. → Distrito/Región de diputados NO salen de aquí (ver Open Question 2).

Evidencia cruda (recortada):
```xml
<DiputadosPeriodoColeccion xmlns="http://opendata.camara.cl/camaradiputados/v1">
  <DiputadoPeriodo>
    <FechaInicio>2030-03-10T00:00:00</FechaInicio>
    <Diputado>
      <Id>1074</Id>
      <Nombre>Marisela</Nombre><Nombre2 />
      <ApellidoPaterno>Santibáñez</ApellidoPaterno><ApellidoMaterno>Novoa</ApellidoMaterno>
      <FechaNacimiento>1975-04-24T00:00:00</FechaNacimiento>   <!-- PII: EXCLUIR -->
      <RUT /><RUTDV />                                          <!-- PII: EXCLUIR -->
      <Sexo Valor="0">Femenino</Sexo>                           <!-- PII: EXCLUIR -->
      <Militancias>
        <Militancia>
          <FechaInicio>2024-01-17T00:00:00</FechaInicio><FechaTermino>...</FechaTermino>
          <Partido><Id>PC</Id><Nombre>Partido Comunista</Nombre><Alias>PC</Alias></Partido>
        </Militancia>
        ...
```

**`getDiputados` (opendata.congreso.cl) — RECHAZADO:** HTTP 200, 207.370 bytes, pero **632 `<Diputado>` históricos** (DIPID 208, 485… ex-diputados), `<Militancias_Periodos />` **VACÍO en las 631** (0 pobladas), sin Distrito/Región/Comité. `[VERIFIED: live]` **No usar.**

### VERDICT 2 — Senadores: BCN SPARQL ESTABLE ✅ (con caveats)

**Endpoint:** `GET https://datos.bcn.cl/sparql?query=<SPARQL>&…` con `Accept: application/sparql-results+json`
- HTTP **200**, JSON válido, <1s incluso en agregaciones grandes. `[VERIFIED: live, 5 queries]`
- Ontología `bcn-biographies` COMPLETA: `PositionPeriod` (8.833), **`Militancy` (3.405)**, `PoliticalParty` (136), `Cargo`, `Rol`, `Parliamentary`, `Senador`, `Diputado`. `[VERIFIED: live class census]`
- Los nodos `Militancy` enlazan a `http://datos.bcn.cl/recurso/persona/{id}` (p.ej. `persona/3370`); las fechas se codifican como sub-recursos `.../militancia/{id}/inicio`. `[VERIFIED: live]`
- **Caveats (por qué MEDIUM):**
  1. Los predicados NO son `hasParty`/`startDate` (mi guess devolvió vacío). El vocabulario exacto requiere un mini-spike `DESCRIBE`/`?pred ?obj` sobre un nodo `Militancy` al inicio del plan (barato, 1-2 queries).
  2. **Join a la maestra:** BCN indexa por `persona/{id}` propio, NO por `parlid_senado`. No hay cross-key directo → el match a los 31 senadores de la maestra sería por NOMBRE determinista (`matchDeterminista` sobre `rdfs:label`), fail-closed ante homónimo. Esto es aceptable (31 senadores, nombres únicos) pero es el riesgo real de BCN.

**Fallback LOCKED (si el spike de vocabulario/join no cierra):** ficha `senado.cl` del senador (HTML → cheerio), cruzando por `parlid_senado` que la maestra YA tiene. Degradación honesta declarada en CONTEXT.

Evidencia cruda (class census, recortada):
```
 8833  bcn-biographies#PositionPeriod
 3405  bcn-biographies#Militancy
  136  bcn-biographies#PoliticalParty
    5  bcn-biographies#Senador
    2  bcn-biographies#Diputado
```

### VERDICT 3 — Comisiones: fuente opendata en MANTENCIÓN ❌ → re-derivar

- `GET https://opendata.camara.cl/camaradiputados/WServices/WSComisiones.asmx/retornarComisionesVigentes` → **HTTP 302** → `/mantencion.html`. `[VERIFIED: live]`
- `GET https://opendata.camara.cl/camaradiputados/WServices/WSComisiones.asmx` (method list) → **302 mantención**. `[VERIFIED: live]`
- `GET https://opendata.congreso.cl/wscomisiones.asmx` → **302 mantención**. `[VERIFIED: live]`
- `WSDiputado.asmx` (vivo, 200) expone SOLO: `retornarDiputado`, `retornarDiputados`, `retornarDiputadosPeriodoActual`, `retornarDiputadosXPeriodo`. Probado `retornarDiputado?prmDiputadoId=1074` (200, 2.168 bytes) → mismos campos que la colección **SIN comisiones**. `[VERIFIED: live]`

**Conclusión:** la Cámara opendata NO ofrece membresía de comisiones vía servicio vivo HOY. Fuente re-derivada = **Open Question 1** (curl-spike al inicio del plan sobre `citaciones_semana.aspx` y `senado.cl` comisiones). Si ninguna trae INTEGRANTES con id/nombre, BIO-05 degrada a "catálogo de comisiones (nombre/cámara/tipo) SIN membresía", modelado igual pero `comision_membresia` vacía con estado honesto — nunca inventar membresía.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────── run-bio-cli.ts (operador/agente) ───────────────────────────┐
                    │  loadEnv BOM-safe · findWorkspaceRoot · flags --dry-run/--from-r2/--xml-file           │
                    └───────────────────────────────────────────────────────────────────────────────────────┘
                                                      │ ensambla colaboradores REALES
                                                      ▼
   ┌──────────────┐   fetch (o --xml-file curl)   ┌──────────────────┐   Etapa 1: putImmutable    ┌────────────┐
   │ Fuentes      │ ─────────────────────────────▶│ runBioDiputados  │───────────────────────────▶│  R2Store   │
   │ · camara.cl  │   retornarDiputadosPeriodo…   │ runBioSenadores  │   bio/<rec>/<fecha>/<sha>   │ (crudo)    │
   │ · datos.bcn  │   SPARQL Militancy            │ runComisiones    │◀───────────────────────────│ If-None-M:*│
   │ · comisiones │   (Open Q1)                   └──────────────────┘   Etapa 2: lee del crudo    └────────────┘
   └──────────────┘                                        │                (--from-r2 replay)
                                                            ▼
                              ┌──────────────────── parse-*.ts (ALLOWLIST) ────────────────────┐
                              │ XMLParser / SPARQL-json / cheerio                                │
                              │ ► DROP PII (FechaNacimiento, RUT, Sexo, terceros) EN EL PARSER   │
                              │ ► emite modelo tipado SIN campos vetados (BioParlamentario,      │
                              │   Militancia, ComisionMembresia)                                 │
                              └──────────────────────────────────────────────────────────────────┘
                                                            │
                                                            ▼
                    ┌──────────────── matchDeterminista (@obs/identity) — FAIL-CLOSED ────────────────┐
                    │ diputados: DIPID exacto = id_diputado_camara │ senadores: parlid_senado / nombre │
                    │ sin match / ambiguo → SKIP + reporte (NUNCA fabrica FK, NUNCA crea parlamentario) │
                    └────────────────────────────────────────────────────────────────────────────────┘
                                                            │ EnlaceConfirmado branded
                                                            ▼
                    ┌──────────────── SupabaseBioWriter (service_role, upsert idempotente) ───────────┐
                    │ parlamentario_bio (onConflict parlamentario_id)                                  │
                    │ parlamentario_militancia (onConflict clave natural: parl_id,partido,desde)       │
                    │ comision (onConflict clave natural) · comision_membresia (onConflict natural)    │
                    │ UPDATE parlamentario.partido + fecha_captura desde Militancia_Actual             │
                    └──────────────────────────────────────────────────────────────────────────────────┘
                                                            │
                                                            ▼
                              Supabase Postgres (migración 0059, RLS deny-by-default, CERO grant anon)
                                     ►►► RPCs públicas + allowlist = Phase 91, NO aquí ◄◄◄
```

### Recommended Project Structure (espejo de `packages/lobby/src/`)
```
packages/bio/
├── package.json              # deps: @obs/ingest, @obs/identity, @obs/core, fast-xml-parser, cheerio, @supabase/supabase-js, zod
├── tsconfig.json             # usa "references" (NO "paths" — gotcha Phase 43 rompe tsc -b)
└── src/
    ├── index.ts              # exports
    ├── model.ts              # BioParlamentario, Militancia, Comision, ComisionMembresia (SIN campos PII)
    ├── parse-diputados.ts    # XMLParser retornarDiputadosPeriodoActual → modelo (ALLOWLIST aquí)
    ├── parse-diputados.test.ts        # fixture con PII sintético → asserts NO-PII (test que muerde)
    ├── parse-bcn-senadores.ts         # SPARQL-json → Militancia (ALLOWLIST); fallback en parse-senado-ficha.ts
    ├── parse-senado-ficha.ts          # cheerio ficha senado.cl (fallback)
    ├── parse-comisiones.ts            # fuente de Open Q1 (cheerio/xml) → Comision + membresía
    ├── run-bio.ts            # runner dos-etapas (fetch→R2 putImmutable→parse→matchDeterminista→write); --from-r2 replay
    ├── run-bio.test.ts
    ├── writer.ts             # interfaz BioWriter + InMemoryBioWriter (dry-run/tests)
    ├── writer-supabase.ts    # SupabaseBioWriter (service_role, onConflict clave natural)
    ├── writer.test.ts
    ├── run-bio-cli.ts        # entry-point operador/agente (espejo run-camara-lobby-cli.ts)
    └── __fixtures__/         # XML/SPARQL/HTML crudos recortados para tests
```

### Pattern 1: Dos-etapas con `R2Store.putImmutable` + short-circuit "sin novedades"
**What:** Fetch → persistir crudo content-addressed en R2 (Etapa 1) → si `existed` (412/idempotente) salir temprano → parse+write (Etapa 2). `--from-r2` reconstruye desde el crudo sin tocar la fuente.
**When to use:** Todo runner de `@obs/bio`.
**Example (LOCKED, extraído de run-camara-lobby.ts:87-110):**
```typescript
// Source: packages/lobby/src/run-camara-lobby.ts (VERIFIED repo)
let r2Path: string | null = null;
if (opts.r2Store) {
  const bytes = new TextEncoder().encode(xml);
  const sha = await sha256Hex(bytes);
  const { r2Path: newPath, existed } = await opts.r2Store.putImmutable(
    "bio", "diputados-periodo-actual", date, sha, "xml", bytes,
  );
  r2Path = newPath;
  if (existed) { log("[skip] sin novedades — bio diputados"); return { ...ceros, r2Path }; }
}
```

### Pattern 2: Allowlist EN EL PARSER (defensa por construcción, no filtro tardío)
**What:** El parser lee SOLO los campos permitidos del XML/SPARQL y emite un modelo tipado que NO CONTIENE las claves PII. Un campo excluido nunca existe en el objeto que ve el writer.
**When to use:** parse-diputados.ts, parse-bcn-senadores.ts, parse-comisiones.ts.
**Example:**
```typescript
// El modelo tipado NO declara fechaNacimiento/rut/sexo → imposible persistirlos.
interface BioMilitancia { partido: string; partidoAlias: string; desde: string; hasta: string | null; esActual: boolean; }
// parse: se leen SOLO <Partido>/<FechaInicio>/<FechaTermino>; <FechaNacimiento>/<RUT>/<Sexo> se ignoran explícitamente.
```
**Test que muerde (LOCKED por CONTEXT + Specific Ideas):** fixture XML con `<RUT>12345678-9</RUT>` + `<FechaNacimiento>1975-...` sintéticos → `expect(JSON.stringify(parsed)).not.toContain("12345678")` y `not.toContain("FechaNacimiento")`.

### Pattern 3: Match determinista fail-closed por DIPID (diputados) / nombre-o-parlid (senadores)
**What:** El FK a `parlamentario` se mintea SOLO por `id_diputado_camara === DIPID` (diputados) o `parlid_senado`/`matchDeterminista` por nombre único en (cámara,periodo) (senadores). Sin match único → SKIP + reporte, NUNCA fabrica.
**Example (LOCKED, deterministic.ts):** ver `matchDeterminista` — cada rama confirma solo con `=== 1`; homónimo/sin-candidato → `no_confirmado`.

### Pattern 4: Tabla con provenance inline + RLS deny-by-default + revoke anon (plantilla 0021)
**What:** Cada tabla nueva lleva `origen`/`fecha_captura`/`enlace` NOT NULL, `enable row level security` SIN policies, y `revoke all … from anon, authenticated` (defensa en profundidad contra los default privileges de Supabase).
**Anti-Pattern:** `grant … to anon` en migración >0044 → lo bloquea el lockdown-guard Block A.

### Anti-Patterns to Avoid
- **Usar `getDiputados` (opendata.congreso.cl):** militancias vacías, históricos, sin distrito. Probado. Usar `retornarDiputadosPeriodoActual`.
- **Filtrar PII en la UI o en el writer:** el dato ya almacenado ES el riesgo 21.719. Allowlist EN EL PARSER.
- **Name-match de diputados a la maestra:** hay DIPID exacto. Name-match solo para senadores como último recurso, fail-closed.
- **`paths` en tsconfig del package nuevo:** rompe `tsc -b` (gotcha Phase 43). Usar `references`.
- **Inventar membresía de comisiones si la fuente no trae integrantes:** degradar a catálogo sin membresía, estado honesto.
- **Asumir "partido actual" = primera `<Militancia>`:** elegir la de `FechaTermino` abierta/más futura (fail-loud si ambiguo).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fetch con rate-limit + UA + robots | Loop de fetch a mano | `@obs/ingest` `Fetcher`+`HostRateLimiter`+`RobotsGuard` | UA identificatorio y 2-3s/host ya LOCKED y testeados |
| Crudo content-addressed en R2 | PUT S3 manual | `R2Store.putImmutable` (If-None-Match:*, sha256) | Idempotencia 412 + short-circuit "sin novedades" ya resuelto |
| Match de identidad | Comparar nombres a mano | `matchDeterminista` de `@obs/identity` | Fail-closed por construcción, único escritor de FK, riesgo existencial #1 |
| Cliente SPARQL RDF | Librería RDF pesada | `fetch` + `JSON.parse` (`application/sparql-results+json`) | BCN devuelve JSON de resultados; cero dep nueva (STACK.md §3) |
| Parsing XML | Regex sobre XML | `fast-xml-parser` | Ya en repo; maneja namespaces/atributos |
| Upsert idempotente | INSERT + catch dup | `.upsert(lote, { onConflict })` por clave natural | Patrón writer-supabase LOCKED; re-correr no duplica |
| Validar RUT (si alguna vez llega) | Módulo-11 a mano | `isRutValido` de `@obs/identity` | Ya implementado; pero RUT es PII → NO se persiste igual |

**Key insight:** `@obs/bio` es casi enteramente ENSAMBLAJE de piezas LOCKED. El código net-new real es: 3 parsers con allowlist, el mapeo Militancia→modelo, la migración 0059, y el spike de fuente de comisiones. Todo lo demás se copia de `@obs/lobby`/`@obs/votos`.

## Common Pitfalls

### Pitfall 1: Endpoint de diputados equivocado (getDiputados vacío)
**What goes wrong:** Seguir la CONTEXT literal (`getDiputados` en opendata.congreso.cl) → militancias vacías, 632 históricos, ficha sin partido.
**Why it happens:** La CONTEXT lo especificó; el nombre suena correcto.
**How to avoid:** Usar `retornarDiputadosPeriodoActual` (opendata.camara.cl) — probado, 155 vigentes, militancias pobladas, DIPID = maestra.
**Warning signs:** `<Militancias_Periodos />` vacío; count > 155; DIPID como 208/485 (ex-diputados).

### Pitfall 2: PII de la bio almacenada (violación 21.719)
**What goes wrong:** `retornarDiputadosPeriodoActual` trae `FechaNacimiento`/`RUT`/`RUTDV`/`Sexo`. Si el schema del modelo los declara, se persisten → exposición 21.719 incluso antes de mostrarse.
**How to avoid:** Allowlist EN EL PARSER; el modelo tipado NO declara esos campos; test-que-muerde con fixture PII sintético.
**Warning signs:** El modelo/tabla tiene `fecha_nacimiento`/`rut`/`sexo`; "lo filtramos en la UI".

### Pitfall 3: Aseverar partido actual desde militancia stale; confundir comité (Senado) con partido
**What goes wrong:** Elegir la primera `<Militancia>` como actual (puede ser histórica); mostrar comité de senador como partido.
**How to avoid:** "Actual" = `<Militancia>` con `FechaTermino` abierta o más futura; adjuntar SIEMPRE fecha_captura+fuente ("según fuente al [fecha]"); `partido` y `comité` como campos distintos. (Pitfall 8 de PITFALLS.md v9.0.)
**Warning signs:** Partido sin fecha; comité renderizado como "Partido".

### Pitfall 4: Loosening del fail-closed al cablear bio/comisiones
**What goes wrong:** Tentación de name-match para "enlazar más" bio/comisiones a la maestra.
**How to avoid:** Diputados por DIPID exacto SIEMPRE; senadores por parlid o nombre único fail-closed; sin match → dato sin enlazar + reporte, NUNCA crea parlamentario. (Pitfall 11 de PITFALLS.md v9.0.)
**Warning signs:** `.rpc`/join que resuelve persona por string; cobertura de enlaces sube sin nuevas identidades confirmadas.

### Pitfall 5: WAF de www.camara.cl bloquea fetch de Node
**What goes wrong:** El portal `www.camara.cl` (comisiones/citaciones_semana) bloquea undici con 403; `opendata.camara.cl` NO (probado 200).
**How to avoid:** Para fuentes de `www.camara.cl` (Open Q1 comisiones): curl-first + `--xml-file`/`--html-file`. Para `opendata.camara.cl` (diputados) y `datos.bcn.cl`: fetch directo OK.
**Warning signs:** 403 desde Node pero 200 desde curl.

### Pitfall 6: Migración aplicada solo verificada por build/typecheck (falso positivo)
**What goes wrong:** build/typecheck no prueban que Postgres ejecutó el DDL.
**How to avoid:** pgTAP (`0059_*.test.sql`) contra schema APLICADO; aplicar por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f` (NUNCA `db push`); BOM esquivado. (Convención LOCKED 0021.)

## Code Examples

### Leer el valor de flag + loadEnv BOM-safe (CLI)
```typescript
// Source: packages/lobby/src/run-camara-lobby-cli.ts (VERIFIED repo) — copiar verbatim para run-bio-cli.ts
function flagValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : null;
}
// loadEnv: lee .env quitando BOM (U+FEFF), process.env tiene precedencia (CI). findWorkspaceRoot sube a pnpm-workspace.yaml.
```

### SPARQL BCN por fetch (senadores — spike de vocabulario primero)
```typescript
// Source: STACK.md §3 (VERIFIED live: 200 OK, JSON válido)
const q = `PREFIX bio:<http://datos.bcn.cl/ontologies/bcn-biographies#> SELECT ?pred ?obj WHERE { ?m a bio:Militancy ; ?pred ?obj } LIMIT 20`;
const url = `https://datos.bcn.cl/sparql?` + new URLSearchParams({ query: q });
const res = await fetch(url, { headers: { Accept: "application/sparql-results+json",
  "User-Agent": "ObservatorioCongreso360/1.0 (contacto: sanchez.rossi@gmail.com)" } });
const json = await res.json(); // { results: { bindings: [...] } } → mapear a Militancia
```

### Writer upsert idempotente por clave natural
```typescript
// Source: packages/lobby/src/writer-supabase.ts (VERIFIED repo)
const { error } = await this.client.from("parlamentario_militancia")
  .upsert(lote, { onConflict: "parlamentario_id,partido_alias,desde", ignoreDuplicates: false });
if (error) throw new Error(`upsert parlamentario_militancia falló: ${error.message}`); // nunca interpola service key
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CONTEXT: `getDiputados` (opendata.congreso.cl) para militancia | `retornarDiputadosPeriodoActual` (opendata.camara.cl) | Verdict de este research (2026-07-22) | Es EL cambio que el plan debe adoptar; getDiputados no sirve |
| WSComisiones opendata para membresía | Fuente re-derivada (citaciones_semana / senado.cl) | opendata en mantención HOY | Open Question 1 bloqueante del plan de comisiones |

**Deprecated/outdated:**
- `getDiputados` para militancia vigente: militancias vacías → inservible.
- WSComisiones.asmx (ambos hosts opendata): 302 mantención → no confiable.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | La `<Militancia>` con `FechaTermino` abierta/más futura es la "actual" | Verdict 1 / Pitfall 3 | Si el XML no marca claramente la actual, el "partido actual" podría ser stale → fail-loud y no actualizar `parlamentario.partido` ante ambigüedad |
| A2 | El vocabulario de predicados de BCN `Militancy` (party/fechas) es descubrible con 1-2 queries `?pred ?obj` en ejecución | Verdict 2 | Si el vocabulario es intratable, degradar a ficha senado.cl (fallback LOCKED) |
| A3 | El join BCN `persona/{id}` → maestra se hace por NOMBRE determinista (BCN no expone parlid_senado) | Verdict 2 | Homónimo entre 31 senadores → fail-closed skip; cobertura parcial honesta |
| A4 | Alguna de `citaciones_semana.aspx` / `senado.cl` comisiones trae INTEGRANTES con id/nombre | Verdict 3 / Open Q1 | Si ninguna: BIO-05 degrada a catálogo de comisiones sin membresía (modelado igual, `comision_membresia` vacía, estado honesto) |
| A5 | Distrito/Región/Circunscripción de diputados NO salen de opendata Cámara (no están en el XML probado) | Open Q2 | Si se requieren para 91, sacarlos de otra fuente (BCN / ficha) o dejar NULL con estado honesto; la maestra ya tiene columnas nullable |

## Open Questions

1. **Fuente de membresía de comisiones (BIO-05) — BLOQUEANTE del sub-plan de comisiones.**
   - Qué sabemos: WSComisiones opendata (ambos hosts) en mantención (302); WSDiputado no trae comisiones.
   - Qué falta: probar con curl-first al inicio del plan: (a) `https://www.camara.cl/legislacion/comisiones/citaciones_semana.aspx?prmSemana=AAAA-NN` (HTML, WAF→curl) — trae comisiones y sesiones pero ¿trae integrantes?; (b) páginas de comisiones de `senado.cl` / PHP `?mo=comisiones&ac=listado` (cheerio) — ¿trae miembros con id?
   - Recomendación: primer sub-plan = curl-spike de ambas; elegir la que traiga integrantes con id/nombre. Si ninguna, degradar a catálogo sin membresía (nunca inventar). Reintentar WSComisiones opendata más adelante (puede volver de mantención).

2. **Distrito/Región/Circunscripción de diputados.**
   - Qué sabemos: `retornarDiputadosPeriodoActual` NO los trae; la maestra los tiene nullable (hoy null para casi todos).
   - Recomendación: para 90, poblar lo que la fuente da (nombre, militancia, cámara). Distrito/región = Open para 91 (posible BCN o ficha camara.cl del diputado); dejar NULL con estado honesto si no hay fuente máquina-legible en 90. NO bloquea el gate de header de 91 (partido+militancia+comisiones sí lo desbloquean).

3. **Profesión.**
   - Qué sabemos: ninguna fuente probada la trae estructurada. `parlamentario_bio.profesion` puede quedar NULL en 90.
   - Recomendación: modelar la columna; poblar si BCN/ficha la exponen en el spike; NULL honesto si no. No bloquea el gate.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `opendata.camara.cl` WSDiputado | Diputados militancia | ✓ 200 (curl y probablemente fetch) | — | ninguno necesario (no hay WAF aquí) |
| `datos.bcn.cl/sparql` | Senadores militancia | ✓ 200 JSON | — | ficha senado.cl (cheerio) |
| `www.camara.cl` citaciones_semana | Comisiones (Open Q1) | ⚠️ WAF (curl-first) | — | senado.cl comisiones |
| `opendata.*` WSComisiones | Comisiones | ✗ 302 mantención | — | citaciones_semana / senado.cl |
| Supabase (`SUPABASE_API_URL`/`SECRET_KEY`) | Etapa 2 write | ✓ (en .env) | PG15+pgvector0.8 | — |
| R2 (`R2_*`) | Etapa 1 crudo | ✓ (en .env, token R&W) | S3 API | dry-run sin R2 (best-effort) |

**Missing dependencies with no fallback:** ninguna bloqueante para diputados.
**Missing dependencies with fallback:** WSComisiones (→ citaciones_semana/senado.cl); BCN vocabulario (→ ficha senado.cl).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (monorepo; cada package con `vitest.config` propio — gotcha Phase 43: sin config propio, 0 tests corren) |
| Config file | `packages/bio/vitest.config.ts` — **Wave 0 (crear)** |
| Quick run command | `pnpm --filter @obs/bio test` |
| Full suite command | `pnpm test` (raíz) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BIO-01 | Parser diputados dropea PII (RUT/FechaNacimiento/Sexo) | unit (test-que-muerde) | `pnpm --filter @obs/bio test parse-diputados` | ❌ Wave 0 |
| BIO-01 | Parser mapea Militancia→{partido,desde,hasta,esActual}; "actual" correcta | unit | `pnpm --filter @obs/bio test parse-diputados` | ❌ Wave 0 |
| BIO-01 | Match DIPID exacto; sin match → skip (fail-closed, no fabrica FK) | unit | `pnpm --filter @obs/bio test run-bio` | ❌ Wave 0 |
| BIO-01 | Dos-etapas: `--from-r2` reconstruye sin fetch; putImmutable short-circuit | unit | `pnpm --filter @obs/bio test run-bio` | ❌ Wave 0 |
| BIO-01 | Writer upsert idempotente (2× run = conteos idénticos); actualiza parlamentario.partido | unit | `pnpm --filter @obs/bio test writer` | ❌ Wave 0 |
| BIO-05 | Modelo comisión + membresía; membresía solo por identidad confirmada | unit | `pnpm --filter @obs/bio test parse-comisiones` | ❌ Wave 0 |
| BIO-01/05 | Migración 0059: tablas existen, RLS habilitada SIN policies, cero grant anon | pgTAP | `psql "$SUPABASE_DB_URL" -f supabase/tests/0059_*.test.sql` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/bio test`
- **Per wave merge:** `pnpm test` (raíz) + typecheck (`tsc -b`)
- **Phase gate:** suite verde + pgTAP 0059 contra schema aplicado antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/bio/vitest.config.ts` — sin él 0 tests corren (gotcha Phase 43 DEBT)
- [ ] `packages/bio/package.json` + registro en `pnpm-workspace.yaml` + `references` en tsconfig del monorepo
- [ ] `packages/bio/src/__fixtures__/` — XML diputados recortado (con PII sintético), SPARQL-json, HTML comisiones
- [ ] `supabase/tests/0059_bio_comisiones.test.sql` — pgTAP (espejo 0021_lobby.test.sql)

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Ingesta server-side, sin auth de usuario en esta fase |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | RLS deny-by-default en las 4 tablas nuevas; `revoke all from anon,authenticated`; RPCs públicas NACEN en 91 (no aquí) |
| V5 Input Validation | **yes** | `zod` sobre el XML de fuente (contrato); `fast-xml-parser` sin eval; SPARQL construido con `URLSearchParams` (no inyección de query) |
| V6 Cryptography | no | sha256 vía `@obs/ingest` (content-addressing, no secreto) |
| V8 Data Protection (privacy) | **yes** (rector) | Allowlist EN EL PARSER = minimización 21.719; PII (RUT/FechaNacimiento/terceros) SOLO en R2 crudo, jamás en tablas servidas |

### Known Threat Patterns for {ingesta gubernamental TS/Deno + Supabase service_role}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PII (RUT/nacimiento/terceros) republicada desde "fuente pública" | Information Disclosure | Allowlist en parser; el modelo tipado no declara PII; test-que-muerde; 21.719 aplica aunque la fuente sea pública |
| FK de identidad fabricado por name-match | Spoofing (falsa atribución) | `matchDeterminista` fail-closed; DIPID exacto diputados; skip ante ambigüedad |
| service_role bypassa RLS → tabla nueva expuesta si se hace grant | Elevation of Privilege | Deny-by-default + `revoke all from anon`; lockdown-guard Block A prohíbe `grant … to anon` >0044 |
| Partido stale aseverado como actual (defamation-adjacent) | Tampering (dato falso creíble) | fecha_captura+fuente+enlace; "según fuente al [fecha]"; ambigüedad → fail-loud, no actualizar |
| service key en mensaje de error | Information Disclosure | Solo `error.message` de PostgREST (no contiene la key) — patrón writer LOCKED |
| SPARQL/XML injection | Tampering | `URLSearchParams` para SPARQL; parser XML sin resolución de entidades externas |

**Nota:** Las RPCs públicas de lectura y la extensión del `PUBLIC_RPC_ALLOWLIST`/linter son de Phase 91 — esta fase NO añade superficie pública nueva (V4 se satisface con deny-by-default puro).

## Sources

### Primary (HIGH confidence — probado EN VIVO 2026-07-22)
- `opendata.camara.cl/.../WSDiputado.asmx/retornarDiputadosPeriodoActual` — 200, 155 dip, militancias pobladas, DIPID=maestra, PII presente — HIGH (live curl)
- `opendata.congreso.cl/wscamaradiputados.asmx/getDiputados` — 200 pero 632 históricos, militancias vacías — HIGH (rechazado, live)
- `datos.bcn.cl/sparql` — 200 JSON, ontología biographies completa (Militancy/PositionPeriod/PoliticalParty) — HIGH endpoint / MEDIUM vocabulario
- `opendata.{camara,congreso}.cl/.../WSComisiones.asmx` — 302 /mantencion.html — HIGH (no disponible, live)
- `packages/lobby/src/*` (run-camara-lobby-cli, run-camara-lobby, writer-supabase) — plantillas LOCKED — HIGH (repo)
- `supabase/migrations/0005_parlamentario.sql`, `0021_lobby.sql` — schema maestra + plantilla provenance/RLS — HIGH (repo)
- `packages/identity/src/deterministic.ts` — matchDeterminista fail-closed — HIGH (repo)
- `supabase/seeds/parlamentario.seed.json` — DIPID/parlid formats, 155 dip + 31 sen — HIGH (repo)

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` §3 (bio) + §4 (comisiones) — endpoints BCN/Cámara/Senado, SPARQL por fetch — MEDIUM/HIGH
- `.planning/research/PITFALLS.md` — Pitfalls 7 (PII), 8 (partido stale/comité), 11 (fail-closed) — HIGH (project ground truth)

### Tertiary (LOW confidence — validar en plan)
- Fuente exacta de membresía de comisiones (citaciones_semana / senado.cl) — Open Question 1, sin probar aún
- Vocabulario de predicados BCN Militancy — requiere spike de ejecución

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — cero deps nuevas, todo preexistente y en uso
- Diputados (endpoint/parser/identidad): HIGH — probado live, DIPID=maestra
- Senadores (BCN): MEDIUM — endpoint estable, vocabulario+join pendiente de spike
- Comisiones: MEDIUM-BAJO — fuente opendata caída, re-derivación abierta (Open Q1)
- Modelo/migración: HIGH — plantilla 0021 directa
- Allowlist/seguridad: HIGH — patrón parser + deny-by-default LOCKED

**Research date:** 2026-07-22
**Valid until:** 2026-08-05 (endpoints gubernamentales pueden cambiar de estado — WSComisiones puede volver de mantención; re-verificar antes de ejecutar)
