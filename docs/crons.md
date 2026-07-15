# Matriz de crons de ingesta

**Fuente de verdad:** `packages/freshness/src/catalog.ts` (9 fuentes, umbral por fuente).
**Actualizado:** Phase 83 (2026-07-15).

## Crons activos

| Workflow | Entrada CLI | Fuente(s) | Secrets requeridos | Cadencia | Guard fail-loud | Estado |
|----------|-------------|-----------|-------------------|----------|-----------------|--------|
| `leyes-weekly` | `@obs/tramitacion run-tramitacion-prod-cli` | opendata.camara.cl (WS JSON) + Senado XML | `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`, `R2_*` | `0 20 * * 1-5` — L-V 20:00 UTC | CLI exit(errores>0) | VERDE |
| `agenda-weekly` | `@obs/agenda run-agenda-prod-cli` | Cámara (curl+DeepSeek PDF) + Senado citaciones | `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`, `DEEPSEEK_API_KEY`, `R2_*` | `0 11 * * 1` — lun 11:00 UTC | CLI exit | VERDE |
| `probidad-weekly` | `@obs/probidad run-probidad-todos-cli` | datos.cplt.cl/sparql (InfoProbidad/CPLT) | `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`, `R2_*` | `0 11 * * 4` — jue 11:00 UTC | `grep consultados=[1-9]` \|\| exit 1 | VERDE (Phase 83 fix RC-1) |
| `lobby-leylobby-weekly` | `@obs/lobby ingest-cli` | leylobby.gob.cl (ejecutivo) | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (nombres DIVERGENTES del resto) | `0 11 * * 3` — mié 11:00 UTC | `grep audiencias\|degradaciones` | VERDE |
| `backup-parlamentario` | `@obs/identity seed:live --preserve-estado` | Senado XML + Cámara XML | `R2_*` (gated), `contents: write` | `0 6 * * 1` — lun 06:00 UTC | commit-si-cambió | VERDE (git-only, no escribe DB) |
| `roster-weekly` | `@obs/identity seed:live --preserve-estado` | Senado XML + Cámara XML | `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY` | dispatch-only (schedule pendiente de validación) | `grep 'maestra real -> [1-9]'` \|\| exit 1 | ESTRENO GATED — validar con corrida manual |

## Crons con dispatch manual / runbook local

| Workflow | Motivo | Fallback | Referencia |
|----------|--------|----------|------------|
| `lobby-camara-weekly` | WAF de camara.cl bloquea IPs de GH Actions (diagnosticado 2026-06-30). Schedule DESHABILITADO. | Operador descarga con curl, pasa `--html-file` al CLI localmente. | `docs/runbooks/cron-local-fallback.md` |

## Crons manuales / backfill

| Workflow | Propósito | Estado |
|----------|-----------|--------|
| `fichas-backfill` | Fichas + embeddings Gemini — corridas dirigidas por boletín | dispatch-only (correcto) |
| `backfill` | DummyConnector M1 legacy | dispatch-only (legacy, no fuentes reales) |
| `deploy-cloudflare` | Deploy OpenNext a Workers | dispatch-only (manual, correcto) |

## Fuentes fuera de cron (gated)

| Fuente | Motivo | Señal en freshness | Workflow futuro |
|--------|--------|-------------------|-----------------|
| ChileCompra | MONEY gated (Phase 73) | `contratos_ingesta_estado.ingestado_hasta` → stale honesto (null) | `chilecompra-weekly.yml` — NO crear hasta flip MONEY |
| SERVEL | LOCAL por diseño: el operador descarga `.xlsx` a mano | `aportes_ingesta_estado.ingestado_hasta` → stale honesto (null) | `servel-weekly.yml` — NO crear (ingesta local permanente) |

## Notas arquitectónicas

- **Rate-limit 2-3s/host obligatorio** — lo aplica `HostRateLimiter` del conector; NO añadir sleeps en CI.
- **Ingesta en dos etapas** (LOCKED): Fuente → R2 (crudo content-addressed) → Supabase. Re-ingesta lee de R2, nunca de la fuente.
- **Hash-check antes de descargar**: ETag/sha256; salir temprano si no hay novedades.
- **Guard fail-loud NUNCA relajar**: si la fuente bloquea, la respuesta es runbook local, no `|| true`.
- **`lobby-leylobby` usa nombres de env divergentes**: `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` (NO `SUPABASE_API_URL`/`SUPABASE_SECRET_KEY`). El workflow ya mapea correctamente — no copiar el patrón de otros workflows sin verificar.
- **`roster-weekly` gated**: añadir el schedule `0 10 * * 1` (lunes 10:00 UTC, después de backup-parlamentario del domingo) SOLO tras corrida manual VERDE documentada.
- **`backup-parlamentario`** no escribe la DB (sin `SUPABASE_LOCAL_SERVICE_KEY` en CI por diseño); solo commitea el snapshot git. `roster-weekly` es el que escribe `parlamentario.fecha_captura`.

## Verificación de frescura

```bash
pnpm freshness   # read-only; exit 1 si alguna fuente supera su umbral
```

Umbrales por fuente definidos en `packages/freshness/src/catalog.ts`:

| Fuente | Umbral |
|--------|--------|
| leyes | 7d |
| leyes-min-edad | 45d |
| agenda | 7d |
| lobby-camara | 14d |
| lobby-leylobby | 7d |
| probidad | 30d |
| fichas | 30d |
| chilecompra | 30d (gated) |
| servel | 365d (gated) |
