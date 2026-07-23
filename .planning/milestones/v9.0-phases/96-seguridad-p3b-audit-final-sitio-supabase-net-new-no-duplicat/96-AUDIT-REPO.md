# 96 — AUDITORÍA REPO PÚBLICO (plan 01)

**Fase:** 96-seguridad-p3b-audit-final-sitio-supabase-net-new-no-duplicat
**Ejecutado:** 2026-07-23
**Herramientas:** gitleaks 8.30.1 (historial completo, `--redact`); pnpm audit (post-fix)
**Principio rector:** Declarar lo hallado exactamente. CERO valores de secreto en este documento — solo rule-id, archivo, commit-short y veredicto. Nada de lo listado aquí es un secreto real del proyecto.

---

## N/M declarado — gitleaks historial completo

| Ítem auditado | Resultado | Método | Veredicto |
|---|---|---|---|
| Commits escaneados | **1.709** | `gitleaks git` sobre todo el historial | — |
| Bytes escaneados | **~30,67 MB** | gitleaks | — |
| Findings totales (sin allowlist) | **6** | `gitleaks git --redact` | Ver triage abajo |
| Findings confirmados como secretos reales | **0** | Triage manual (leer nombre de constante/fixture) | VERDE |
| Findings tras aplicar `.gitleaks.toml` | **0** | `gitleaks git --redact --config .gitleaks.toml` → exit 0 | VERDE |
| Secretos reales ya-expuestos identificados por historial | **0** nuevos | B26 (DB password) conocido desde v7.0 — ya tiene runbook 75 | VERDE |

---

## Triage de findings (todos FP — cero valores impresos)

| # | rule-id | Archivo | Commit | Veredicto | Razón de descarte |
|---|---------|---------|--------|-----------|-------------------|
| 1 | generic-api-key | `packages/dinero/src/run-dinero-masivo-cli.test.ts` | 18f1dcae | **FP** | Constante de test `S3CR3T-TICKET-MASIVO-70`: fixture del guard de redacción de ticket dinero. Texto literalmente `S3CR3T` es una clave de test, no un secreto de API. |
| 2 | generic-api-key | `packages/dinero/src/ingest-run.test.ts` | 16ffe62c | **FP** | Constante de test `S3CR3T-TICKET-NO-LEAK-70`: fixture del mismo guard (prueba explícita que el ticket NUNCA se filtra). |
| 3 | generic-api-key | `packages/dinero/src/connector-chilecompra.test.ts` | 91de0f47 | **FP** | Constante de test `S3CR3T-TICKET-NO-LEAK-9f2a`: misma familia de fixtures de redacción. |
| 4 | generic-api-key | `packages/agenda/test/fixtures/camara-citaciones-semana.html` | 9798a057 | **FP** | Fixture HTML scrapeado de WebForms de la Cámara. El token `__VIEWSTATE` de ejemplo no es un secreto propio del proyecto. |
| 5 | generic-api-key | `.planning/phases/96-.../96-01-PLAN.md` | df0b5f34 | **FP** | Documento de planificación de esta fase que CITA las constantes de test como ejemplos de código. El valor es la misma cadena `S3CR3T-TICKET-*` ya triada en #1-3. |
| 6 | generic-api-key | `.planning/phases/96-.../96-PATTERNS.md` | 8b58342d | **FP** | Documento de patrones de esta fase que cita las mismas constantes de test. Mismo origen que #5. |

**Nota sobre #5 y #6:** Los findings 5 y 6 no estaban en la tabla del research original (que contaba 4), porque los documentos de la fase 96 se crearon como parte de este sprint de planificación. Son igualmente FP por idéntica razón.

**Conclusión del triage:** cero secretos reales en el historial git según gitleaks. B26 (DB password de Supabase) sigue siendo el ÚNICO secreto real ya-expuesto conocido, identificado en v7.0 (no por gitleaks), y ya tiene su runbook en `.planning/phases/75-*/75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md`.

---

## Allowlist creada: `.gitleaks.toml`

Se creó `.gitleaks.toml` en la raíz del repo con `[allowlist]` que lista los 6 paths FP.
Re-scan post-allowlist: `gitleaks git --redact --config .gitleaks.toml` → **exit 0, 0 findings**.

---

## pnpm audit — antes y después

### Antes del fix (estado inicial)

`pnpm audit --prod` reportaba **14 advisories** (6 moderate + 8 high):

| Severidad | Paquete | Título resumido | Rango vulnerable | Fix |
|-----------|---------|-----------------|-----------------|-----|
| high×3 / moderate×5 | **next** | 8 advisories: middleware bypass, SSRF Server Actions, DoS, cache confusion, image DoS, endpoint disclosure | `>=16.0.0 <16.2.11` | Bump a `>=16.2.11` |
| high | brace-expansion | DoS regex `{}` | `<2.1.2` | Override `>=2.1.2` |
| moderate | protobufjs | DoS `.proto` parsing | `<=7.6.4` | Override `>=7.6.5` |
| high | sharp | libvips CVEs | `<0.35.0` | Override `>=0.35.0` |

### Fix aplicado

1. **Bump Next en `app/`:** `pnpm add next@^16.2.11` → instaló `next@16.2.11` exacto
2. **Overrides transitivos en `pnpm-workspace.yaml`:** se añadieron `brace-expansion`, `protobufjs`, `sharp`
3. **Re-lock:** `pnpm install` regeneró `pnpm-lock.yaml`

### Después del fix

`pnpm audit --prod` → **0 advisories** (ver Task 3 para verificación completa)

### Versiones pineadas

| Paquete | De | A | Método |
|---------|-----|---|--------|
| next | 16.2.9 | 16.2.11 | `pnpm add next@^16.2.11` en `app/` |
| brace-expansion | transitivo | >=2.1.2 | override en `pnpm-workspace.yaml` |
| protobufjs | transitivo | >=7.6.5 | override en `pnpm-workspace.yaml` |
| sharp | transitivo | >=0.35.0 | override en `pnpm-workspace.yaml` |

**Nota:** El deploy real (build OpenNext/Docker) queda para el Plan 03 de esta fase.

---

## Queries de verificación

```bash
# Scan limpio (post-allowlist):
gitleaks git --redact --config .gitleaks.toml
# → exit 0, "no leaks found"

# Audit de dependencias (post-fix):
pnpm audit --prod
# → 0 advisories

# Verificar que Next no está en rango vulnerable en el lockfile:
grep -E "next@16\.(0|1|2\.[0-9])\.([0-9])" pnpm-lock.yaml
# → sin resultados
```
