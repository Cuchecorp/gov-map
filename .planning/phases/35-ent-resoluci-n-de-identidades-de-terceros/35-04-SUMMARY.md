---
phase: 35-ent-resoluci-n-de-identidades-de-terceros
plan: 04
subsystem: "Reconciliadores (lobby/dinero) que cablean el FK de tercero + cola admin de revisión"
tags: [entity-resolution, fk-cableado, data-routing, admin-gate, fail-closed, ENT-03, ENT-04]
requires:
  - "@obs/identity matchDeterministaEntidad / confirmarEntidad / EnlaceEntidadConfirmado / EntidadTerceroRow / TipoEntidad (Plan 02)"
  - "@obs/adjudication resolver_entidad RPC contrato (writer-revision-entidad, Plan 03)"
  - "supabase/migrations 0035 (vinculo_entidad/revision_entidad) + 0036 (contratista.entidad_id, RPC resolver_entidad) — referenciados por nombre; apply remoto = checkpoint operador, NO requerido para build/unit-test"
provides:
  - "reconciliar-sujeto.ts: contraparteId poblado con EnlaceEntidadConfirmado al confirmar (Δ3, antes SIEMPRE null)"
  - "reconciliar-contrato.ts: contratista.entidad_id poblado resolviendo el proveedor contra entidad_tercero (Δ3)"
  - "/admin/revisar-entidades: cola de revisión protegida server-side (ENT-04); promoción solo humana vía RPC resolver_entidad"
  - "app/lib/admin-gate.ts (adminRevisionEnabled fail-closed) + app/lib/supabase-admin.ts (service-role server-only)"
affects:
  - "El runner de lobby (LIVE) puede inyectar opts.maestraEntidad para poblar contraparte_id"
  - "El runner de dinero (ingest-run) ya stampa contratista.entidad_id desde la resolución de @obs/dinero"
  - "El operador habilita ADMIN_REVISION_ENABLED + SUPABASE_SERVICE_KEY para montar la cola web admin"
tech-stack:
  added: []
  patterns:
    - "FK branded minteado SOLO en match confirmado; storage plano aplanado por el writer (Anti-Pattern A4: input branded, storage plano)"
    - "data-routing: el RUT crudo SOLO alimenta el matcher determinista en memoria; nunca al LLM/jsonb"
    - "gate de página fail-closed como PRIMERA sentencia (espejo /red, /contraparte); cliente service-role nunca se construye con el gate OFF"
    - "promoción humana exclusiva vía RPC resolver_entidad (p_promover=true, metodo='humano')"
key-files:
  created:
    - app/app/admin/revisar-entidades/page.tsx
    - app/app/admin/revisar-entidades/page.test.tsx
    - app/lib/admin-gate.ts
    - app/lib/supabase-admin.ts
  modified:
    - packages/lobby/src/reconciliar-sujeto.ts
    - packages/lobby/src/reconciliar-sujeto.test.ts
    - packages/lobby/src/writer.ts
    - packages/dinero/src/reconciliar-contrato.ts
    - packages/dinero/src/reconciliar-contrato.test.ts
    - packages/dinero/src/model.ts
    - packages/dinero/src/ingest-run.ts
    - packages/dinero/src/writer.ts
    - packages/dinero/src/writer-supabase.ts
    - .env.example
decisions:
  - "reconciliar-sujeto usa matchDeterministaEntidad (no correrPipelineEntidad): el determinista basta para el FK; el plan dejaba el pipeline LLM a discreción y solo si se inyecta un provider. Las contrapartes nunca van al pipeline → ningún RUT/nombre de contraparte cruza al LLM."
  - "contratista.entidad_id (la columna nueva de 0036) vive en la tabla `contratista` (keyed por rut_proveedor), NO en la fila de contrato. La resolución se computa por contrato en reconciliarContrato (ContratoParaEscribir.entidadId, branded) y ingest-run la stampa en el Contratista del proveedor (uniforme por RUT). Ambos writers (in-memory + Supabase) la aplanan a `entidad_id` string|null."
  - "El gate admin es env-based fail-closed (adminRevisionEnabled, espejo de net-gate/money-gate): el repo no tiene sistema de auth/sesión; deny-by-default por flag + service-role server-only es el patrón establecido. La promoción sigue siendo humana exclusiva (la confirma una persona vía la acción, nunca el pipeline)."
  - "El verify command `pnpm --filter @obs/dinero test <pat>` no resuelve el include glob de la config root (packages/**) desde cwd=packages/dinero; se corrió vía `npx vitest run packages/dinero/...` desde la raíz. Mismo comportamiento para @obs/lobby con el filtro de nombre que sí funciona. El gate de compilación es `typecheck` (tsc -b / tsc --noEmit), limpio en los tres paquetes."
metrics:
  duration: ~22min
  completed: 2026-06-24
---

# Phase 35 Plan 04: Reconciliadores cablean el FK de tercero + cola admin (ENT-03/ENT-04) — Summary

Los dos reconciliadores que HOY dejaban el FK de tercero NULL por diseño (Δ3) ahora lo pueblan con un match confirmado: `reconciliar-sujeto.ts` (lobby) resuelve cada contraparte contra la maestra `entidad_tercero` y puebla `lobby_contraparte.contraparte_id`; `reconciliar-contrato.ts` (dinero) resuelve el proveedor y puebla la columna nueva `contratista.entidad_id`. SOLO un match confirmado mintea el `EnlaceEntidadConfirmado` branded (jurídica solo por RUT exacto, Δ2; null en homónimo/sin-RUT, fail-closed). Más la cola web `/admin/revisar-entidades` — equivalente protegido server-side del `revisor-entidad-cli`, con promoción humana exclusiva vía el RPC `resolver_entidad`.

## What Was Built

- **Task 1 — reconciliar-sujeto contraparte_id (9474854):** `contrapartesDe` ahora reconcilia cada contraparte contra `opts.maestraEntidad` vía `matchDeterministaEntidad`; SOLO un match confirmado mintea `contraparteId` (`EnlaceEntidadConfirmado`). `ContraparteParaEscribir.contraparteId` re-tipado de `string|null` a `EnlaceEntidadConfirmado|null` (un string crudo ya no compila). El writer aplana el FK branded a `string|null` (storage plano, Anti-Pattern A4). El sujeto pasivo parlamentario NO cambia. Opciones inyectables `maestraEntidad`/`tipoEntidadContraparte`/`rutContraparte` con defaults seguros (sin maestra → todos null = comportamiento previo). 9 tests verdes incl. los 5 casos FK nuevos (confirma natural-único, null jurídica-sin-RUT, null homónimo, null sin-maestra, no-regresión sujeto pasivo).
- **Task 2 — reconciliar-contrato entidad_id (b3256d2):** `resolverEntidadProveedor` resuelve el proveedor contra `opts.maestraEntidad` (jurídica → RUT exacto, Δ2; natural → RUT o nombre); SOLO confirmado mintea el FK branded. `ContratoParaEscribir.entidadId` (branded) + `Contratista.entidadId` (plano); `ingest-run` stampa el FK resuelto en el contratista (uniforme por RUT); ambos writers aplanan a `entidad_id` (columna de 0036). DATA-ROUTING preservado: el RUT crudo SOLO alimenta el matcher determinista interno, NUNCA cruza al LLM ni al jsonb de revision_* (test lo asierta sobre vinculos/colas/prompts). La reconciliación del proveedor contra parlamentario (fiscalización) NO cambia. 19 tests del archivo verdes (95 en todo @obs/dinero).
- **Task 3 — cola admin revisar-entidades (f9cb21d):** `/admin/revisar-entidades` Server Component PROTEGIDO: `adminRevisionEnabled(process.env)` → `notFound()` como PRIMERA sentencia (OFF default; espejo de /red). Lista `revision_entidad` estado='pendiente' vía cliente SERVICE-ROLE (cola deny-by-default a anon). `resolverEntidadAdmin` resuelve vía RPC `resolver_entidad`: confirmar/corregir promueven con `p_promover=true` minteando el vínculo `metodo='humano'` (gate humano LOCKED); rechazar no promueve. Re-chequea el gate + valida revisor/chosen_id (/^E\d{5}$/) ANTES de tocar la DB. Nuevos `admin-gate.ts` (fail-closed) + `supabase-admin.ts` (service-role). 9 tests RTL verdes (276 en toda la app).

## Verification

- **lobby:** `pnpm --filter @obs/lobby test reconciliar-sujeto` → 9/9 verde; suite completa 48/48; `tsc -b` limpio.
- **dinero:** `npx vitest run packages/dinero/src/reconciliar-contrato.test.ts` → 19/19 verde; suite completa @obs/dinero 95/95; `tsc -b` limpio. (El filtro `pnpm --filter @obs/dinero test <pat>` no resuelve el include glob root desde el cwd del paquete — se corrió por ruta desde la raíz; el resultado de tests es el del plan.)
- **app:** `pnpm test revisar-entidades` → 9/9 verde; suite completa 276/276; `tsc --noEmit` limpio.
- contraparte_id y contratista.entidad_id se pueblan al confirmar; null en jurídica-sin-RUT / homónimo / sin-maestra.
- El RUT crudo nunca cruza al LLM/jsonb (test de data-routing sobre vinculos, colas y prompts verde).
- La cola admin 404 con el gate OFF antes de tocar la DB; 'confirmar' va por `resolver_entidad` con `p_promover=true` metodo='humano'; revisor vacío / chosen_id inválido NO tocan la DB.

## Deviations from Plan

### Auto-fixed / adjustments

**1. [Rule 3 - Blocking] El plan ubicaba `contratista.entidad_id` como "columna nueva"; la columna de 0036 vive en la tabla `contratista`, no en la fila de contrato.**
- **Found during:** Task 2.
- **Issue:** `reconciliarContrato` emite filas de contrato (`ContratoParaEscribir`), pero `contratista.entidad_id` está en la sub-maestra de proveedores (keyed por rut_proveedor), que se upserta por separado en `ingest-run`.
- **Fix:** La resolución se computa por contrato (`ContratoParaEscribir.entidadId`, branded) y `ingest-run` la stampa en el `Contratista` del proveedor (uniforme por RUT, mismo proveedor → misma resolución). `Contratista.entidadId` (plano) + ambos writers (`writer.ts` in-memory, `writer-supabase.ts`) aplanan a la columna `entidad_id`.
- **Files modified:** reconciliar-contrato.ts, model.ts, ingest-run.ts, writer.ts, writer-supabase.ts.
- **Commit:** b3256d2.

**2. [Rule 3 - Blocking] El verify command de @obs/dinero no encuentra el archivo de test.**
- **Found during:** Task 2 verificación.
- **Issue:** El `include` de la config vitest root es `packages/**/*.test.ts`; con cwd=`packages/dinero` (lo que hace `pnpm --filter`) el glob ya no matchea. `No test files found`.
- **Fix:** Corrido vía `npx vitest run packages/dinero/src/reconciliar-contrato.test.ts` desde la raíz (mismo set de tests). Es una quirk preexistente de la config, no del plan.
- **Files modified:** ninguno (decisión de verificación).

**3. [Rule 2 - Missing critical] El gate admin y el cliente service-role no existían.**
- **Found during:** Task 3.
- **Issue:** El plan pedía la página protegida server-side + lectura via service-role, pero el repo no tenía ni gate admin ni cliente service-role (solo `createServerSupabase` anon).
- **Fix:** Creados `app/lib/admin-gate.ts` (fail-closed, espejo de net-gate/money-gate) y `app/lib/supabase-admin.ts` (service-role server-only). Documentados en `.env.example` (ADMIN_REVISION_ENABLED + SUPABASE_SERVICE_KEY). Es la maquinaria de protección que la página exige (Rule 2).
- **Files modified:** admin-gate.ts, supabase-admin.ts, .env.example (nuevos/modificado).
- **Commit:** f9cb21d.

## Threat Surface

Las mitigaciones del threat register del plan quedaron implementadas en código:
- **T-35-14** (FK con match equivocado): SOLO `EnlaceEntidadConfirmado` (branded) puebla el FK; jurídica solo por RUT exacto (Δ2); null en homónimo (fail-closed). Tests de los 3 casos verdes en ambos reconciliadores.
- **T-35-15** (RUT al LLM/jsonb): el RUT crudo SOLO alimenta `matchDeterministaEntidad` en memoria; el test de data-routing afirma que no aparece en vinculos/colas ni en ningún prompt.
- **T-35-16** (cola PII pública): `/admin/revisar-entidades` gateada server-side (`adminRevisionEnabled` como primera sentencia → notFound OFF); service-role solo server-side; cliente nunca se construye con el gate OFF (test verde).
- **T-35-17** (dudoso auto-confirmado): promoción SOLO vía RPC `resolver_entidad` (p_promover=true, metodo='humano'); ningún auto-confirm; revisor vacío / chosen_id inválido no tocan la DB.
- **T-35-SC** (deps npm nuevas): cero paquetes nuevos (reusa @obs/identity, @obs/adjudication contratos, app stack existente).

No se introdujo superficie de seguridad nueva fuera del threat_model. La superficie admin nueva es deny-by-default (gate OFF + service-role server-only); no es un canal público.

## Known Stubs

Ninguno que impida la meta del plan. La página admin renderiza la cola y expone `resolverEntidadAdmin` (acción de servidor) testeada; el wiring de un `<form>`/botón cliente que invoque la acción es presentación incremental — la lógica de promoción humana (gate + validación + RPC) está completa y testeada. El apply remoto de 0035/0036 y la columna `contratista.entidad_id` son checkpoint de operador (referenciados por nombre); los reconciliadores escriben el FK contra esos contratos sin requerir el apply para build/unit-test (los tests mockean el cliente Supabase).

## Self-Check: PASSED

- Archivos creados verificados en disco (4 nuevos: page.tsx, page.test.tsx, admin-gate.ts, supabase-admin.ts).
- Commits verificados: 9474854 (Task 1), b3256d2 (Task 2), f9cb21d (Task 3).
