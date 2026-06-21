---
phase: 22-votaciones-instructivas-que-voto-cada-uno
status: passed
verified: 2026-06-20
method: live-e2e (producción) + pgTAP remoto + RTL local
---

# Phase 22 — Verification: Votaciones instructivas

**Verdict: PASSED** — los 6 criterios de éxito confirmados sobre data real en producción
(`https://observatorio-congreso.thevalis.workers.dev`, deploy version `3f26e1ae`).

## Goal-backward: 6 success criteria

| SC | Criterio | Evidencia | Estado |
|----|----------|-----------|--------|
| SC1 | Sustancia por voto (título + extracto idea matriz; honest-state si falta) | Ficha D1054: "Autoriza mayor endeudamiento…" enlazado + "De qué trata: El presente proyecto tiene por objeto…". RPC vivo devuelve titulo/idea_matriz. | ✅ |
| SC2 | Desenlace por votación (resultado + conteo, enmarcado factual) | "Votó En contra · el proyecto fue Rechazado 72–74"; "Aprobado 94–52"; "Rechazado 58–81". Sin juicio. | ✅ |
| SC3 | Corregir "Asistencia" (asistencia real vs sentido del voto) | Heading "Cómo votó" (no "Asistencia"); "Emitió 9 votos registrados" como métrica de asistencia. | ✅ |
| SC4 | Agrupar por proyecto (el arco) | Votos agrupados bajo cada proyecto (endeudamiento / subvenciones) con etapas; no lista plana. | ✅ |
| SC5 | Honest-states + cobertura + funds | Línea "A favor / En contra se refiere a aprobar o rechazar el proyecto en esa etapa"; MONEY "Financiamiento y contratos — Pendiente de revisión legal (Ley 21.719)". | ✅ |
| SC6 | Espejo proyecto + redeploy + invariantes | `/proyecto/18296-05`: "Qué se votó" + "Resultado" + conteos. noindex presente; 0 hits "partido"; sin foto; MONEY/NET OFF; ProvenanceBadge por dato. | ✅ |

## Gates técnicos

- **DB:** migración 0028 aplicada al remoto (additiva, idempotente, cero PII); pgTAP 0029 **7/7**; regresión 0019 **13/13**; RPC sigue INVOKER; piso PII deny-by-default intacto (anon no lee partido).
- **Tests locales:** vitest **214/214** verdes; `tsc --noEmit` exit 0 (planes 22-01/02/03).
- **Anti-insinuación:** negative-match grep sin vocabulario prohibido en copy; "rebeldías" nunca en UI.
- **Build/deploy:** build Linux (Docker obsbuild) + `wrangler deploy` exit 0; Windows bundle no usado.
- **Provenance:** cada fila de voto/votación con ProvenanceBadge ("Actualizado hace 9 h · Cámara — fuente oficial").

## human_verification
Ninguno pendiente — el cierre de operador (apply remoto + deploy + e2e) lo ejecutó el orquestador
end-to-end con confirmación visual (screenshots en `shots/`).

## Deuda registrada (no bloquea)
- `schema_migrations` drift remoto (0026/0028 aplicados por psql, no por `db push`) — deuda de operador pre-existente.
- Cobertura de votaciones: 2 boletines/10 votaciones (deuda de DATOS separada; la vista degrada honesto).
