# Phase 74: DEUDA — Cursor leylobby + `CLOUDFLARE_API_TOKEN` CI + round-robin cron leyes-weekly - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning
**Mode:** Auto-generated (deuda de ingesta/CI/cron — discuss skipped; independiente de votos/dinero)

<domain>
## Phase Boundary

Cerrar la deuda de ingesta INDEPENDIENTE de P3/P5 — que los crons corran verdes y la frescura no se diluya. Tres ítems (DEBT-02/03/04):
1. **Cursor leylobby (DEBT-02):** el conector leylobby usa cursor INCREMENTAL — no re-scrapea todo el histórico en cada corrida.
2. **`CLOUDFLARE_API_TOKEN` CI (DEBT-03):** el token cargado en CI → los crons de novedades corren VERDES en GitHub Actions sin fallback local manual. (El VALOR del secreto lo carga el OPERADOR en GH repo settings; el agente cablea + verifica la REFERENCIA en el workflow, no inventa el secreto.)
3. **Round-robin cron leyes-weekly (DEBT-04):** el cron `leyes-weekly` rota round-robin sobre el corpus 3.657 (lotes acotados incrementales L–V) → ningún proyecto queda indefinidamente sin refrescar; MONEY/SERVEL FUERA del cron mientras gated.
Sin regresionar los conectores v6.0 (leyes/lobby/probidad); `pnpm freshness` refleja la rotación.

</domain>

<decisions>
## Implementation Decisions

### Respeto al servidor + minimizar minutos CI (LOCKED)
- Cursor incremental: hash-check / última-marca antes de descargar; salir temprano si no hay novedades. Rate-limit 2-3s.
- Cron de novedades diario L–V, minimizando minutos: lotes acotados incrementales, solo novedades, hash-check primero.
- Round-robin sobre el corpus para que ningún proyecto quede sin refrescar (evitar la dilución cron detectada en v6.1).
- MONEY/SERVEL FUERA del cron mientras gated (no encender ingesta de dinero por cron).

### CI secret = referencia, no valor (LOCKED)
- El agente cablea el workflow para USAR `CLOUDFLARE_API_TOKEN` (y verifica que la referencia exista + el job lo consuma). El VALOR del secreto es acto de OPERADOR (GH repo settings de Cuchecorp/gov-map). No hardcodear secretos.

### Sin regresión v6.0 (LOCKED)
- Los conectores leyes/lobby/probidad de v6.0 no deben regresionar; `pnpm freshness` sigue verde para ellos + refleja la rotación.

### Claude's Discretion
Detalles del cursor/rotación/wiring dentro de las reglas; reusar los conectores + crons existentes.

</decisions>

<code_context>
## Existing Code Insights

Profundizado en plan-phase research. YA EXISTEN:
- Conector leylobby (a dar cursor incremental).
- Crons GitHub Actions (`leyes-weekly`, `agenda-weekly`, etc.) — `leyes-weekly` a rotar round-robin.
- `pnpm freshness` (frescura por fuente) — reflejar rotación.
- Patrón de cursor/hash-check de otros conectores (v6.0/v6.1).
- Repo en Cuchecorp/gov-map (transfer previo); secrets re-cargados por operador (memoria: 9 de .env + 2 cloudflare).

</code_context>

<specifics>
## Specific Ideas

- Cursor incremental leylobby (última marca / hash-check).
- `CLOUDFLARE_API_TOKEN` referenciado en el/los workflow(s) de cron; verificar el job lo consume; valor = operador.
- Round-robin `leyes-weekly` sobre 3.657 boletines, lotes acotados, L–V; MONEY/SERVEL excluidos.
- `pnpm freshness` refleja rotación sin regresión v6.0.

</specifics>

<deferred>
## Deferred Ideas

- Typography island `.net-*` + rotar DB password → Phase 75.
- La carga real del secreto CF en GH settings + habilitar billing GH si aplica = acto operador.
</deferred>
