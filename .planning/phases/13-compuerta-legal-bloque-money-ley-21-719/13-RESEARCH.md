# Phase 13: Compuerta Legal — Bloque MONEY (Ley 21.719) - Research

**Researched:** 2026-06-19
**Domain:** Marco legal de protección de datos (Ley 21.719) + patrón técnico de gate de exposición (RLS deny-by-default + feature flag server-side)
**Confidence:** MEDIUM-HIGH (técnico HIGH; legal MEDIUM — reglamento aún pendiente)

## Summary

Esta es una fase de **proceso y documentación**, no de construcción pesada. Entrega dos cosas: (1) un **dossier legal de preparación** (Markdown) que estructura la superficie de riesgo de los datos MONEY (financiamiento SERVEL + contratos ChileCompra) para que un abogado externo la revise y firme; y (2) un **mecanismo de gate de exposición** (doble candado: RLS deny-by-default para tablas MONEY futuras + flag server-side `MONEY_PUBLIC_ENABLED` default `false`) con un test de verificación. El sign-off legal humano real queda como **deuda de operador (F13)** — el dossier no es un dictamen, es el material que se lleva a la asesoría.

El dossier debe cubrir las 3 superficies de LEGAL-01: (a) republicación de datos públicos del Estado, (b) datos sensibles de afiliación política, (c) terceros privados (donantes/lobistas), más minimización y propósito. La Ley 21.719 (publicada dic-2024, fase operativa más relevante entra a fines de **2026-12-01**, régimen sancionatorio pleno dic-2027) clasifica la **afiliación política como dato sensible** y establece que ser "fuente de acceso público" **no exime** del cumplimiento. El reglamento que detallará varios artículos **sigue pendiente** — de ahí la confianza MEDIA en los detalles operativos.

**Primary recommendation:** Producir `13-LEGAL-DOSSIER.md` (con copia en `docs/legal/`) estructurado por las 3 superficies + minimización + propósito + base de licitud, con bloque YAML `signoff: pending` en el encabezado y checklist para el asesor; e implementar el gate como (1) convención RLS deny-by-default reusando VERBATIM el patrón de `0018_piso_pii.sql`/`0021`/`0022` para las tablas MONEY futuras, y (2) un módulo de flag server-side `MONEY_PUBLIC_ENABLED` (default `false`) consistente con el patrón `process.env` + `server-only` ya usado en `app/lib/supabase.ts`. Verificar con pgTAP (tabla MONEY niega `anon`) + test unitario (flag default `false`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dossier legal (documento) | Docs / repo (`docs/legal/` + fase) | — | Es Markdown versionado; no toca runtime |
| RLS deny-by-default tablas MONEY | Database / Supabase (migración SQL) | — | El gate de DATOS vive en Postgres; mismo plano que `parlamentario.rut` |
| Flag `MONEY_PUBLIC_ENABLED` | Frontend Server (Next.js, server-only) | API / RPC | Decide si la ficha pública o el RPC exponen secciones MONEY; nunca client-side |
| Verificación del gate | CI / pgTAP + Vitest | — | pgTAP prueba RLS contra schema aplicado; Vitest prueba el default del flag |
| Sign-off (registro) | Docs (YAML en dossier) + operator-debt | — | Trazable por inspección; prerrequisito duro para encender el flag |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dossier legal — contenido y forma:**
- Ubicación/formato: Markdown versionado `13-LEGAL-DOSSIER.md` en el directorio de la fase + copia en `docs/legal/`.
- Estructura del análisis: secciones por las 3 superficies de LEGAL-01 (republicación de datos públicos / datos sensibles de afiliación política / terceros privados donantes-lobistas) + sección de minimización + sección de propósito (transparencia legislativa / control ciudadano) + base de licitud.
- Destinatario/firmante: dossier preparado para asesoría legal externa; incluye checklist de sign-off con campos (nombre del asesor, fecha, alcance cubierto, observaciones).
- Atribución/licencia: documentar CC BY 4.0 y la cita de fuente por dataset MONEY (ChileCompra, SERVEL) dentro del dossier; la fase de UI hereda esta atribución.

**Mecanismo de gate de exposición:**
- Capa del gate: **doble candado** — (a) las tablas MONEY nacen deny-by-default a `anon` por RLS (mismo patrón que `parlamentario.rut`), y (b) flag server-side `MONEY_PUBLIC_ENABLED` (default `false`) que oculta secciones de ficha / RPC público de MONEY.
- Default e override: default OFF en código y en `.env.example`; encender requiere un cambio explícito de operador realizado después del sign-off.
- Qué se construye bajo el gate: ingesta + esquema DB + conector + cruce RUT interno + tests pueden construirse en 14–16; ninguna ruta pública se enciende.
- Verificación: pgTAP/test que afirma que las tablas MONEY niegan acceso a `anon`, y test que afirma que el flag `MONEY_PUBLIC_ENABLED` es `false` por defecto.

**Sign-off como prerrequisito verificable:**
- Registro: bloque YAML en el encabezado del dossier (`signoff: pending`, fecha, alcance) + marca en la deuda de operador (memoria F13).
- Consumo por el gate: encender `MONEY_PUBLIC_ENABLED` queda documentado como dependiente de `signoff: approved`; verificable por inspección del dossier.
- Trazabilidad: el dossier enlaza a la deuda F13 y al success criterion 3 del ROADMAP (sign-off como prerrequisito duro).
- Alcance: este sign-off cubre **solo MONEY**; el framing del grafo (NET) es LEGAL-02 / Phase 17, fuera de alcance.

### Claude's Discretion
- Redacción exacta del análisis legal dentro de cada superficie (al nivel de un dossier de preparación, no de un dictamen — el dictamen lo emite la asesoría externa).
- Nombre exacto y ubicación del módulo del flag server-side, consistente con los patrones de `packages/`.

### Deferred Ideas (OUT OF SCOPE)
- Sign-off del framing del grafo (NET) — LEGAL-02, Phase 17.
- Encendido real de `MONEY_PUBLIC_ENABLED` tras sign-off — acción de operador, fuera de esta corrida autónoma.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LEGAL-01 | Compuerta legal del bloque MONEY: aprobación legal explícita antes de exponer públicamente cualquier dato de dinero, cubriendo republicación de datos públicos, datos sensibles (afiliación política) y terceros privados (donantes/lobistas). | Marco Ley 21.719 (§Domain Legal); licencias ChileCompra/SERVEL (§Republicación); patrón gate (§Architecture Patterns); sign-off verificable (§Sign-off mechanism). El dossier estructura la superficie; el gate la deja apagada hasta el sign-off. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Legal:** pasada de asesoría legal antes del lanzamiento público; atribución **CC BY 4.0 visible**. (CLAUDE.md `Constraints` + PROJECT.md L88.)
- **Minimización + trazabilidad estricta:** solo se muestra lo que la fuente pública ya publica (con fuente/fecha/enlace); **RUT y datos de familiares quedan internos** para reconciliar identidad, nunca expuestos. (PROJECT.md L21, L63.)
- **Regla rectora:** nunca afirmar intención ni causalidad; solo "qué pasó, cuándo y según qué fuente". (PROJECT.md Core Value.) Evitar la "máquina de sospechas" (Riesgo existencial #2).
- **Secrets:** toda key/flag de configuración vía `.env` (`.env.example` documenta el contrato). El flag MONEY entra acá.
- **Stack:** TS/Deno full backend; Next.js 16 App Router, Server Components por defecto, **todas las llamadas externas y lecturas sensibles server-only** (nunca client). Supabase Postgres + RLS.
- **GSD enforcement:** los cambios pasan por un comando GSD; esta fase es planificada (no `/quick`).
- ⚠️ **AGENTS.md de `app/`:** "This is NOT the Next.js you know" — antes de tocar código Next.js, leer `node_modules/next/dist/docs/`. El flag server-side debe seguir las convenciones del Next.js instalado, no las de memoria.

## Standard Stack

Esta fase **no instala paquetes nuevos**. Reusa lo ya presente en el monorepo. La tabla documenta lo que se toca.

### Core
| Herramienta | Versión (en repo) | Propósito en esta fase | Por qué |
|-------------|-------------------|------------------------|---------|
| Supabase Postgres + RLS | Postgres 15+ (nube sa-east-1, ref `bctyygbmqcvizyplktuw`) | Candado (a): tablas MONEY deny-by-default | Mismo plano que `parlamentario.rut`; patrón ya probado en 0018/0021/0022 |
| pgTAP (`supabase test db`) | ya en uso (`supabase/tests/*.test.sql`) | Verificar que tabla MONEY niega `anon` | Única prueba válida contra schema aplicado (build/typecheck dan falso positivo) |
| Next.js 16 (App Router) + `server-only` | 16.x | Candado (b): leer `MONEY_PUBLIC_ENABLED` server-side | Server Components por defecto; el flag nunca llega al browser |
| Vitest | ya en uso (`packages/*/vitest.config.ts`) | Test: flag default `false` | Lógica pura, testeable con `env` explícito (espejo de `loadRouterConfigFromEnv`) |
| Markdown versionado | — | El dossier + copia en `docs/legal/` | Locked decision |

### Supporting
| Herramienta | Versión | Propósito | Cuándo |
|-------------|---------|-----------|--------|
| YAML frontmatter | — | Bloque `signoff:` en encabezado del dossier | Registro verificable por inspección |
| `.env.example` | — | Documentar `MONEY_PUBLIC_ENABLED=false` | Contrato de configuración |

### Alternatives Considered
| En vez de | Se podría usar | Tradeoff |
|-----------|----------------|----------|
| Flag por `process.env` (string `'true'`/ausente) | Flag en `app.settings.*` de Postgres / vault | El de Postgres sirve si la decisión vive en SQL (RPC). Para ocultar **secciones de ficha** (server component), `process.env` es el patrón directo ya usado en `app/lib/supabase.ts`. Documentar AMBOS canales si el RPC también consulta el flag. |
| Doble candado (RLS + flag) | Solo flag, o solo RLS | Locked: doble candado. RLS protege el dato aunque el flag se encienda por error; el flag protege la presentación aunque la RLS se relaje por error. Defensa en profundidad. |
| Markdown + YAML | Issue/PR como registro de sign-off | Locked: YAML en el dossier (trazable, versionado, autocontenido). |

**Installation:** Ninguna. (Sin paquetes nuevos → sección Package Legitimacy Audit omitida con justificación abajo.)

## Package Legitimacy Audit

**N/A — esta fase no instala paquetes externos.** Reusa Supabase/pgTAP/Next.js/Vitest ya presentes en el repo (v1.0 shipped). slopcheck no aplica. Si el planner decidiera (innecesariamente) añadir una lib de feature-flags, debe gatearla con `checkpoint:human-verify` — pero la recomendación firme es **no añadir nada**: el flag es una lectura de `process.env`.

## Architecture Patterns

### System Architecture Diagram

```
                    PREPARACIÓN (esta fase)                     CONSTRUCCIÓN GATEADA (Phases 14-16)
                    ───────────────────────                     ───────────────────────────────────

  Operador ──lleva──> 13-LEGAL-DOSSIER.md ──copia──> docs/legal/
                            │
                            │ encabezado YAML: signoff: pending
                            │ (alcance: MONEY)
                            ▼
                    Asesoría legal externa  ──(deuda F13, fuera de esta corrida)──> signoff: approved
                            │
                            │  (prerrequisito DURO; ROADMAP success criterion 3)
                            ▼
              ┌─────────────────────────────────────────────────────────────────────┐
              │  GATE DE EXPOSICIÓN (doble candado)                                   │
              │                                                                       │
              │  Candado (a) DATOS:   tablas MONEY ──RLS deny-by-default──> anon ✗    │
              │     (migración SQL, mismo patrón 0018/0021/0022)            (niega)   │
              │                                                                       │
              │  Candado (b) PRESENTACIÓN:  MONEY_PUBLIC_ENABLED (default false)      │
              │     ┌──────────────┐   server-only    ┌──────────────────────┐       │
              │     │ Ficha pública│ ──lee env flag──> │ if(!enabled) ocultar │       │
              │     │ /parlamentario│                  │ sección MONEY        │       │
              │     └──────────────┘                   └──────────────────────┘       │
              └─────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
       Verificación:  pgTAP (tabla MONEY niega anon)  +  Vitest (flag default == false)

  Flujo de DATOS: fuente pública (ChileCompra/SERVEL) ──ingesta server-side──> tabla MONEY (RLS off a anon)
                  ──RPC security definer (cuando signoff approved && flag on)──> ficha pública (con fuente/fecha/enlace + CC BY)
```

### Recommended Project Structure
```
.planning/phases/13-.../
  13-LEGAL-DOSSIER.md        # entregable 1 (canónico, con YAML signoff)
docs/
  legal/
    13-LEGAL-DOSSIER.md      # copia (locked decision)
supabase/
  migrations/
    0023_money_gate.sql      # candado (a): tablas MONEY deny-by-default (o convención documentada para 14-16)
  tests/
    0023_money_gate.test.sql # pgTAP: tabla MONEY niega anon
packages/core/ (o app/lib/)
  money-gate.ts              # candado (b): isMoneyPublicEnabled(env) — lógica pura, server-side
  money-gate.test.ts         # Vitest: default false
.env.example                 # MONEY_PUBLIC_ENABLED=false (documentado)
```
> Discreción de Claude: ubicación exacta del módulo del flag. Recomendación: `packages/core` (compartible entre app y Edge Functions) si el RPC también lo consulta; o `app/lib/` si solo lo usa la ficha. Mantenerlo **lógica pura con `env` inyectado** (espejo de `loadRouterConfigFromEnv` en `packages/llm/src/config.ts`) para testeo sin runtime.

### Pattern 1: Convención RLS deny-by-default para PII/sensibles (REUSAR VERBATIM)
**What:** Toda tabla con datos no públicos nace con `enable row level security` + CERO policies + `revoke all ... from anon, authenticated`. RLS sin policy = Postgres niega todas las filas a roles no privilegiados; el `revoke` cierra el hueco de los *default privileges* que Supabase concede a `anon`/`authenticated`.
**When to use:** Tablas MONEY que contengan cualquier dato que no deba exponerse antes del sign-off (p.ej. cruces por RUT, montos enlazados a persona). Para los **hechos públicos** que la fuente ya publica (un contrato adjudicado, un aporte declarado) se usa el patrón *public-read explícito* — PERO durante el gate, incluso esos pueden nacer deny-by-default y abrirse recién al encender el flag/RPC.
**Example:**
```sql
-- Source: supabase/migrations/0018_piso_pii.sql (convención del proyecto) + 0022 (revoke explícito)
create table money_<algo> (
  ...campos...,
  parlamentario_id text references parlamentario(id) on delete set null,  -- solo si confirmado
  origen        text not null,            -- provenance inline (FND-08)
  fecha_captura timestamptz not null default now(),
  enlace        text not null,
  licencia      text not null default 'CC BY 4.0'  -- atribución que VIAJA con la fila
);
alter table money_<algo> enable row level security;
-- (intencionalmente NINGÚN `create policy ... to anon`; NINGÚN `grant select ... to anon`)
revoke all on money_<algo> from anon, authenticated;  -- cierra default privileges (lección Phase 11)
```

### Pattern 2: RPC público `security definer` como ÚNICO canal (cuando se abra)
**What:** Cuando el sign-off llegue y el flag se encienda, los datos públicos MONEY se exponen vía un RPC `security definer set search_path = ''`, revocado de `public` + `grant execute to anon`. El RPC corre como owner (lee la tabla deny-by-default) pero **devuelve solo los campos que la fuente publica** (sin RUT, sin terceros internos), con `origen/fecha_captura/enlace/licencia` por fila.
**When to use:** Phases 14-16, no ahora. Documentar la firma esperada en el dossier/migración para que el gate sea coherente.
**Example:** Ver `declaraciones_de_parlamentario` / `lobby_de_parlamentario` en 0022/0021 como plantilla exacta.

### Pattern 3: Flag server-side, lógica pura, `env` inyectado
**What:** Una función `isMoneyPublicEnabled(env)` que devuelve `false` salvo override explícito. No lee `process.env` global (testeable, corre en Deno/edge). Importada solo en código server-side (`import "server-only"` en el lado Next.js).
**Example:**
```typescript
// Source: espejo de packages/llm/src/config.ts:loadRouterConfigFromEnv (env inyectado)
//         y app/lib/supabase.ts (server-only, sin NEXT_PUBLIC_)
export function isMoneyPublicEnabled(
  env: Record<string, string | undefined>,
): boolean {
  // Default OFF. Solo 'true' literal lo enciende; ausente/cualquier-otro => false.
  return env.MONEY_PUBLIC_ENABLED === "true";
}
```
> En el server component de la ficha: `import "server-only"` + `if (!isMoneyPublicEnabled(process.env)) return null` para la sección MONEY. Nunca `NEXT_PUBLIC_MONEY_*` (filtraría la decisión al bundle del browser).

### Anti-Patterns to Avoid
- **Encender el flag sin `signoff: approved`:** el dossier documenta que encender `MONEY_PUBLIC_ENABLED` depende del sign-off. El test del flag (default false) + la inspección del YAML son la barrera.
- **`NEXT_PUBLIC_` en el flag:** expondría la lógica de gate al cliente. Server-only, siempre.
- **Confiar solo en el flag:** sin RLS, un bug de presentación expone el dato. Doble candado.
- **Confiar solo en RLS:** sin flag, una policy mal abierta expone la sección. Doble candado.
- **Tratar el dossier como dictamen:** NO afirma cumplimiento; estructura la superficie. El abogado dictamina.
- **Exponer RUT / terceros / familiares:** minimización por diseño; quedan internos (espejo de `declaracion_familiar`, `lobby_contraparte`).
- **Verificar RLS solo con build/typecheck:** falso positivo — no prueban que Postgres aplicó el DDL. Solo pgTAP contra schema aplicado cuenta (Pitfall documentado en 0018/0021/0022).

## Don't Hand-Roll

| Problema | No construir | Usar | Por qué |
|----------|--------------|------|---------|
| Negar `anon` a tablas sensibles | Lógica de autorización en app | Convención RLS de 0018/0021/0022 (copy-paste) | Patrón ya probado y testeado; defensa en el plano de datos |
| Cerrar default privileges de Supabase | Asumir que RLS basta | `revoke all from anon, authenticated` explícito | Supabase concede SELECT a anon por default privileges (lección Phase 11) |
| Detección/manejo de RUT en LLM | Nuevo regex/gate | `assertPiiDocumentSafeForLlm` (`packages/llm/src/data-routing.ts`) | Ya existe la compuerta fail-closed; el dossier la cita como evidencia de minimización |
| Verificar RLS | Test de integración custom | pgTAP (`supabase test db`) + plantilla de `0018_*.test.sql` | Corre contra schema aplicado; `is_empty(policies)` + `relrowsecurity` |
| Cargar flag desde env | `process.env` esparcido en componentes | Una función pura `isMoneyPublicEnabled(env)` (espejo de `config.ts`) | Un solo punto, testeable, default OFF garantizado |

**Key insight:** Cada candado de esta fase ya tiene un análogo en el repo (RLS deny-by-default = 0018/0021/0022; flag con env inyectado = `config.ts`; server-only sin `NEXT_PUBLIC_` = `app/lib/supabase.ts`; gate de minimización LLM = `data-routing.ts`). La fase es *componer patrones existentes*, no inventar.

## Runtime State Inventory

> Fase de gate/documentación con un toque de DDL. Inventario por completitud.

| Categoría | Items encontrados | Acción requerida |
|-----------|-------------------|------------------|
| Stored data | Ninguna tabla MONEY existe aún (se crean en 14-16). Esta fase a lo sumo crea la(s) tabla(s) deny-by-default vacías o documenta la convención. | DDL nuevo (migración 0023) o convención documentada; sin migración de datos |
| Live service config | `MONEY_PUBLIC_ENABLED` es config nueva — no existe en `.env`/`.env.example` todavía. | Añadir a `.env.example` (default `false`); si el RPC lo consulta, también `app.settings.money_public_enabled` / vault |
| OS-registered state | Ninguno. No hay cron/task que dependa del flag. | Ninguna — verificado: el flag solo lo leen server components/RPC |
| Secrets/env vars | `MONEY_PUBLIC_ENABLED` NO es secreto (es un booleano de feature), pero vive en el mismo canal `.env`. No reusa `service_role` ni `INGEST_WORKER_SECRET`. | Documentar en `.env.example` como flag (no secreto) |
| Build artifacts | Ninguno afectado. | Ninguna — verificado: no hay rename ni paquete tocado |

**Sign-off como estado:** el `signoff: pending` vive en el YAML del dossier (no en un datastore). Encenderlo a `approved` es acción de operador (deuda F13), fuera de esta corrida.

## Domain: Marco legal — material para el dossier

> Esto es **material para el autor del dossier y el abogado externo**, NO un dictamen. Confianza MEDIA donde el reglamento está pendiente. Verificar fechas y artículos contra el texto oficial BCN antes de firmar.

### Ley 21.719 — encuadre general
- **Norma:** Ley 21.719, "regula la protección y el tratamiento de los datos personales y crea la Agencia de Protección de Datos Personales (APDP)". `[CITED: bcn.cl/leychile/Navegar?idNorma=1209272]` — la búsqueda BCN devuelve este idNorma como la entrada oficial de la Ley 21719. La página BCN es JS-rendered (no abrió por WebFetch); **verificar el idNorma y el texto contra el sitio en vivo o vía `obtxml?opt=7&idNorma=1209272` antes de firmar** `[ASSUMED]` (idNorma exacto).
- **Publicación:** Diario Oficial, **diciembre 2024**. `[CITED: múltiples guías 2026]` `[ASSUMED: fecha exacta de publicación]` (confirmar día contra BCN).
- **Vigencia escalonada:** la fase operativa más relevante (obligaciones del responsable) entra a fines de **2026** (PROJECT.md fija **2026-12-01** como "plena vigencia"); el régimen sancionatorio pleno se cita hacia **dic-2027**. `[CITED: grc360.cl, preyproject.com]` `[ASSUMED: fechas exactas — fuentes secundarias, no oficiales]`. **MEDIUM** — confirmar el calendario contra los artículos transitorios del texto oficial.
- **Alineación:** modelada sobre el GDPR europeo (derechos ARCO+, encargado/subencargado, brecha 72h a la APDP). `[CITED: preyproject.com, confidata.cl]` **MEDIUM**.

### Superficie (b): datos sensibles — afiliación política
- La Ley **amplía** la definición de dato sensible e **incluye expresamente la afiliación política** (junto a origen étnico/racial, afiliación sindical, etc.). Los datos sensibles tienen protección reforzada y solo pueden tratarse en situaciones específicas y justificadas. `[CITED: preyproject.com, valuetech.cl]` **MEDIUM-HIGH** (consenso entre fuentes).
- **Implicancia para MONEY:** el dato de financiamiento de campaña (aporte SERVEL) puede **revelar afiliación/posición política** de un tercero donante, lo que lo acerca a la categoría sensible. El dossier debe plantear esto explícitamente como pregunta para el abogado: ¿la publicación de aportes (ya publicados por SERVEL) reactiva un tratamiento de dato sensible por el cruce/agregación? **LOW** en cuanto a respuesta — es exactamente lo que el sign-off debe resolver.

### Superficie (a): republicación de datos ya públicos del Estado
- **"Fuente de acceso público NO exime cumplimiento":** la Ley exige informar de qué fuente provienen los datos (y si son de fuente de acceso público), pero ser fuente pública no es por sí una autorización ilimitada de tratamiento. PROJECT.md L75 lo afirma como postura del proyecto. `[CITED: PROJECT.md]` + concepto general de la Ley `[CITED: wikiguias.digital.gob.cl]` **MEDIUM**.
- **Bases de licitud (Art. 12 consentimiento; Art. 13 cinco bases adicionales):** consentimiento, cumplimiento de obligación legal, ejecución de contrato, **interés legítimo** (con *test de ponderación documentado*), obligaciones económicas/financieras, y ejercicio de acciones judiciales/administrativas. `[CITED: codevsys.cl, soyio.id]` **MEDIUM**.
- **Base candidata para el Observatorio:** **interés legítimo** (transparencia legislativa / control ciudadano) sobre datos ya publicados por el Estado, **con test de ponderación documentado** que pondere el fin de interés público contra los derechos del titular. El dossier debe **redactar un borrador de ese test de ponderación** para que el abogado lo valide. **MEDIUM** (la base es plausible; la suficiencia es decisión del abogado). El "dato derivado del cruce queda protegido" (PROJECT.md L75) refuerza que el interés legítimo debe cubrir también el dato producido por el cruce, no solo el dato fuente.

### Superficie (c): terceros privados — donantes / lobistas
- Donantes (personas naturales — desde Ley 20.900/2016 **solo personas naturales** pueden aportar; se prohíben aportes de personas jurídicas) y contrapartes de lobby son **terceros privados** cuyos datos personales caen de lleno bajo la Ley. `[CITED: scielo.cl Ley 19.884, servel.cl]` **MEDIUM-HIGH**.
- **Postura del proyecto (ya implementada para lobby/probidad):** el tercero se guarda en una sub-maestra **deny-by-default** (`lobby_contraparte`, `declaracion_familiar`), NUNCA se enlaza a una persona del padrón, y el RPC público nunca lo emite. El dossier debe documentar que MONEY hereda esta postura: el donante/lobista se trata por minimización; solo se expone lo que la fuente ya publica, sin enriquecer ni inferir. `[VERIFIED: supabase/migrations/0021,0022 — leídas]`.

### Minimización y propósito
- **Minimización:** RUT y datos de familiares **internos** (reconciliación de identidad), nunca expuestos; el RUT nunca cruza a un prompt LLM (`assertNoRutInLlmInput`). `[VERIFIED: packages/llm/src/data-routing.ts — leído; PROJECT.md L63]`. El dossier cita esto como evidencia técnica de minimización por diseño.
- **Propósito:** transparencia legislativa y control ciudadano; el sistema **nunca afirma intención ni causalidad** (regla rectora). `[CITED: PROJECT.md Core Value]`. El propósito acotado refuerza el test de interés legítimo.

### Republicación de open data: licencias y atribución
| Fuente | Licencia / términos | Atribución requerida | Confianza |
|--------|--------------------|--------------------|-----------|
| **ChileCompra** (contratos / Mercado Público) | **No declara una licencia CC formal** en sus términos. Datos públicos; uso no restringido, **pero al reproducir/publicar "debe mencionar su fuente"**. `[CITED: chilecompra.cl/terminos-y-condiciones-de-uso/]` | Sí — citar a ChileCompra como fuente. NO es CC BY automático; el dossier debe NO afirmar CC BY para ChileCompra sin verificar el dataset específico. | **MEDIUM-HIGH** (términos leídos directamente) |
| **SERVEL** (aportes / financiamiento, Ley 19.884) | SERVEL **publica periódicamente** los aportes en su sitio (Sistema de Recepción de Aportes). No se encontró una declaración de licencia CC explícita en la búsqueda. `[CITED: servel.cl/campanas-electorales/financiamiento-de-campana/]` | Sí — citar SERVEL + Ley 19.884 como marco. Verificar términos del dataset puntual. | **MEDIUM** (no se ubicó página de licencia; verificar) |
| **InfoProbidad** (referencia, no MONEY) | **CC BY 4.0** (ya en uso en 0022, columna `licencia`). | Atribución CC BY 4.0 visible. | **HIGH** (ya implementado) |

> **OJO (corrección de supuesto):** CLAUDE.md/CONTEXT.md hablan de "documentar CC BY 4.0" para datasets MONEY. **ChileCompra NO declara CC BY 4.0** en sus términos públicos — exige mención de fuente, no una licencia Creative Commons. El dossier debe documentar la licencia **real por dataset** (mención de fuente para ChileCompra; verificar SERVEL) y reservar "CC BY 4.0" para donde aplique de verdad (InfoProbidad). Tratar la afirmación "CC BY 4.0 para MONEY" como `[ASSUMED]` que el dossier debe **corregir/verificar por dataset**, no copiar a ciegas.
- **Contexto Ley 20.285 (Transparencia):** la transparencia activa/pasiva del Estado hace pública la información de contratos y financiamiento, pero la Ley 20.285 regula el **acceso**, no la **republicación con tratamiento** — esa última cae bajo la Ley 21.719. El dossier debe distinguir ambos planos. `[ASSUMED]` — verificar con el abogado.

## Common Pitfalls

### Pitfall 1: Asumir CC BY 4.0 para todos los datasets MONEY
**What goes wrong:** Etiquetar contratos ChileCompra como "CC BY 4.0" cuando sus términos solo exigen mención de fuente → atribución legalmente incorrecta.
**Why:** CLAUDE.md generaliza "CC BY 4.0" desde InfoProbidad.
**How to avoid:** Documentar la licencia **por dataset** en el dossier, verificada contra los términos de cada fuente. ChileCompra = "mención de fuente"; SERVEL = verificar; InfoProbidad = CC BY 4.0.
**Warning signs:** Una columna `licencia text default 'CC BY 4.0'` en una tabla de contratos ChileCompra sin verificación.

### Pitfall 2: Verificar el gate RLS con build/typecheck
**What goes wrong:** CI verde no prueba que Postgres aplicó la migración ni que `anon` queda negado.
**Why:** build/typecheck no ejecutan DDL (falso positivo documentado en 0018/0021/0022).
**How to avoid:** pgTAP (`supabase test db`) contra schema **aplicado**; `relrowsecurity = true` + `is_empty(policies)` + ausencia de grant a anon. Aplicar la migración con `--db-url` explícito (BOM UTF-8 en `.env` rompe el CLI — extraer `SUPABASE_DB_URL` con node esquivando el BOM, como en Phases 9-12). La aplicación es **checkpoint de operador**.
**Warning signs:** "el test pasa" sin haber corrido `supabase test db` contra el remoto.

### Pitfall 3: Olvidar el `revoke` de default privileges
**What goes wrong:** RLS habilitada sin policy niega filas, pero Supabase concede SELECT a `anon` por default privileges → el privilegio existe aunque la fila se niegue; LEGAL exige que el privilegio tampoco exista.
**Why:** lección de Phase 11 — Supabase otorga privilegios a anon/authenticated sobre cada tabla nueva en `public`.
**How to avoid:** `revoke all on <tabla> from anon, authenticated;` explícito (como en 0022). pgTAP codifica la ausencia del privilegio.
**Warning signs:** Tabla MONEY con RLS pero sin `revoke`.

### Pitfall 4: Flag con `NEXT_PUBLIC_` o leído client-side
**What goes wrong:** la decisión de gate llega al bundle del browser; un usuario puede inspeccionarla o (peor) el componente se renderiza client-side y filtra datos.
**Why:** hábito de feature flags client-side.
**How to avoid:** sin prefijo `NEXT_PUBLIC_`; `import "server-only"`; leer en Server Component / RPC. Espejo de `app/lib/supabase.ts` (anon key deliberadamente sin `NEXT_PUBLIC_`).
**Warning signs:** `process.env.NEXT_PUBLIC_MONEY_*` o uso del flag en un Client Component.

### Pitfall 5: El dossier suena a dictamen
**What goes wrong:** redactar "el tratamiento es lícito porque…" → afirma cumplimiento que el autor no puede emitir.
**Why:** tentación de cerrar la pregunta.
**How to avoid:** redactar en modo *preparación*: "la base candidata es interés legítimo; el test de ponderación borrador es X; **pendiente de validación legal**". El dossier estructura, no concluye.
**Warning signs:** ausencia de "pendiente de revisión legal" / "a confirmar por el asesor" en las secciones de base de licitud.

## Code Examples

### pgTAP: tabla MONEY niega anon (plantilla)
```sql
-- Source: supabase/tests/0018_piso_pii.test.sql (plantilla del proyecto)
begin;
select plan(3);
select is(
  (select count(*)::int from pg_class
     where relname = 'money_<tabla>' and relrowsecurity = true),
  1, 'RLS enabled en money_<tabla>');
select is_empty(
  $$ select polname from pg_policy p join pg_class c on c.oid = p.polrelid
     where c.relname = 'money_<tabla>' $$,
  'ninguna policy en money_<tabla> (deny-by-default)');
-- privilegio de tabla revocado a anon (default privileges cerrados):
select is_empty(
  $$ select privilege_type from information_schema.role_table_grants
     where table_name = 'money_<tabla>' and grantee = 'anon' $$,
  'anon sin privilegios de tabla en money_<tabla>');
select * from finish();
rollback;
```

### Vitest: flag default false
```typescript
// Source: espejo de packages/llm/src/config.test.ts (env inyectado)
import { isMoneyPublicEnabled } from "./money-gate";
test("MONEY default OFF cuando la var no está", () => {
  expect(isMoneyPublicEnabled({})).toBe(false);
});
test("solo 'true' literal lo enciende", () => {
  expect(isMoneyPublicEnabled({ MONEY_PUBLIC_ENABLED: "false" })).toBe(false);
  expect(isMoneyPublicEnabled({ MONEY_PUBLIC_ENABLED: "1" })).toBe(false);
  expect(isMoneyPublicEnabled({ MONEY_PUBLIC_ENABLED: "true" })).toBe(true);
});
```

### YAML de sign-off (encabezado del dossier)
```markdown
---
documento: 13-LEGAL-DOSSIER
alcance: MONEY (financiamiento SERVEL + contratos ChileCompra)
signoff: pending          # pending | approved | rejected
asesor: ""                # nombre del asesor legal externo
fecha_signoff: ""         # ISO 8601 al firmar
observaciones: ""
depende_de: "deuda operador F13; ROADMAP success criterion 3"
nota: "Encender MONEY_PUBLIC_ENABLED requiere signoff: approved."
---
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Datos personales en Chile bajo Ley 19.628 (1999) | Ley 21.719 (GDPR-like, APDP, sanciones, dato sensible ampliado) | Publicada dic-2024; operativa fines 2026 | El proyecto debe tratar datos públicos del Estado bajo el nuevo régimen; "fuente pública" no exime |
| Feature flags client-side | Flag server-only (Next.js 16 Server Components) | Next.js App Router | El gate de presentación vive en el servidor; nunca en el bundle |

**Deprecated/outdated:**
- Asumir Ley 19.628 como marco vigente para el lanzamiento — el lanzamiento público cae bajo 21.719.
- Afirmar "CC BY 4.0" como licencia universal de open data chileno — varía por organismo (ChileCompra = mención de fuente).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | idNorma de Ley 21.719 es **1209272** | Domain Legal | Cita BCN incorrecta en el dossier; verificar contra BCN/`obtxml` antes de firmar |
| A2 | Publicación dic-2024; plena vigencia operativa 2026-12-01; sanciones dic-2027 | Domain Legal | Calendario de cumplimiento mal fechado; verificar artículos transitorios del texto oficial |
| A3 | Afiliación política = dato sensible bajo 21.719 | Superficie (b) | Si no, la superficie de aportes se evalúa distinto; consenso de fuentes alto pero confirmar texto |
| A4 | Interés legítimo (con test de ponderación) es base de licitud viable para republicar datos públicos del Estado | Superficie (a) | Base insuficiente → el sign-off lo rechaza; es exactamente la pregunta para el abogado |
| A5 | "CC BY 4.0 para MONEY" del CONTEXT es impreciso: ChileCompra exige mención de fuente, no CC BY | Republicación / Pitfall 1 | Atribución legalmente incorrecta si se copia a ciegas; el dossier debe corregir por dataset |
| A6 | SERVEL no declara licencia CC explícita; publica aportes periódicamente | Republicación | Términos de reuso de SERVEL sin confirmar; verificar dataset puntual |
| A7 | Reglamento de la Ley 21.719 sigue pendiente (detalles operativos no cerrados) | Domain Legal | Si ya se publicó, algunos detalles cambian; verificar estado del reglamento al redactar |
| A8 | Ley 20.285 (transparencia) regula acceso, no republicación con tratamiento | Republicación | Distinción jurídica a validar con el abogado |

**El reglamento de la Ley 21.719 aún no está plenamente publicado al momento de esta investigación → toda afirmación operativa de detalle es MEDIUM/LOW y debe validarla la asesoría legal. El dossier NO es un dictamen.**

## Open Questions

1. **¿Interés legítimo basta para republicar aportes SERVEL que pueden revelar afiliación política (dato sensible) de donantes?**
   - Qué sabemos: afiliación política es sensible; interés legítimo existe como base; SERVEL ya publica los aportes.
   - Qué falta: si el cruce/agregación reactiva tratamiento de dato sensible que exija base más fuerte que interés legítimo.
   - Recomendación: planteárselo explícitamente al abogado en el dossier; es el núcleo del sign-off MONEY.

2. **¿Qué licencia real cubre cada dataset MONEY?**
   - Qué sabemos: ChileCompra = mención de fuente (no CC formal); InfoProbidad = CC BY 4.0.
   - Qué falta: términos de reuso del dataset de aportes de SERVEL.
   - Recomendación: documentar por dataset, verificado; no asumir CC BY 4.0 transversal.

3. **¿El flag se consulta también desde un RPC (SQL) además de la ficha (server component)?**
   - Qué sabemos: la ficha lo lee server-side por `process.env`.
   - Qué falta: si las rutas MONEY 14-16 incluyen un RPC público que deba respetar el flag.
   - Recomendación: si sí, exponer el flag también como `app.settings.money_public_enabled` y que el RPC lo lea; mantener un solo significado de "encendido".

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase Postgres (nube sa-east-1) | Candado (a) RLS + pgTAP | ✓ | PG15+ (ref `bctyygbmqcvizyplktuw`) | — |
| `supabase` CLI (`supabase test db`) | pgTAP del gate | ✓ (usado en v1.0) | — | Aplicar con `--db-url` explícito (BOM en `.env`) |
| Vitest | test del flag | ✓ | en repo | — |
| Next.js 16 + `server-only` | flag server-side | ✓ | 16.x | — |

**Missing dependencies with no fallback:** ninguno.
**Nota operativa:** aplicar migraciones/pgTAP al remoto es **checkpoint de operador**; el agente prepara el SQL/test, el operador (o el camino `--db-url` ya establecido) lo aplica.

## Validation Architecture

> `.planning/config.json` no inspeccionado en detalle; se asume `nyquist_validation` habilitado (default). Si está `false`, omitir.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (TS, flag) + pgTAP (`supabase test db`, RLS) |
| Config file | `packages/*/vitest.config.ts`; tests SQL en `supabase/tests/` |
| Quick run command | `pnpm vitest run <pkg>` (flag) |
| Full suite command | `pnpm -r test` + `supabase test db --db-url <url>` (RLS) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LEGAL-01 | tabla MONEY niega `anon` (RLS + revoke) | pgTAP | `supabase test db --db-url <url>` | ❌ Wave 0 (`0023_money_gate.test.sql`) |
| LEGAL-01 | flag `MONEY_PUBLIC_ENABLED` default `false` | unit | `pnpm vitest run` (money-gate) | ❌ Wave 0 (`money-gate.test.ts`) |
| LEGAL-01 | dossier presente con `signoff:` YAML + 3 superficies + copia en `docs/legal/` | doc-check / manual | inspección + (opcional) test de presencia de archivo/campos | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run` (flag) — < 5s.
- **Per wave merge:** suite Vitest completa + `supabase test db` contra remoto aplicado.
- **Phase gate:** ambos verdes + dossier con YAML `signoff` presente antes de `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `supabase/migrations/0023_money_gate.sql` — tabla(s) MONEY deny-by-default (o convención + tabla-exemplar, espejo de 0018)
- [ ] `supabase/tests/0023_money_gate.test.sql` — RLS + sin policy + revoke anon
- [ ] `packages/core/src/money-gate.ts` (o `app/lib/`) + `money-gate.test.ts` — flag default false
- [ ] `13-LEGAL-DOSSIER.md` + copia `docs/legal/13-LEGAL-DOSSIER.md`
- [ ] `.env.example` — `MONEY_PUBLIC_ENABLED=false`

## Security Domain

> `security_enforcement` no leído explícitamente; se asume habilitado. Esta fase ES un control de seguridad/privacidad.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | **yes** | RLS deny-by-default + `revoke` (candado a); flag server-side (candado b) |
| V5 Input Validation | no (sin input de usuario nuevo) | — |
| V6 Cryptography | no | — |
| V8/V9 Data Protection / Privacy | **yes** | Minimización (RUT/terceros internos); base de licitud documentada; atribución de fuente |
| V14 Config | **yes** | Flag default OFF en `.env.example`; sin `NEXT_PUBLIC_`; secreto no reutilizado |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Exposición prematura de dato MONEY antes del sign-off | Information Disclosure | Doble candado: RLS niega `anon` + flag default OFF |
| Default privileges de Supabase exponen tabla nueva a anon | Information Disclosure | `revoke all from anon, authenticated` + pgTAP que lo verifica |
| Flag filtrado al cliente | Information Disclosure | server-only, sin `NEXT_PUBLIC_` |
| Falso positivo de CI (RLS no aplicada de verdad) | Tampering / EoP | pgTAP contra schema aplicado (checkpoint operador) |
| RUT/tercero a un LLM | Information Disclosure | `assertPiiDocumentSafeForLlm` (ya existe); el dossier lo cita |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/0018_piso_pii.sql`, `0021_lobby.sql`, `0022_probidad.sql` — convención RLS deny-by-default + revoke + RPC security definer (leídas)
- `supabase/tests/0018_piso_pii.test.sql` — plantilla pgTAP (leída)
- `packages/llm/src/data-routing.ts` + `config.ts` — gate de minimización LLM + patrón de flag con env inyectado (leídos)
- `app/lib/supabase.ts` — patrón server-only sin `NEXT_PUBLIC_` (leído)
- `.env.example`, `PROJECT.md`, `CLAUDE.md`, `13-CONTEXT.md` — contrato de config, postura legal, decisiones bloqueadas (leídos)
- [chilecompra.cl/terminos-y-condiciones-de-uso/](https://www.chilecompra.cl/terminos-y-condiciones-de-uso/) — "debe mencionar su fuente" (leído directo) — HIGH

### Secondary (MEDIUM confidence)
- [bcn.cl/leychile/Navegar?idNorma=1209272](https://www.bcn.cl/leychile/Navegar?idNorma=1209272) — entrada oficial Ley 21.719 (JS-rendered; no abrió por fetch — idNorma a verificar)
- [servel.cl — financiamiento de campaña](https://www.servel.cl/campanas-electorales/financiamiento-de-campana/) / [Ley 19.884 (scielo)](https://www.scielo.cl/scielo.php?script=sci_arttext&pid=S0718-09502015000200007) — marco SERVEL
- [wikiguias.digital.gob.cl — guía implementación Ley datos](https://wikiguias.digital.gob.cl/datos-personales/guia-practica-implementacion-nueva-ley-datos-personales) — guía gob para la Administración

### Tertiary (LOW confidence — verificar antes de firmar)
- [preyproject.com](https://preyproject.com/es/blog/ley-de-proteccion-de-datos-en-chile), [grc360.cl](https://www.grc360.cl/blog/ley-21719-proteccion-datos-chile), [valuetech.cl](https://www.valuetech.cl/guia-simplificada-ley-21-719-proteccion-de-datos-personales-en-chile/), [confidata.cl](https://confidata.cl/blog/ley-21719-vs-gdpr-diferencias-similitudes), [codevsys.cl](https://www.codevsys.cl/blog/ley-21719-guia-practica), [soyio.id](https://soyio.id/blog/conceptos-esenciales-para-comprender-la-ley-21-719-de-proteccion-de-datos-personales) — guías comerciales 2025-2026 (fechas/artículos a confirmar contra texto oficial)

## Metadata

**Confidence breakdown:**
- Patrón técnico del gate (RLS + flag + pgTAP): **HIGH** — todos los análogos existen y fueron leídos en el repo.
- Marco legal de detalle (fechas, artículos, base de licitud): **MEDIUM** — fuentes secundarias + reglamento pendiente; verificar contra texto BCN oficial.
- Licencias de republicación (ChileCompra/SERVEL): **MEDIUM-HIGH** ChileCompra (términos leídos directo) / **MEDIUM** SERVEL (sin página de licencia ubicada).

**Research date:** 2026-06-19
**Valid until:** legal — re-verificar al publicarse el reglamento de la Ley 21.719 o al acercarse 2026-12-01; técnico — 30 días (estable).
