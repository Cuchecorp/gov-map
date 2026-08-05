# Phase 132 — Discussion Log

**Date:** 2026-08-05
**Mode:** Autónomo (Pasada 2 v13.0). Gray areas adjudicadas por Fable según el régimen LOCKED
del operador (2026-08-05): Fable decide, Sonnet ejecuta, Opus valida. Sin AskUserQuestion —
sesión sin operador presente; cada adjudicación quedó con razón escrita en 132-CONTEXT.md.

## Áreas identificadas y adjudicadas

| Área | Pregunta | Adjudicación | Ref |
|---|---|---|---|
| Fuentes directas | ¿Cuáles 4 medios? | Set probado de ICS; research puede sustituir LaCuarta SOLO con RSS verificado vivo | D-01 |
| Google News | ¿Cuántas queries y cuáles? | 3–5 legislativas, builder ICS, congeladas con test | D-02, D-03 |
| Decoder GNews | ¿Offline + batchexecute? | Solo offline; batchexecute PROHIBIDO (régimen respetuoso) | D-04 |
| Pre-filtro | ¿Precision o recall? ¿Dónde queda el descarte? | Recall-first; descarte a ledger Supabase con causa, conteo por query | D-05..D-07 |
| Código | ¿Package nuevo o extender ingest? | `packages/news` sobre BaseConnector; prohibido reimplementar política | D-08..D-10 |
| Schema | ¿Tablas y exposición? | `noticia` + `noticia_url_vista`, RLS deny-all, cero RPC pública en 132 | D-11, D-12 |
| Dedup | ¿Qué niveles entran? | Solo URL exacta + canónica; títulos/clustering fuera | D-13 |

## Deferred

Ver sección `<deferred>` de 132-CONTEXT.md (full-text→137, clustering→nunca/spike, APA→137).
