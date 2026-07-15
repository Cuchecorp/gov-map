# Phase 84: DEUDA-CERO — Revisión completa + eliminación de deuda - Context

**Gathered:** 2026-07-15
**Status:** Ready for execution (84-RESEARCH.md = inventario con disposición)
**Requirement:** DEMO-03

<decisions>
## Disposición FINAL (open questions dirimidas por el orquestador)

- **D1 (cerrar):** test de contraste WCAG (luminancia relativa calculada en el test, sin browser) para la barra cívica dark — congela Cámara 5.63:1 / Senado 4.80:1 ≥ 3:1; falla si alguien cambia los tokens bajo el umbral.
- **D2 (cerrar — PRIORITARIO, defecto vivo):** fix MECÁNICO `-[--var]` → `-[var(--var)]` en los ~15 usos / 9 componentes públicos (chips cívicos, provenance badges, etc. — hoy renderizan sin color). NO tocar globals.css/@theme. Extender el guard cero-bare-var de bento-guards (o crear guard repo-wide barato) para que el patrón no vuelva — con mutation self-check.
- **D3 (cerrar):** IN-01 padding header/footer unificado (<md).
- **D13 (cerrar selectivo):** IN-02 collapse regex + IN-03 negación exacta de 80-REVIEW — fixes quirúrgicos de robustez de tests; sin colisión con 85 (85 revisa, no edita el linter).
- **D4 (/red curvas): documentar-con-razón** en el SUMMARY — island pixel-LOCKED, gate 75 cerrado y aprobado, re-layout = v9. NO TOCAR .net-*.
- **D6/D7/D8/D9: operador** — listar en SUMMARY bajo "Deuda de operador (sin cambio)": UAT rotate /red, CLOUDFLARE_API_TOKEN secret CI, rotar DB password B26, gates v7.0.
- **D5/D11/D12:** ya resueltos / cero reales — constatar en SUMMARY.

## Restricción de paralelismo
Phase 83 corre EN PARALELO tocando `packages/probidad`, `packages/lobby` (CLIs), `.github/workflows/*` y `docs/crons.md` — NO tocar esos paths. Si un fix D2 viviera en un package que 83 edita, saltarlo y anotar (improbable: D2 vive en app/components).

## Validación
Suite completa app + packages verde + tsc; guards nuevos/extendidos con mutation self-check demostrado; visual de chips se confirma en 85 (deploy).
</decisions>
