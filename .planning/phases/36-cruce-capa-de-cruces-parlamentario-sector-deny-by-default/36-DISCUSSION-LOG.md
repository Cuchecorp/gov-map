# Phase 36: CRUCE — Capa de cruces parlamentario↔sector (deny-by-default) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 36-cruce-capa-de-cruces-parlamentario-sector-deny-by-default
**Areas discussed:** Taxonomía de sectores, Golden de sector, Contenido del jsonb evidencia, Routing LLM (proveedor + sensibilidad)

---

## Taxonomía de sectores

### Origen y granularidad
| Option | Description | Selected |
|--------|-------------|----------|
| Custom curado ~12-15 macro | Catálogo propio de macro-sectores legibles para ciudadano, versionado en seed | ✓ |
| Estándar CIIU/ISIC | Clasificación económica oficial, granular/técnica | |
| Data-driven de materias | Derivar de materias de proyectos/lobby ya ingeridos | |

**User's choice:** Custom curado ~12-15 macro

### Autoridad del catálogo y no-clasificable
| Option | Description | Selected |
|--------|-------------|----------|
| Claude propone, vos confirmás | Planner propone lista; operador revisa; sin calce → NULL | ✓ |
| Vos provees la lista ahora | Sectores dictados en el discuss, LOCKED | |
| Lista + categoría 'Otros' | Cajón-sastre explícito en vez de NULL | |

**User's choice:** Claude propone, vos confirmás

### Alcance y estabilidad
| Option | Description | Selected |
|--------|-------------|----------|
| Uno compartido, estable+extensible | Mismo catálogo 3 entidades; agregar = migración aditiva | ✓ |
| Uno compartido, LOCKED total | Congelado para todo v4 | |
| Catálogos separados por entidad | Taxonomía distinta proyecto vs lobby/donante | |

**User's choice:** Uno compartido, estable+extensible

---

## Golden de sector

### Construcción del ground-truth
| Option | Description | Selected |
|--------|-------------|----------|
| Etiquetado humano, ~30-40 casos | Humano etiqueta a mano, JSON versionado | |
| Solo el slice de 10 del acceptance | Golden mínimo = 10 proyectos | |
| LLM propone, humano valida | LLM sugiere ~40, humano corrige; corregido = golden | ✓ |

**User's choice:** LLM propone, humano valida

### Cardinalidad y criterio de correcto
| Option | Description | Selected |
|--------|-------------|----------|
| Single-label (top-1) | Un sector primario; correcto = match exacto | ✓ |
| Multi-label (1-N) | Set predicho intersecta golden (F1) | |
| Primario + secundarios opcionales | Primario gateado + secundarios no-gateados | |

**User's choice:** Single-label (top-1)

### Política de abstención
| Option | Description | Selected |
|--------|-------------|----------|
| Abstiene si dudoso; NULL=no-cubierto | NULL = baja cobertura, nunca error; asignación mala = error | ✓ |
| Dos métricas separadas | Cobertura Y precisión medidas aparte | |
| Forzar siempre un sector | Sin NULL, gate de precisión pura | |

**User's choice:** Abstiene si dudoso; NULL=no-cubierto

---

## Contenido del jsonb evidencia

### Carga de la evidencia
| Option | Description | Selected |
|--------|-------------|----------|
| Conteo + lista de eventos trazables | {conteo, items:[{tipo,fecha,contraparte_nombre_crudo,audiencia_id,enlace_fuente}]} | ✓ |
| Solo conteo + IDs (re-query en ficha) | jsonb liviano, join extra en cada render | |
| Solo agregado | {conteo, ventana_fechas} — sin lista individual | |

**User's choice:** Conteo + lista de eventos trazables

### Semántica de refresco del materializador
| Option | Description | Selected |
|--------|-------------|----------|
| Full rebuild transaccional | Borra+reinserta en transacción (espejo materializar_aristas) | ✓ |
| Upsert incremental | Solo recomputa lo nuevo; riesgo de stale | |
| Append versionado | Snapshot fechado; crece sin límite | |

**User's choice:** Full rebuild transaccional

---

## Routing LLM (proveedor + sensibilidad)

### Proveedor según sensibilidad del input
| Option | Description | Selected |
|--------|-------------|----------|
| Split por sensibilidad | Proyectos→DeepSeek (público); contrapartes/donantes→MiniMax M3 (sensible) | ✓ |
| MiniMax M3 para todo | Un solo proveedor crítico | |
| DeepSeek para todo | Un solo proveedor de volumen | |

**User's choice:** Split por sensibilidad

---

## Claude's Discretion

- Estrategia de prompt-cache/batch del clasificador.
- Offset exacto del pg_cron (`~23 3 * * *` sugerido por diseño).
- Forma precisa columnas-vs-jsonb en `cruce_senal` más allá de la evidencia (D-09).
- Manejo de drift/throttle de la fuente — patrones existentes.
- Mecanismo de salida estructurada (json_object/tool-calling + zod) — convención heredada, no re-discutida.

## Deferred Ideas

- Señales derivadas de voto (`lobby_sector_voto`/`aporte_sector_voto`) — OFF hasta sign-off (Phase 39 / 17-LEGAL-DOSSIER §2).
- Multi-label / primario+secundarios — diferido, arrancamos single-label.
- Dimensión `aporte` real (SERVEL/donantes) — depende de RUT-01 (Phase 40).
- **Research question:** semántica de la señal MVP `lobby_sector_aporte` (lobby+aporte vs lobby-puro) — a resolver por el researcher manteniendo el acceptance verificable solo con datos de lobby.
