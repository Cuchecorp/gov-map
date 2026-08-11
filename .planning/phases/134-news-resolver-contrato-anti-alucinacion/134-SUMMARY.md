---
phase: 134-news-resolver
subsystem: news-resolver
tags: [anti-alucinacion, allowlist, dead-letter, gate, verificacion-opus]
dependency-graph:
  requires: [133-b-07, D-133-H]
  provides: [resolver/, 0086_noticia_dead_letter, EmisionSchema, procesarLoteAllOrNothing]
  affects: [135-NEWS-CLASIF, 137-NEWS-FICHAS]
key-files:
  created:
    - packages/news/src/resolver/{boletin-en-materia.ts, resolver.ts, allowlist.ts, dead-letter.ts, emision.ts, gate.ts}
    - packages/news/src/resolver/{resolver.test.ts, boletin-en-materia.equivalencia.test.ts}
    - supabase/migrations/0086_noticia_dead_letter.sql (+ pgTAP, APLICADA a PROD)
decisions:
  - "extraerBoletines: COPIA VERBATIM + guard de byte-identidad en CI (no mover el símbolo: app/ sin deps workspace, riesgo de deploy OpenNext no verificable local). D-133-H satisfecho en espíritu: cero reescritura, cero inversión de dependencia."
  - "Emisión pelada de boletín debe ser SOLO el número: 'Ley 20.730' ⇒ null (el test cazó el falso positivo ley/boletín antes que el código)."
  - "Token-set de nombres exige ≥1 token de APELLIDO (fix del MEDIUM de Opus: 'maría josé' resolvía). Homónimos exactos y 2 candidatos ⇒ null, ambos con guardia de test tras la mutación sobreviviente."
metrics:
  completed: "2026-08-10"
---

# Phase 134 — NEWS-RESOLVER: contrato anti-alucinación construido y verificado

Suite @obs/news 341→**362** (2 equivalencia + 19→21 resolver, tras el hardening). Commits:
`f1f9980` (134-01), `093b38f` (134-02, 0086 a PROD pgTAP 13/13), `08b07b3` (134-03/04),
más el hardening post-verificación.

## Verificación (Opus, adversarial, con mutaciones)

- SC1 **CUMPLE** (lista cerrada inyectada sin ids; LOUD en 4 puntos de entrada; paginación
  anti-cap-1k). SC4 **CUMPLE** (temperature 0 literal, umbral congelado 0.7, gate
  all-or-nothing con cero-vacuo).
- SC2 **CUMPLE tras hardening**: la mutación M1 (`candidatos.size >= 1`, best-guess)
  **SOBREVIVIÓ** a la suite original — la rama de ambigüedad no tenía guardia. Fix: casos
  con 2 candidatos reales, homónimos exactos, y la regla nueva "nombres de pila solos jamás
  resuelven" (apellido obligatorio en token-set). M1 re-corrida: **cae nombrando (g)**.
  M2/M3 cayeron a la primera. Byte-identidad `7bd8a3b7…` confirmada.
- SC3 **PARCIAL por diseño**: tabla + writer + schema correctos y aplicados; el CABLEADO
  (quién escribe el dead-letter) es de 135 — declarado, no escondido.
- LOW documentados en código: atomicidad interna de `aplicar` es precondición del writer de
  135; `payload.emision` jamás lleva titular; costo del prompt con 3.675 boletines
  inyectados es problema de frente de 135.

## Nota de proceso

El ciclo de mutación del verificador usa `git checkout --` y arrasó ediciones no
committeadas del working tree — re-aplicadas. Regla: **commitear antes de invitar a un
verificador que muta.**
