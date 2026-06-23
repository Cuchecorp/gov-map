# HANDOFF — gov-map (Cuchecorp) · 2026-06-23

Estado para retomar en sesión nueva con contexto limpio.

## Dónde está todo
- **Repo:** `github.com/Cuchecorp/gov-map` (transferido desde xenaquis, **PÚBLICO**). Remote local ya actualizado (`git remote set-url origin …/Cuchecorp/gov-map.git`).
- **Deploy en vivo:** `observatorio-congreso.thevalis.workers.dev` + **gov-map.com** (worker `observatorio-congreso`, NO se renombró). Última versión desplegada: `ad99a52c`.
- **DB:** Supabase PROD. Migraciones aplicadas hoy por psql: **0032** (FTS agenda `buscar_citaciones`) y **0033** (filtro `p_camara` en el RPC). Registradas en `schema_migrations` (el drift histórico 0026–0031 persiste, irrelevante: `db push` está prohibido, DDL siempre por `psql --single-transaction`).

## Lo que se hizo hoy (en master)
1. **Fase A+B** (commit `cac5541`): tabla de sala Cámara vía DeepSeek-desde-PDF (LIVE, 19 ítems) + buscador FTS de agenda. Ver [[camara-tabla-y-buscador-agenda]].
2. **Hardening pre-transfer** (`1fe7279`): fixes confirmados por enjambre (shell-injection en workflows, error-handling del runner de leyes, normalizarBoletin NNNNN-NN, filtro cámara al RPC vía 0033).
3. **Crons minimalistas** (`7865478`): `leyes-weekly` (vie 20:00 UTC, runner `run-tramitacion-prod-cli` nuevo) + secrets DEEPSEEK/R2 en `agenda-weekly`. Ver [[crons-y-transfer-cuchecorp]].
4. **LICENSE** CC BY 4.0 (`6e473e1`).
5. **CRONS ARREGLADOS Y VERDES** — 3 bugs de CI que el billing bloqueado ocultaba:
   - `secrets.*` en `if:` (inválido) → mapear a `env` de job.
   - falta `packageManager: pnpm@11.3.0` en package.json raíz.
   - `ERR_PNPM_IGNORED_BUILDS` (pnpm 11) → **`pnpm install --frozen-lockfile --ignore-scripts`** en los 5 workflows (ni `ignoredBuiltDependencies` ni `onlyBuiltDependencies` lo silencian; los crons usan tsx con su propio esbuild).
   - + hardening de inyección en `fichas-backfill.yml`.
   - **Verificado:** `backup-parlamentario` corre **success** y pusheó el snapshot (`f38499f`). Org Workflow permissions ya permiten write (el git push funcionó).
6. **/sobre** page real (`d7c9317`, deploy `ad99a52c`): arregla el 404 del link "¿Cómo leer esto?" del home.

## Crons activos (público → Actions ilimitado/gratis)
| Workflow | Cron UTC | Estado |
|---|---|---|
| backup-parlamentario | Lun 06:00 | ✅ verde verificado |
| agenda-weekly | Lun 11:00 | wired (DEEPSEEK+R2); validado por dry-run |
| leyes-weekly | Vie 20:00 | wired; validado por dry-run (136 boletines candidatos) |
| deploy-cloudflare / backfill / fichas-backfill | manual | wired |

## Revisión de demo-readiness (enjambre Sonnet + Opus) — veredicto
**El sitio está funcional y wired** (pipelines, data-contract app↔DB, PII shielding: todo verde por validadores Opus). Los gaps NO son de código sino de **COBERTURA DE DATOS**:
- Lobby: 12.631 reuniones en DB pero solo **28.8% linkeadas** a parlamentario (parlamentario_id NULL) → invisibles en perfiles.
- Votaciones: ~2 boletines (histórico sin backfill).
- 8 `proyecto_ficha` en `estado=error` (PDF escaneado / RUT-bloqueado).
- patrimonio/financiamiento: placeholders.
Esto es exactamente lo que ataca el **milestone v4** (abajo).

## Próximo milestone — `.planning/MILESTONE-v4-cruces.md`
Plan secuenciado y ejecutable autónomamente de las **10 mejoras priorizadas** (ingesta 3 fuentes estrella → entity resolution → capa de cruces → perfil de conflicto + visualizaciones → alertas/API → calidad/frescura → legal). Generado por enjambre Sonnet + validadores Opus. Camino crítico: #1 ingesta + #3 entity-resolution habilitan #2 cruces, que habilitan #6/#8; #10 legal **gatea** exponer patrimonio/financiamiento. (El usuario es abogado y aprobó publicar datos públicos; #10 se enfoca en PII de terceros.)

## Decisión abierta anotada — `docs/DECISION-cadencia-ingesta.md`
Citaciones se modifican/suspenden hasta ~martes → el cron semanal lunes queda stale. Recomendación cerrada: **hash-check primero**, luego diario L–V solo para citaciones (ampliar el cron sin hash-check martillaría el WAF de Cámara). No implementado.

## Gotchas operativos (repetidos, anotar)
- **Docker build → PowerShell, NO git-bash** (MSYS mangla `/host/...`). Build OpenNext en Linux/Docker (Windows da 500 en runtime).
- **psql:** `PGCLIENTENCODING=UTF8` para SELECT con tildes (LATIN1 rompe al emitir). DDL: `--single-transaction` + registrar fila en `schema_migrations`.
- **CI pnpm:** install necesita `--ignore-scripts`.
- **tsx en Windows:** `node packages/<pkg>/node_modules/tsx/dist/cli.mjs <script>`.
- Build/deploy: `docker-cf-build.sh` → `docker cp .open-next` → `wrangler deploy` (ya autenticado).

## Pendiente del operador (no-código)
- Re-confirmar secrets en Cuchecorp/gov-map si algún cron falla (checklist `docs/TRANSFER-to-cuchecorp.md`).
- Decidir arranque del milestone v4 (autónomo por fase).
