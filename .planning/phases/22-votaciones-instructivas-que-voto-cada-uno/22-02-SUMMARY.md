---
phase: 22-votaciones-instructivas-que-voto-cada-uno
plan: 02
subsystem: frontend
tags: [votaciones, ficha-parlamentario, anti-insinuacion, honest-states, rtl]
requires:
  - "votos_de_parlamentario RPC extendido (22-01, 0028): titulo/idea_matriz/resultado/totales"
  - "VotoFichaRow tipo extendido (22-01): +8 campos nullable de sustancia/desenlace"
  - "moneyPublicEnabled (13-01): gate server-only MONEY"
provides:
  - "VotoFichaRow instructiva: titulo + extracto de idea (o honest-state) + desenlace factual"
  - "VotosView instructiva: 'Cómo votó' (sentido) + asistencia real separada + agrupación por proyecto (arco) + línea explicativa + cobertura honesta"
  - "extractoIdea/conteoVotacion (helpers puros en format.ts)"
  - "honest-state MONEY 'Financiamiento y contratos del Estado' en la ficha (carril propio)"
affects:
  - "app/components/voto-ficha-row.tsx"
  - "app/components/votos-por-parlamentario.tsx"
  - "app/app/parlamentario/[id]/page.tsx"
  - "app/lib/format.ts"
  - "app/lib/types.ts"
tech-stack:
  added: []
  patterns:
    - "Vista pura testeada con fixtures RTL (sin runtime Supabase/Next)"
    - "Truncado LITERAL de la idea matriz (prefijo de la fuente + elipsis), nunca reescritura"
    - "Honest-states first-class: idea null => 'no disponible aún'; sin ausentes => 'Emitió N votos'; pocos proyectos => nota de cobertura"
    - "Framing del desenlace como HECHO de la votación ('el proyecto fue Rechazado 58-81'), nunca juicio del voto"
    - "Carril propio mt-12 sibling para el honest-state MONEY; mutuamente excluyente con las secciones reales"
key-files:
  created:
    - ".planning/phases/22-votaciones-instructivas-que-voto-cada-uno/22-02-SUMMARY.md"
  modified:
    - "app/lib/format.ts"
    - "app/lib/types.ts"
    - "app/components/voto-ficha-row.tsx"
    - "app/components/votos-por-parlamentario.tsx"
    - "app/components/votos-por-parlamentario.test.tsx"
    - "app/app/parlamentario/[id]/page.tsx"
decisions:
  - "Agrupación por proyecto: el titulo/idea aparecen UNA vez como cabecera del arco; bajo él las etapas votadas (opción + etapa + desenlace) — no la VotoFichaRow plena por fila (evita repetir el titulo N veces). VotoFichaRow plena se conserva para la fila individual y la mención cruda."
  - "VotoFichaMencion gana campos OPCIONALES de sustancia/desenlace (no required) → la mención cruda muestra la misma sustancia conservando IdentityMarker, sin romper construcciones existentes."
  - "totalProyectos: el server lo computa sobre el conjunto COMPLETO (no la página) para la cobertura honesta; la vista lo deriva de boletines distintos si no se pasa (conservador)."
  - "Honest-state MONEY usa id='financiamiento-pendiente' y heading 'Financiamiento y contratos del Estado'; mutuamente excluyente (!moneyPublicEnabled) con #dinero/#financiamiento reales."
metrics:
  duration: ~8 min
  completed: 2026-06-20
  tasks: 3
  files: 6
---

# Phase 22 Plan 02: Votaciones instructivas (presentación) Summary

VotaView y VotoFichaRow reescritas para ser INSTRUCTIVAS: cada voto muestra de qué trata el proyecto (titulo + extracto literal de la idea matriz, o honest-state cuando falta), cómo votó la persona y qué pasó (desenlace factual con conteo), agrupado por proyecto como un arco — más asistencia real corregida, línea explicativa neutra, cobertura honesta y un honest-state de Financiamiento/contratos (MONEY pendiente legal). Todo PURO y testeado con fixtures RTL; cero término prohibido.

## What Was Built

### Task 1 — VotoFichaRow instructiva (TDD)
- `app/lib/format.ts`: `extractoIdea(idea, max=160)` (truncado LITERAL en límite de palabra + "…", nunca reescribe; normaliza espacios) y `conteoVotacion(si, no)` ("58–81" con en-dash, listo para Mono).
- `app/components/voto-ficha-row.tsx`: el titulo del proyecto (prominente, enlazado a `/proyecto/[boletin]`; fallback al boletín cuando es null), un extracto de `idea_matriz` con prefijo "De qué trata:" o el honest-state "De qué trata: no disponible aún", y una línea de DESENLACE "Votó {opción} · el proyecto fue {resultado} {si–no}" (conteo en Mono) que sólo aparece si `resultado != null`. El mismo tratamiento se aplica a `VotoFichaMencionRow` conservando su `IdentityMarker`.
- `app/lib/types.ts`: `VotoFichaMencion` gana campos opcionales de sustancia/desenlace.

### Task 2 — VotosView instructiva (TDD)
- "Asistencia" corregido: el heading del desglose de sentido pasa a **"Cómo votó"** (ese bloque ya no se llama Asistencia); se añade una métrica de **asistencia real** derivada de `conteos.ausente` ("Presente en X de N votaciones · Ausente en K"); sin ausentes degrada honesto a "Emitió N votos registrados" (no finge asistencia perfecta).
- **Agrupación por proyecto (el arco):** `agruparPorProyecto` agrupa por `boletin` preservando orden; `ProyectoGrupo` renderiza una cabecera de proyecto (titulo + idea/honest-state) y bajo ella las etapas votadas con su opción + etapa + desenlace factual.
- **Línea explicativa LOCKED:** "A favor / En contra se refiere a aprobar o rechazar el proyecto en esa etapa de su tramitación."
- **Cobertura honesta:** con ≤5 proyectos, nota muted "Se registran votaciones de N proyectos en las fuentes consultadas; la cobertura se está ampliando." (`totalProyectos` lo computa el server sobre el conjunto completo).
- La faceta "Por tema" y "Votó distinto a su bancada" se conservan sin score/juicio. `VotosSection` sigue leyendo el RPC extendido; conserva el join `proyecto.materia` (el RPC no trae materia) para la faceta.

### Task 3 — honest-state MONEY
- `app/app/parlamentario/[id]/page.tsx`: nueva `<section id="financiamiento-pendiente" className="mt-12">` con `<h2>Financiamiento y contratos del Estado</h2>` y el copy LOCKED "Pendiente de revisión legal (Ley 21.719) antes de publicarse." Visible cuando `moneyPublicEnabled(process.env)` es false (default); mutuamente excluyente con las secciones reales `#dinero`/`#financiamiento`. No toca Supabase, no renderiza monto/contrato/donante, no compone con un voto.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test] Test pre-existente "estado (a)" actualizado al nuevo contrato instructivo**
- **Found during:** Task 1 GREEN.
- **Issue:** El test "estado (a) confirmado → enlaza el boletín" asumía que el enlace era "Boletín N°XXXX". Con la fila ya instructiva, cuando hay `titulo` el enlace es el titulo (sigue apuntando a `/proyecto/[boletin]`); el boletín-como-enlace sólo aparece cuando `titulo` es null.
- **Fix:** El test ahora asierta el enlace por titulo + href correcto + ausencia de IdentityMarker (preserva su intención original de guarda de identidad). El fallback al boletín queda cubierto por el nuevo test "titulo null → cae al boletín".
- **Files modified:** `app/components/votos-por-parlamentario.test.tsx`.
- **Commit:** 9fe99e1.

No hubo gates de autenticación. No se requirió ningún cambio arquitectónico (Rule 4).

## Verification

- `cd app && npx vitest run components/votos-por-parlamentario` — **31 verdes** (13 base + 18 nuevos).
- `cd app && npx vitest run` — **suite completa 209 verdes** (20 archivos).
- `npx tsc --noEmit` — sin errores.
- Anti-insinuación (negative-match): `grep` de banned-vocab sobre `voto-ficha-row.tsx` y `votos-por-parlamentario.tsx` → **0 matches en copy** (las únicas apariciones de "score"/"rebeldías" están en comentarios meta que describen la prohibición). Los tests GATE §6/§9.1 verifican el render completo contra el patrón prohibido.
- `grep -F "Pendiente de revisión legal" "app/parlamentario/[id]/page.tsx"` → encontrado.
- VotoFichaRow y VotosView siguen PURAS (reciben datos por props; sin fetch/Supabase en la vista).

## Known Stubs

None. Los valores vacíos/honest-states (idea null, sin ausentes, cobertura baja, MONEY OFF) son estados honestos first-class data-driven, no stubs.

## Deferred / Operator Notes

- **Espejo en la ficha del proyecto (Bloque C, SC6)** y **redeploy + e2e (Bloque D)** son alcance de planes posteriores de la fase, no de 22-02.
- **Apply remoto de 0028 (22-01 Task 3)** sigue siendo checkpoint operador BLOCKING; no bloquea este plan (build/typecheck/tests corren contra el tipo ya extendido). El sitio EN VIVO mostrará titulo/idea/desenlace/agrupación una vez aplicado el RPC al remoto.

## Self-Check: PASSED

- FOUND: app/lib/format.ts (extractoIdea, conteoVotacion)
- FOUND: app/components/voto-ficha-row.tsx (SustanciaYDesenlace)
- FOUND: app/components/votos-por-parlamentario.tsx (agruparPorProyecto, ProyectoGrupo, "Cómo votó")
- FOUND: app/app/parlamentario/[id]/page.tsx (financiamiento-pendiente)
- FOUND commit 70af29b (test RED Task 1)
- FOUND commit 9fe99e1 (feat GREEN Task 1)
- FOUND commit 100000f (test RED Task 2)
- FOUND commit c9bb307 (feat GREEN Task 2)
- FOUND commit bbfdb55 (feat Task 3)
