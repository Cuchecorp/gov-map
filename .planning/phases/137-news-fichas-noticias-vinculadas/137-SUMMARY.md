---
phase: 137-news-fichas
subsystem: news-frontend
tags: [prensa, vinculo-determinista, metodologia-publica, C2.4a, fail-closed]
dependency-graph:
  requires: [136, 133-b-07]
  provides: [noticias-de-proyecto.tsx, /metodologia/prensa, 0089]
  affects: [138]
decisions:
  - "Ejecutada por la SALIDA HONESTA C2.4(a): vinculo noticia->proyecto SOLO por mencion textual del boletin (deterministico); base pelada atribuida solo si es unica en proyecto (regla del resolver). CERO vinculo por clasificacion (T4/T9 no-medidos) y CERO seccion en fichas de persona (T9)."
  - "La pagina publica usa NOMBRES HUMANOS de las clases (G2 prohibe los literales snake_case en app/, incluso en comentarios)."
metrics:
  completed: "2026-08-11"
---

# Phase 137 — NEWS-FICHAS: prensa vinculada (determinista) + metodología pública

## Entregado

- **Sección "Prensa"** en la ficha de proyecto (`noticias-de-proyecto.tsx` + rail):
  cita = titular (link externo `rel="noopener noreferrer"` vía `safeExternalHref`) + outlet
  + fecha (`fechaHechoCortaSegura`); JAMÁS descripción ni texto completo. Ausencia honesta
  como estado normal: **0 de 114 noticias citan un boletín textual** (hallazgo: la prensa
  RSS chilena no escribe números de boletín — el carril se llena orgánicamente vía la
  detección cableada al cron diario). Base pelada solo si única (`boletin_num` count=1).
- **`/metodologia/prensa`** ("Cómo clasificamos las noticias", entregable público B2.5):
  6 clases con nombres humanos, vara (κ=0.83 [0.75–0.91] **n=154 doble-anotados de 159**,
  acuerdo 88,96 %), **anotadores y árbitro declarados como modelos IA** (misma familia),
  **κ humano NO MEDIDO declarado**, umbrales pre-registrados, T3=87,66 % [81,3–91,8],
  fail-closed explicado (por qué NO hay vínculo por clasificación), limitaciones B2.5,
  y los 4 hashes congelados (verificados byte a byte por el verificador).
- Infra: 0089 (`boletines_detectados` + GIN) aplicada, backfill 114 filas, detección en
  cada corrida diaria.

## Verificación (Opus) + hardening

PASS 4/4 SC bajo C2.4a; inyección PostgREST descartada (param validado por regex anclado);
sin fuga de texto (el `.select` no incluye `descripcion`). Mutaciones: M1/M3 mordieron;
**M2 y M4 sobrevivieron** y se cerraron en el hardening: literal INLINE en el test del
componente (una promesa de cobertura ahora cae) y las páginas de metodología registradas en
`SUPERFICIES_LINK_EXT` (términos prohibidos en la metodología ahora caen — re-verificado
con mutación). H-3/H-4 corregidos en el copy. app 1808 verdes, @obs/news 384 verdes.

## Nota de proceso (segunda vez)

`git checkout --` de los ciclos de mutación arrasó DOS veces ediciones no committeadas.
Regla ya escrita en memoria: commitear SIEMPRE antes de cualquier ciclo de mutación.
