# Phase 118: CRON-AUDIT — Veredicto por cron con evidencia - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 2 (1 artefacto rector + 1 script de cierre opcional)
**Analogs found:** 2 / 2 (ambos con match exacto de rol y flujo)

Esta es una fase de **documentación/auditoría read-only**: no se crea ni modifica código
fuente. El único deliverable obligatorio es `118-CRON-VERDICTS.md`. La analogía es de
**anatomía de documento**, no de imports/API.

---

## File Classification

| Archivo a crear | Rol | Flujo de datos | Analog más cercano | Calidad del match |
|---|---|---|---|---|
| `.planning/phases/118-cron-audit-.../118-CRON-VERDICTS.md` | audit-artifact (documento rector de fase) | observe → judge → gap-list (consumido por 119) | `.planning/milestones/v6.0-phases/56-cron-audit-.../56-CRON-AUDIT.md` | **exacto** — mismo dominio (crons), mismo consumidor (fase FIX siguiente) |
| `118-CRON-VERDICTS.md` (front-matter + método + límites + verificación de cierre) | audit-artifact (convención v12.0) | idem | `.planning/phases/116-fecha-audit-.../116-FECHAS-AUDIT.md` | **exacto de forma** — es el audit-artifact más reciente y el estándar vigente del milestone |
| `check-crons.sh` (OPCIONAL — solo si el plan decide gate automatizado) | test/gate script | validación de completitud del propio doc | `.planning/phases/116-fecha-audit-.../check-fechas.sh` | exacto |

**Regla de fusión:** 56 aporta el **contenido y las secciones de dominio cron**; 116 aporta la
**forma v12.0** (front-matter YAML, §0 Método, §Límites, §Verificación de cierre). El documento
118 debe ser 56 **reencuadrado** en el chasis de 116. La RESEARCH lo dice explícitamente:
"clonar la anatomía de `56-CRON-AUDIT.md`" con "la taxonomía nueva verde/stale/roto".

---

## Pattern Assignments

### `118-CRON-VERDICTS.md` (audit-artifact, observe→judge→gap-list)

**Analog primario (dominio):** `.planning/milestones/v6.0-phases/56-cron-audit-auditor-a-e2e-de-los-9-workflows-de-ingesta/56-CRON-AUDIT.md`
**Analog secundario (forma v12.0):** `.planning/phases/116-fecha-audit-sem-ntica-de-cada-fecha-visible/116-FECHAS-AUDIT.md`

#### Patrón 1 — Front-matter YAML de audit-artifact (COPIAR de 116, líneas 1-24)

```yaml
---
phase: 116
titulo: Auditoría semántica de fechas
requirement: FECHA-01
consumido_por: [117, 125]
regimen: solo-lectura
ancla_temporal: 2026-07-28
timezone_del_servidor_prod: UTC
gates_observados:
  fuente: "113-INVENTARIO.md §5"
  fecha_de_esa_observacion: 2026-07-27
  heredada: true
  MONEY: "OFF — /contraparte/[id] 404ea entera; contrato y aporte con 0 filas en PROD"
fuentes:
  - 116-FORMATTERS.md
  - 113-INVENTARIO.md
---
```

**Adaptación para 118:** `phase: 118`, `requirement: CRON-01`, `consumido_por: [119]`,
`regimen: solo-lectura`, `ancla_temporal: <fecha del probe>`, `repo_remoto: Cuchecorp/gov-map`,
`fuentes: [.github/workflows/*.yml, cron.job (DB viva), packages/freshness/src/catalog.ts]`.
Añadir `caducidad: ~14 días` (RESEARCH declara que los veredictos caducan rápido).
Nótese el idiom `heredada: true` para toda observación no re-verificada en esta fase — 118
debe usarlo si reutiliza cifras de 110-02 sin re-probarlas.

#### Patrón 2 — Cabecera de identidad de auditoría (COPIAR de 56, líneas 1-6)

```markdown
# Auditoría E2E de Ingesta — Phase 56 CRON-AUDIT

Fecha: 2026-07-08
Repo remoto: Cuchecorp/gov-map
Auditor: Claude (Sonnet 4.6) + probes live gh CLI / psql / R2 (SigV4 directo)
Fase siguiente: Phase 57 (CRON-FIX) — la gap-list es su backlog directo.
```

**Adaptación:** "Fase siguiente: Phase 119 (CRON-FIX) — la gap-list es su backlog directo."
Declarar las 4 patas de evidencia en vez de "probes live".

#### Patrón 3 — §0 Método con comandos verbatim re-ejecutables (COPIAR de 116, líneas 36-99)

116 abre con `### 0.1 Qué se auditó` (universo + denominador derivado, no hardcodeado),
`### 0.2 Cómo`, `### 0.3 Qué NO hace` (el régimen), `### 0.4 reglas LOCKED verbatim`,
`### 0.5 Comandos re-ejecutables`:

```markdown
### 0.3 Qué NO hace

Esta fase **no corrige nada**. No modifica `app/`, no modifica `packages/`, no toca `.env` ni
ningún flag, no aplica migraciones. Todo fix va a **Phase 117**. Un hallazgo aquí es un encargo
consumible, no un cambio aplicado.

### 0.5 Comandos re-ejecutables

```bash
# 3) Cruce contra PROD (read-only; la URL jamás se imprime)
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "select now()::date, current_setting('TimeZone');"
```
```

**Adaptación:** `### 0.4` debe llevar **verbatim** la taxonomía LOCKED de `118-CONTEXT.md`
(verde/stale/roto + definición de cadencia esperada + skip legítimo ≠ stale), igual que 116
citó las tres reglas LOCKED con `>` blockquote. `### 0.5` toma los comandos ya escritos en
`118-RESEARCH.md` §"Comandos de probe" (gh / psql / freshness / source_snapshot) sin
reinventarlos. Conservar el idiom `set -a; source .env; set +a` + `PGCLIENTENCODING=UTF8` y el
comentario "la URL jamás se imprime".

#### Patrón 4 — Tabla maestra resumen (COPIAR estructura de 56, líneas 12-22)

```markdown
| # | Workflow | Schedule | Trigger | Secrets requeridos | Secrets presentes | Última corrida real | Veredicto |
|---|----------|----------|---------|-------------------|-------------------|---------------------|-----------|
| 1 | agenda-weekly | Mon 11:00 UTC (`0 11 * * 1`) | schedule + dispatch | SUPABASE_API_URL, ... | 2/7 | 2026-07-06 (success) | CORRE-CON-GAPS |
```

**Adaptación obligatoria para 118 (CONTEXT + RESEARCH):** columnas
`# | unidad de cron | tipo (GH workflow / pg_cron / platform-managed) | schedule real | entrypoint invocado (archivo:línea del YAML) | tabla destino | pata 1 (última corrida) | pata 2 (última fila) | pata 3 (freshness) | VEREDICTO | causa (archivo:línea o dato)`.
La columna "entrypoint invocado" es nueva y no negociable (gotcha 57-05, Pitfall 1 del
RESEARCH); 56 no la tenía y ese fue exactamente su gap. Poblarla desde la tabla maestra
YAML→entrypoint→tablas ya resuelta en `118-RESEARCH.md`.
Bajo la tabla, replicar el bloque de 56 líneas 24-28 (inventario de secrets confirmados con
fecha de creación, **nombres solamente**) — pero comparando contra el lado `secrets.*`
derecho, no el `env:` izquierdo (Pitfall 5).

#### Patrón 5 — Sección por unidad de cron (COPIAR de 56, líneas 34-76 = plantilla W-1)

Anatomía de cinco bloques por workflow, repetida 9 veces en 56:

```markdown
### W-1: agenda-weekly

**YAML:** `.github/workflows/agenda-weekly.yml`
**Schedule:** `0 11 * * 1` (lunes 11:00 UTC)
Veredicto: CORRE-CON-GAPS
**Causa raíz del veredicto:** Corre sin errores fatales, pero Etapa-1 (R2) es no-op porque
faltan 5 secrets (DEEPSEEK_API_KEY + 4 R2) y la ruta Etapa-2-from-R2 no existe.

#### Cadena de ingesta

| Etapa | Implementada | Estado | Archivo:Línea |
|-------|-------------|--------|---------------|
| Etapa-1 fuente→R2 | Parcial | No-op (R2 secrets ausentes en repo) | `packages/agenda/src/ingest-run.ts:218` |
| Etapa-2 desde R2 | No | No implementada (lee resultado en memoria) | `packages/agenda/src/ingest-run.ts` |
| Hash-check pre-descarga | Parcial | Comprueba clave ISO-semana, no sha256/ETag | `packages/agenda/src/ingest-run.ts` |

#### DOS ETAPAS compliance

- **Etapa-1 (fuente→R2):** parcial — código presente (...), pero silenciado: R2 secrets ausentes.
- **Etapa-2 (R2→Supabase, re-ingest sin tocar fuente):** no cumple — ...
- **Hash-check:** parcial — ...
- **Rate-limit 2-3s:** cumple — `HostRateLimiter` inyectado en `.../run-agenda-prod-cli.ts`.
- **UA identificatorio:** cumple — `Bot-Ciudadano/1.0` ...
- **robots.txt:** cumple — `RobotsGuard` inyectado ...

#### Gaps de este workflow

G1, G2, G3 (ver sección Gap-list)

#### Cómo re-verificar

```bash
gh run list --repo Cuchecorp/gov-map --workflow agenda-weekly.yml --limit 5
gh run view <LAST_RUN_ID> --repo Cuchecorp/gov-map --log-failed | head -30
gh secret list --repo Cuchecorp/gov-map
```
```

**Adaptación:** el `Veredicto:` pasa a `verde | stale | roto` (+ `no-cron por diseño` para los
sin schedule, con la causa declarada citando el comentario del YAML — Pitfall 3).
El bloque "DOS ETAPAS compliance" se **conserva** (`118-RESEARCH.md` §Project Constraints lo
pide explícitamente). Se añade un bloque nuevo **"Evidencia observada"** con las 3-4 patas y su
salida recortada, porque la regla de validación de 118 es más dura que la de 56: *"toda celda de
evidencia debe llevar (a) el comando exacto y (b) la salida capturada"*. Donde una pata no
aplica (freshness no cubre actualidad/digest/backup/pg_cron), **declararlo** en vez de omitirlo.
El bloque `#### Cómo re-verificar` es obligatorio por unidad (56 lo tiene 9/9 y su propio gate
lo cuenta).

#### Patrón 6 — Gap-list consolidada priorizada (COPIAR de 56, líneas 430-454)

```markdown
| # | Gap | Severidad | Workflow | Archivo:Línea | Fix propuesto (Phase 57) |
|---|-----|-----------|----------|---------------|--------------------------|
| G4 | `tramitacion_evento` upsert `ON CONFLICT DO UPDATE ...` | CRITICAL | leyes-weekly | `packages/tramitacion/src/writer-supabase.ts`; `writer.ts:8` | Deduplicar eventos por clave compuesta antes del batch upsert |
| G7 | WAF `camara.cl` bloquea IPs de GitHub Actions — 5463 bytes < gate 10 KB | CRITICAL | lobby-camara-weekly | `.github/workflows/lobby-camara-weekly.yml:49-54` | Investigar endpoint alternativo (API `doGet.asmx`) ... |
```

Notas de forma que 118 debe conservar: ids `G1..Gn` **estables** referenciados desde cada
sección de workflow; tabla **ordenada por severidad** (CRITICAL → HIGH → MEDIUM → LOW), no por
id; columna `Archivo:Línea` siempre poblada; columna de fix apuntando a la fase siguiente.
**Adaptación:** severidad pasa a la escala del CONTEXT — `P0` (roto accionable) / `P1` (stale
accionable) / `P2` (deuda operador) — y la última columna se titula `Fix propuesto (Phase 119)`
con **pasos concretos**, no un verbo genérico. Nótese en 56 el patrón G23: gap **sistémico**
transversal ("TODOS los conectores activos") con varios `archivo:línea` en una celda — 118 lo
necesitará para el hueco de instrumentación de freshness y para los YAML fantasma.

**Índice compacto complementario (COPIAR de 116, líneas 841-856):** 116 antepone al detalle una
tabla índice `| id | severidad | emisores | superficie | archivo principal |` cerrada con el
conteo (`**14 hallazgos: 6 miente, 8 ambigua.**`). Vale la pena replicarla como cabecera de la
gap-list de 118 (`| Gn | P0/P1/P2 | unidad de cron | pata que lo detectó | archivo principal |`)
seguida del conteo por prioridad.

#### Patrón 7 — Resolución de Assumptions con evidencia (COPIAR de 56, líneas 234-237 y 530-534)

Dos niveles: en línea dentro de la sección del workflow (`#### Resolución A1`, con **Claim /
Resultado (probe Pn) / veredicto parcial-o-total**) y una tabla consolidada al final:

```markdown
| ID | Claim original | Resultado | Evidencia |
|----|---------------|-----------|-----------|
| A1 | probidad 2026-07-02: 0 resultados SPARQL vs 0 identity matches | Parcialmente resuelto: ... causa exacta irresolvable sin log CLI completo | `SELECT COUNT(*) FROM probidad_ingesta_estado WHERE fecha_captura > '2026-07-01'` → 0 |
```

**Adaptación:** 118 hereda A1–A5 y las 4 Open Questions de `118-RESEARCH.md` — cada una debe
cerrar en esta tabla con su probe. El idiom "**parcialmente resuelto**, causa exacta
irresolvable sin X" es el precedente para no sobre-afirmar cuando el log no está disponible.

#### Patrón 8 — Tablas de estado observado (COPIAR de 56, líneas 477-508)

56 cierra con dos tablas de estado que 118 debe re-hacer con datos frescos:
`## Observabilidad — Estado de tablas` (`| Tabla | Definida en | Escrita por | Estado actual |
Última entrada (probe FECHA) |`) y `## Frescura baseline (FECHA)`
(`| Fuente / Tabla | Última fecha observada | Probe |`), esta última con el probe SQL literal
por fila. Debajo, viñetas de **Observaciones de frescura** interpretando la tabla.
Añadir para 118 una tabla equivalente para `cron.job` × `cron.job_run_details` (el delta
migración↔vivo es hallazgo de primera clase según las Open Questions).

#### Patrón 9 — §Límites declarados (COPIAR de 116, líneas 953-991)

```markdown
## 6. Límites

Lo que esta fase **no** pudo cerrar, y por qué. Un límite declarado es un resultado válido; uno
silenciado, no.

1. **Emisores bajo gate MONEY sin datos en PROD.** ... El veredicto queda **respaldado solo por
   código y schema**, no por dato observado. ... No se encendió ningún flag para cerrar este
   límite: hacerlo habría violado el régimen de la fase.
```

**Adaptación:** aquí van, numerados, (a) el checkpoint de operador sin responder (deuda 110-02),
(b) las unidades sin pata 3 por hueco de catálogo, (c) logs de `gh run view` no recuperables,
(d) R2 no verificado exhaustivamente (solo proxy `source_snapshot`), (e) veredictos con
caducidad ~14 días. El tono es el del analog: el límite se **declara**, no se disfraza de
cobertura. 56 tiene el equivalente en `## Estado de billing GitHub Actions` (líneas 512-524),
donde una conclusión negativa —"billing NO bloqueado"— se sostiene con la enumeración de las 11
corridas y su comando reproducible; 118 debe cerrar la pregunta de billing igual.

#### Patrón 10 — §Verificación de cierre auto-comprobable (COPIAR de 56, líneas 563-577)

56 termina con greps que validan el **propio documento**:

```bash
grep -cE "Veredicto: (VERDE|CORRE-CON-GAPS|NO-CORRE|NO-APLICA-CRON)" .../56-CRON-AUDIT.md
# → debe ser 9

grep -cE "G[0-9]+.*\.(ts|yml|sql):[0-9]+" .../56-CRON-AUDIT.md
# → debe ser ≥ 20

# Verificación de no-secrets: debe retornar 0 matches
grep -icE "sk.{1}[a-z0-9-]{10,}" .../56-CRON-AUDIT.md
# → debe ser 0

grep -c "Cómo re-verificar" .../56-CRON-AUDIT.md
# → debe ser ≥ 9
```

**Adaptación directa a los SC de `118-RESEARCH.md` §Validation Architecture:**
SC1 → `grep -c "Veredicto: \(verde\|stale\|roto\|no-cron\)"` == (13 YAML + 2 platform-managed +
N de `cron.job`), con los tres conteos declarados en el doc; SC2 → cada fila cita ≥1 `gh` y ≥1
`psql`; SC3 → `grep -cE "G[0-9]+.*\.(ts|yml|sql):[0-9]+"`; SC4 → gaps con id + P0/P1/P2 + pasos.
El grep anti-secreto es **obligatorio** y se conserva tal cual.
Cerrar con la línea de firma de 56 (línea 581): resumen de probes usados + *"Ningún valor de
secret fue impreso en este documento."*

---

### `check-crons.sh` (test/gate script — OPCIONAL, decisión del planner)

**Analog:** `.planning/phases/116-fecha-audit-sem-ntica-de-cada-fecha-visible/check-fechas.sh`

**Cabecera y contrato (líneas 1-38):**

```bash
#!/usr/bin/env bash
# check-fechas.sh — checklist re-ejecutable de completitud del artefacto 116-FECHAS-AUDIT.md
#
# Régimen de STRICT:
#   STRICT=0 (default) — reporta faltas SIN fallar (exit 0 siempre). Modo reporte.
#   STRICT=1           — cualquier falta => exit 1. Es el modo del cierre de fase.
#
# Portabilidad: bash + POSIX grep/awk. NO usa la opción PCRE de grep (no disponible aquí).
# Read-only: no escribe nada, no toca la DB, no toca la red. Corre en segundos.
#
# El denominador de ids NO está hardcodeado: se deriva de 113-INVENTARIO.md §3.0 con la
# regla de celda LOCKED. El número 38 es un ANCLA de sanidad, no la fuente:
# si el awk devuelve otro número el script lo REPORTA con el diff de ids. Jamás se ajusta
# el esperado para que pase.

set -u
STRICT=${STRICT:-0}
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../../.." && pwd)
ESPERADO=38
cd "$REPO_ROOT" || exit 1
FALTAS=0
falta() { FALTAS=$((FALTAS + 1)); echo "FALTA $1"; }
```

**Adaptación:** denominador derivado de `ls .github/workflows/*.yml | wc -l` + ancla de sanidad
13, nunca hardcodeado; `ESPERADO` como ancla que se **reporta**, jamás se ajusta para pasar
(regla de oro del analog). Si el planner decide no crear el script, los greps del Patrón 10
deben quedar embebidos en `## Verificación de cierre` del documento — el gate no puede
desaparecer.

---

## Shared Patterns

### Higiene de secretos (aplica a todo bloque de evidencia)
**Fuente:** `56-CRON-AUDIT.md:24-28, 262, 572-573` + `116-FECHAS-AUDIT.md:91-93`
```bash
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "select ...;"   # la URL jamás se imprime
gh secret list --repo Cuchecorp/gov-map                              # NOMBRES + fecha, nunca valores
```
Además: 56 comenta las líneas psql con `#` dentro de los bloques "Cómo re-verificar" para que
nadie las ejecute a ciegas pegando el bloque. Grep anti-secreto al cierre. Ningún log de
`gh run view` se pega completo: solo las líneas de error recortadas.

### Cita de evidencia: `archivo:línea` o dato con timestamp
**Fuente:** `56-CRON-AUDIT.md:432-454` (columna Archivo:Línea) y `116-FECHAS-AUDIT.md:539-561`
(campo `**archivo:línea:**` en cada hallazgo)
Aplica a: **toda** causa de veredicto ≠ verde. Un veredicto sin puntero es inválido (SC3).

### Distinguir decisión declarada de gap
**Fuente:** `56-CRON-AUDIT.md:276, 366, 401` ("Causa raíz del veredicto: Diseñado como backfill
manual…", "Workflow de prueba/placeholder…") + `118-RESEARCH.md` Pitfall 3
Aplica a: `lobby-camara-weekly` (WAF, causa en YAML:14-17), `digest-daily`/`roster-weekly`
(schedule comentado), MONEY/SERVEL sin cron. Antes de marcar gap: buscar el comentario en el
YAML o la nota en la migración y **citarlo**.

### Anclaje temporal explícito
**Fuente:** `116-FECHAS-AUDIT.md:7` (`ancla_temporal`) y `56-CRON-AUDIT.md:489`
(`## Frescura baseline (2026-07-08)`)
Aplica a: toda tabla de estado observado lleva la fecha del probe **en el título**, no solo en
el front-matter. Los veredictos de 118 caducan en ~14 días.

### Cierre de fase con conteos declarados
**Fuente:** `116-FECHAS-AUDIT.md:855-856` ("**14 hallazgos: 6 miente, 8 ambigua.** Emisores
citados: **28** de los 38 del denominador")
Aplica a: 118 debe declarar los tres conteos de SC1 (13 YAML locales + 2 platform-managed + N
de `cron.job`) y el conteo de gaps por prioridad, explícitamente en el texto.

---

## No Analog Found

Ninguno. Ambos artefactos previstos tienen analog exacto en el repo.

Dos elementos **sin precedente directo** dentro del analog de dominio (56), que el planner debe
diseñar tomando la forma de 116:

| Elemento | Por qué no hay analog exacto | Guía |
|---|---|---|
| Filas de `pg_cron` en la tabla maestra | 56 auditó solo GH Actions; ningún audit previo enumeró `cron.job` vivo | Misma anatomía de fila; patas 1 y 2 se sustituyen por `cron.job_run_details.status/return_message` y por la tabla/vista que el comando materializa |
| Filas platform-managed (Dependabot, CodeQL) | descubiertas en el probe de research, no versionadas en el repo | Fila enumerada con veredicto `no-ingesta / platform-managed`, sin patas 2-3, causa = "no versionado en `.github/workflows/`" — cierra SC1 contra la realidad remota |

---

## Metadata

**Analog search scope:** `.planning/milestones/v6.0-phases/56-*/`, `.planning/phases/113-*/`,
`.planning/phases/116-*/`
**Files scanned:** 4 leídos (56-CRON-AUDIT.md íntegro; 116-FECHAS-AUDIT.md por rangos;
check-fechas.sh cabecera; 113-INVENTARIO.md por índice de encabezados)
**Pattern extraction date:** 2026-07-28
