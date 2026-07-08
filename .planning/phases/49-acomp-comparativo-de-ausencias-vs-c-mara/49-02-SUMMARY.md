---
phase: 49-acomp-comparativo-de-ausencias-vs-c-mara
plan: 02
subsystem: ficha parlamentario / superficie de ausencia comparada (UI)
tags: [viz-03, rtl, anti-insinuacion, degrade-honesto, capa-2, f45-boundary]
requires:
  - "AusenciaContextoRow (app/lib/types.ts) — shape plano PII-safe (49-01)"
  - "tasa_ausencia_comparada en PUBLIC_RPC_ALLOWLIST (guard B, 49-01)"
  - "RPC tasa_ausencia_comparada ESCRITA (0050) — apply = checkpoint operador (49-03)"
provides:
  - "AusenciasContexto (app/components/ausencias-contexto.tsx) — sub-bloque de presentación puro (shape plano | null)"
  - "VotosSection: fetch tasa_ausencia_comparada con degrade PGRST202→null / throw #34"
  - "VotosViewData.ausenciaContexto (opcional/nullable) + montaje en VotosView tras 'Cómo votó'"
  - "RTL: degrade null, 3 líneas del copy contract, omisión de mediana null, negative-match extendido + causal + RUT"
affects:
  - "Plan 49-03 (operador): apply de 0050 → el sub-bloque aparece con datos reales; pre-apply degrada honesto (invisible en detalle colapsado)"
tech-stack:
  added: []
  patterns:
    - "Sub-bloque de presentación PURO (nunca importa el cliente Supabase — frontera F45 LOCKED)"
    - "Degrade de 3 caminos espejo VERBATIM de cruces-de-proyecto (PGRST202→null / error→throw #34 / data→render)"
    - "Omisión honesta F47: mediana_camara/N/M null → se OMITE la línea, jamás se fabrica un número"
    - "Copy contract LOCKED verbatim con cifras Mono tabular-nums, CERO color/bold (un % coloreado = veredicto)"
    - "String children explícitos {\"...\"} en JSX para textContent determinista (evita whitespace-collapse)"
key-files:
  created:
    - app/components/ausencias-contexto.tsx
    - app/components/ausencias-contexto.test.tsx
  modified:
    - app/components/votos-por-parlamentario.tsx
decisions:
  - "AusenciasContexto retorna un <div> (hijo directo del div.space-y-10 del detalle), coherente con los sub-bloques hermanos ('Cuándo votó', 'Cómo votó')"
  - "Fabrication guard defensivo (hayPropia: M>0; hayMediana: number) aunque los tipos garanticen number — protege contra shapes degenerados y div/0"
  - "Montaje INMEDIATAMENTE tras el div 'Cómo votó' (línea 645) y antes de 'Por tema'; capa-1 (VotosCapa1) byte-idéntica"
  - "El shape se pasa a VotosView vía spread `{ ...data, ausenciaContexto }` — VotosView permanece puro (recibe el shape ya resuelto)"
metrics:
  duration: ~15min
  tasks: 2
  files: 3
  completed: 2026-07-07
---

# Phase 49 Plan 02: AusenciasContexto (UI VIZ-03) Summary

Sub-bloque factual de 3 líneas (tasa de ausencia propia + mediana de la cámara + caveat de cobertura) montado DENTRO del detalle de Votaciones inmediatamente tras "Cómo votó", con degrade honesto pre-apply (PGRST202→null→omitido / error real→throw #34), presentación pura sin cliente Supabase, y RTL con negative-match extendido anti-insinuación.

## Qué se construyó

- **`app/components/ausencias-contexto.tsx`** (`AusenciasContexto`): componente de presentación PURO `({ data }: { data: AusenciaContextoRow | null })`. `data === null` → `return null` (degrade honesto ya resuelto en el server). `pctFormatter` local es-CL 1-decimal (paridad con capa-1); X% = `format(tasa_propia*100)`, Y% = `format(mediana_camara*100)`. Heading neutro `<h3 class="text-sm font-semibold">Ausencias en contexto</h3>`. Tres líneas del copy contract LOCKED verbatim con N/M/X%/Y%/K en `font-mono tabular-nums` (CERO color, CERO bold, CERO chart). Fabrication guard: `hayPropia` exige `m_votaciones > 0` (nunca div/0); `hayMediana` sólo si `mediana_camara` es `number` (null → línea omitida). JSX con string-children explícitos `{"..."}` para un `textContent` determinista. NUNCA importa el cliente Supabase (frontera F45 LOCKED).
- **`app/components/votos-por-parlamentario.tsx`** (modificado):
  - `VotosSection` (server): añade `const { data: acData, error: acError } = await sb.rpc("tasa_ausencia_comparada", { p_parlamentario_id: id })`. Degrade de 3 caminos espejo de `cruces-de-proyecto`: `acError?.code === "PGRST202"` → `ausenciaContexto = null`; cualquier otro `acError` → `throw new Error("tasa_ausencia_comparada falló para ${id}: ${acError.message}")` (#34, sin blanket-catch); si hay data → `(acData as AusenciaContextoRow[] | null)?.[0] ?? null`. Se pasa a la vista vía `<VotosView id={id} data={{ ...data, ausenciaContexto }} />`.
  - `VotosViewData`: nuevo campo opcional `ausenciaContexto?: AusenciaContextoRow | null`.
  - `VotosView`: monta `<AusenciasContexto data={data.ausenciaContexto ?? null} />` JUSTO tras el div "Cómo votó" (línea 645) y antes de "Por tema". Capa-1 y el resto del orden intactos.
- **`app/components/ausencias-contexto.test.tsx`** (RTL, sin runtime Supabase): 7 tests — degrade null (container vacío), 3 líneas del copy contract verbatim ("0,7%" / "3,2%" / caveat), omisión de mediana null, singular/plural de "parlamentario(s)", cifras Mono `tabular-nums` sin `font-bold`, negative-match extendido `/top|más ausente|peor|mejor asistencia|récord/i` + causal heredado `/afinidad|influencia|presión|score|ranking|tendencia/i`, heading neutro, RUT limpio (`PATRON_RUT`).

## Desviaciones del plan

**Ninguna.** El plan se ejecutó exactamente como fue escrito. El contrato de copy, el placement, el degrade de 3 caminos y el negative-match extendido se implementaron verbatim del 49-UI-SPEC.

## Autenticación / gates

Ninguno. Todo fue implementación de UI + tests RTL en jsdom, sin runtime Supabase ni red.

## Verificación

- `npx tsc --noEmit`: **limpio** (exit 0).
- `npx vitest run components/ausencias-contexto.test.tsx`: **7/7 verde**.
- `npx vitest run components/votos-por-parlamentario.test.tsx`: **64/64 verde** (VotosView modificado sin regresión).
- Suite completa: **719/719 verde** (baseline 712 + 7 nuevos; 68 archivos).
- Grep: `AusenciasContexto` importado y montado (línea 660) tras "Cómo votó"; `sb.rpc("tasa_ausencia_comparada"...)` con degrade `PGRST202` (línea 1046) y throw #34 en `VotosSection`.
- Capa-1 (`VotosCapa1`) sin tocar (byte-idéntica); el chart "Cuándo votó" y el orden del detalle intactos.

## Nota de degrade (deploy-before-apply)

La RPC `tasa_ausencia_comparada` (0050) está ESCRITA pero NO aplicada (apply = checkpoint operador, Plan 03). El deploy PUEDE preceder al apply: pre-apply el fetch devuelve `PGRST202` → `ausenciaContexto = null` → el sub-bloque se OMITE por completo (invisible dentro del detalle colapsado, capa-1 byte-idéntica). Post-apply, con los datos de D1012 (N=1, M=141, tasa 0,71%, mediana 0,74%, K=155) el bloque se lee "en línea con la referencia" — el contexto neutro que VIZ-03 busca.

## Known Stubs

Ninguno. El sub-bloque es funcional-completo; su visibilidad con datos reales depende del apply de 0050 (checkpoint operador Plan 03), no de un stub.

## Threat Flags

Ninguno. No se introduce superficie de seguridad nueva: el sub-bloque es presentación pura (no toca el cliente Supabase, no expone PII — `AusenciaContextoRow` es PII-safe por diseño en 49-01), y el fetch reusa el patrón de degrade/allowlist ya auditado.

## Self-Check: PASSED

- Archivos creados/modificados: 3/3 FOUND (ausencias-contexto.tsx, ausencias-contexto.test.tsx, votos-por-parlamentario.tsx).
- Commits: 3/3 FOUND (5f076cf test RED, 1861a3c feat GREEN, 9288cef test Task 2).
