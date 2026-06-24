# Requirements — Milestone v4.0 De datos a cruces verificables

**Defined:** 2026-06-24
**Core Value:** La ciudadanía puede responder, sobre cualquier proyecto o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar nunca intención ni causalidad.

**Diseño LOCKED:** El roadmap completo (Fases 0–5, WHAT/WHY/REPO TARGETS/ACCEPTANCE/AUTONOMY por sub-fase, correcciones de validadores Opus aplicadas) vive en `.planning/MILESTONE-v4-cruces.md` y es la fuente de verdad. Este documento extrae los requisitos verificables; el ROADMAP los mapea a numeración continua (Phases 33+). Requisitos de v3.0 archivados en `.planning/milestones/v3.0-REQUIREMENTS.md`.

**Premisa (LOCKED):** El shell de producto y los datos por carril ya existen (v1.0–v3.0). v4 construye los **cimientos de datos e identidad de terceros**, luego la **capa derivada de cruces** (parlamentario↔sector), luego las **superficies de ficha** — todo **deny-by-default**. Nada sensible se enciende sin firma humana (F13 MONEY, F17 NET, sign-off de cruces). ChileCompra/SERVEL/MONEY están bloqueados por la brecha RUT-01 (RUT ausente en la maestra) y se difieren explícitamente.

**Data posture (LOCKED):** minimización + trazabilidad estricta. RUT NUNCA cruza al LLM (`assertNoRutInLlmInput`); personas jurídicas se identifican SOLO por RUT exacto (sin LLM, fail-closed); terceros deny-by-default; RPCs públicos jamás proyectan rut/partido/email/donante_id. Las señales de cruce son conteos factuales, nunca scores de correlación; linter de texto prohíbe vocabulario causal/insinuante. Convención de ingesta de dos etapas (Fuente→R2 crudo→Supabase), rate-limit 2–3s, degradación honesta (nunca fabricar). DDL por `psql --db-url --single-transaction` + fila en `schema_migrations` (NUNCA `db push`); pgTAP es la única prueba válida.

---

## v4.0 Requirements

### INFRA — Desbloqueo de CI (Fase 0, transversal)

> Blocker que mata cualquier workflow programado antes de tocar la red. Barato, desbloquea toda la Fase 1.

- [x] **INFRA-01**: Los CLIs estrella de ingesta (`run-camara-lobby-cli`, `run-probidad-todos-cli`) cargan credenciales con fallback a `process.env` (no solo `.env` en disco) → corren en GitHub Actions sin `.env`. ✅ Ejecutado (quick task 260623-rtl, commits 1844b2f/399e3e2).

### INGEST — Ingesta lobby + probidad programada (Fase 1.1)

> Los pipelines ETL existen completos (writers reales, reconciliación de identidad) pero nunca fueron programados. Lobby ya tiene R2; probidad no. ChileCompra/SERVEL NO se programan aquí (RUT-01).

- [ ] **INGEST-01**: El workflow `lobby-camara-weekly` corre en dispatch manual, pasa el WAF de camara.cl vía `curl` (fail si respuesta < 10 KB) con `--html-file`, loguea `audiencias=N>0` y escribe `lobby_audiencia` con `estado_vinculo='confirmado'` para los matches deterministas.
- [ ] **INGEST-02**: El workflow `lobby-leylobby-weekly` (instituciones del ejecutivo; Cámara/Senado NO publican en leylobby.gob.cl) loguea `audiencias=N>0` o degrada honesto con `LeylobbyBloqueadaError`.
- [ ] **INGEST-03**: El workflow `probidad-weekly` corre las ~155–200 consultas SPARQL (rate-limit 3s, dentro de límites GH), loguea `declaraciones/bienes/confirmados>0` y escribe filas `declaracion` con `parlamentario_id` no nulo.
- [ ] **INGEST-04**: La provenance run-level de cada corrida se persiste vía la tabla `source_snapshot` existente + `SnapshotWriter` (NO un `crudo_r2_key` paralelo sobre tablas per-parlamentario): tras un run LIVE, `source_snapshot` tiene una fila por run con `r2_path` poblado. Incluye el paso R2 crudo faltante en `run-probidad-todos.ts` (espejo de `run-camara-lobby.ts`, best-effort try/catch).

### ENT — Resolución de identidades de terceros (Fase 1.2)

> Hoy `lobby_contraparte.contraparte_id` y `contratista` quedan NULL por diseño (no hay maestra de terceros). Prerrequisito de la corrección de los cruces.

- [ ] **ENT-01**: Existe la maestra `entidad_tercero` (+ `entidad_tercero_alias`, sequence `entidad_id_seq`, trigger anti-demotion espejo de 0007/0012, RLS deny-by-default) y las tablas `vinculo_entidad` + `revision_entidad` (espejo de `revision_identidad`), aplicadas por `psql --db-url` con pgTAP verde.
- [ ] **ENT-02**: El matcher determinista `matchDeterministaEntidad` confirma por RUT-único o nombre-único-por-tipo; toda ambigüedad → `no_confirmado` (fail-closed). Personas jurídicas: SOLO por RUT exacto, nombre-sin-RUT → siempre `no_confirmado` (nunca LLM). Persona natural usa LLM solo ante homónimos, con `assertNoRutInLlmInput` sobre el prompt (≥10 tests; el test falla si un RUT se cuela al prompt).
- [ ] **ENT-03**: Los reconciliadores existentes escriben el FK resuelto: `reconciliar-sujeto.ts` puebla `lobby_contraparte.contraparte_id` confirmado (antes siempre null); `reconciliar-contrato.ts` puebla `contratista.entidad_id`. RPC transaccional `resolver_entidad` (espejo de 0015).
- [ ] **ENT-04**: Los matches dudosos van a la cola `revision_entidad` (estado `pendiente`); ningún match dudoso se promueve a `confirmado` sin revisor humano vía RPC `resolver_entidad`. UI admin protegida `revisar-entidades`.
- [ ] **ENT-05**: El backfill de entidades es LOCAL (operador), idempotente/reanudable: una 2ª corrida produce 0 entidades/vínculos nuevos. La maestra se exporta a JSON fuera de Supabase (custodia, espejo de `backup.ts`).

### CRUCE — Capa de cruces parlamentario↔sector (Fase 2.1)

> El valor diferenciador y el dato de mayor impacto reputacional. Construible deny-by-default; NO publicable sin gate legal (Fase 4).

- [ ] **CRUCE-01**: Existe el catálogo `sector` (public-read) + `sector_id` en `proyecto_ficha`, `lobby_contraparte` y `donante`; la tabla `cruce_senal` (deny-by-default, fila única parlamentario+sector+evidencia jsonb — NO espejo de `arista`); el materializador `materializar_cruces()` (security definer, `search_path=''`, pg_cron con offset); y el RPC `cruces_de_parlamentario` SIN grant a anon hasta firma. Migraciones por `psql --db-url`, pgTAP: `sector` public-read, `cruce_senal` deny-by-default, el cuerpo del materializador no referencia partido ni RUT.
- [ ] **CRUCE-02**: El etiquetado de sector usa un schema/pipeline/golden SEPARADO del flujo de extracción literal (clasificar a taxonomía cerrada es imputación, no extracción literal — rompería SEM-02). La clasificación corre en un CLI batch de `@obs/cruces` (etapa derivada), NUNCA por fila dentro del writer. Sensibilidad LLM correcta para contrapartes (no `sensitivity:'public'`, Ley 21.719 / FND-06). CLI `--dry-run` sobre 10 proyectos: ≥7 con `sector_id` no nulo medido contra su propio golden.
- [ ] **CRUCE-03**: Tras materializar con los datos de lobby actuales, `cruce_senal` tiene ≥1 fila `lobby_sector_aporte` para ≥5 parlamentarios. Las señales derivadas de voto (`lobby_sector_voto`/`aporte_sector_voto`) arrancan OFF (chocan con 17-LEGAL-DOSSIER §2) hasta sign-off explícito. Wording factual obligatorio ("N reuniones con gestores del sector X", sin verbo causal); el RPC nunca proyecta rut/partido/email/donante_id (pgTAP).

### SURF — Superficies de cruces en ficha (Fase 3)

> Consumen `cruce_senal`. Construibles tras la capa de cruces; visibles solo tras gate.

- [ ] **SURF-01**: `CrucesSection` (Server Component) en la ficha de parlamentario renderiza las señales factuales con provenance inline, sibling de `#lobby`/`#patrimonio` (nunca anidado — anti-insinuación §9.1), detrás de `crucesPublicEnabled()` (default OFF, espejo de `money-gate.ts`/`net-gate.ts`). Con gate ON renderiza sin error de hidratación; con gate OFF la sección no monta; empty honesto si cero cruces; sin verbo causal (linter); cada evidencia trazable al enlace original (FND-08).
- [ ] **SURF-02**: `cruces_de_proyecto(boletin)` + `CrucesSection` en la ficha de proyecto (parlamentarios que votaron a favor con cruces en el sector del proyecto), PII-safe (proyección vía `parlamentario_publico`, nunca rut/partido), mismo gate. Hereda la advertencia anti-insinuación de las señales de voto → **se difiere si las señales de voto quedan OFF**.

### LEGAL — Gate legal transversal (Fase 4, #10)

> No es una fase tardía sino el gate que controla la exposición de todo lo sensible. Un agente autónomo NUNCA flipea estos flags.

- [ ] **LEGAL-01**: Revisión legal humana (Ley 21.719) que habilita los flags `MONEY_PUBLIC_ENABLED` (aportes/contratos), `netPublicEnabled` (datos de red) y `crucesPublicEnabled` (señales de cruce). Requiere firmas F13 (MONEY, `docs/legal/13-LEGAL-DOSSIER.md`) y F17 (NET, `17-LEGAL-DOSSIER.md`) + sign-off de cruces registrados; flags encendidos por el operador en Cloudflare Pages; despliegue verificado. MONEY también depende de RUT-01; NET es doble-candado (RLS + flag). **Acción exclusivamente humana.**

### RUTM — RUT-01 + ChileCompra/SERVEL (Fase 5, diferido)

> Bloqueado por RUT-01 (prerrequisito duro no resuelto por estos diseños) + F13. Se difiere explícitamente en lugar de fingir que el CLI demo es un pipeline.

- [ ] **RUTM-01**: Cosecha de RUT a la maestra (`backfill-rut.ts`), DV-válido + provenance, NUNCA fabricar un RUT. Acción de operador (needs-human-checkpoint).
- [ ] **RUTM-02**: Wire real de ChileCompra (hoy CLI demo: maestra vacía, RUT hardcodeado, falta `MERCADOPUBLICO_TICKET`): `run-dinero-prod-cli.ts` (carga maestra + `TareaRut[]` de la semana) + workflow `dinero-chilecompra-weekly` + bloque R2/`SnapshotWriter` en `ingest-run.ts`. Degrada a dry-run sin ticket → assert post-run `if [ $CONTRATOS -eq 0 ]; exit 1`. Con ticket y RUTs reales: `contratos=N>0`, cruce por RUT confirmado.
- [ ] **RUTM-03**: Workflow `dinero-servel-manual` (`workflow_dispatch` only, URL Azure Blob por elección provista por el operador): con datos reales, `aportes=N>0`. Exposición pública requiere LEGAL-01.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Encender cualquier flag `*_PUBLIC_ENABLED` por un agente autónomo | LOCKED: gate humano. El "flip por quality floor" del diseño #1 está eliminado. |
| Señales de cruce derivadas de voto (`co_votacion`, `*_sector_voto`) en el MVP | 17-LEGAL-DOSSIER §2 (anti-insinuación); arrancan OFF, requieren re-justificación legal. |
| Lobby del Senado | No hay portal equivalente confirmado (leylobby = solo ejecutivo). |
| Scores de correlación / afirmación de causalidad | Regla rectora; las señales son conteos factuales con wording sin verbo causal. |
| Exposición pública de RUT / donante_id / partido / email | Minimización (Ley 21.719); RPCs públicos jamás los proyectan; RUT nunca al LLM. |
| ChileCompra/SERVEL a escala sin RUT-01 | Sin RUT, ChileCompra cruza cero parlamentarios; se difiere a Fase 5 en vez de fingir cobertura. |

## Traceability

Mapeo a fases del ROADMAP (numeración continúa desde v3.0 — Phase 32 fue la última; v4.0 arranca en Phase 33). El detalle de diseño por sub-fase vive en `.planning/MILESTONE-v4-cruces.md`.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 33 | Complete |
| INGEST-01 | Phase 34 | Pending |
| INGEST-02 | Phase 34 | Pending |
| INGEST-03 | Phase 34 | Pending |
| INGEST-04 | Phase 34 | Pending |
| ENT-01 | Phase 35 | Pending |
| ENT-02 | Phase 35 | Pending |
| ENT-03 | Phase 35 | Pending |
| ENT-04 | Phase 35 | Pending |
| ENT-05 | Phase 35 | Pending |
| CRUCE-01 | Phase 36 | Pending |
| CRUCE-02 | Phase 36 | Pending |
| CRUCE-03 | Phase 36 | Pending |
| SURF-01 | Phase 37 | Pending |
| SURF-02 | Phase 38 | Pending |
| LEGAL-01 | Phase 39 | Pending |
| RUTM-01 | Phase 40 | Pending |
| RUTM-02 | Phase 40 | Pending |
| RUTM-03 | Phase 40 | Pending |

**Coverage:**
- v4.0 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-24*
*Last updated: 2026-06-24 after initial definition (transcribed from .planning/MILESTONE-v4-cruces.md)*
