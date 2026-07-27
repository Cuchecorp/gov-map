---
phase: 70-dinero-p5b-wire-dos-etapas-chilecompra-por-rut-funde-debt-01-spike-cuota
plan: 03
tipo: spike-registro
requirements: [MONEY-01]
confidence: MEDIUM   # 10k/día confirmado oficial; forma OCDS + universo RUT no probados en sesión
verified:
  - "Cuota 10.000 requests/día por ticket, NO modificable [ayuda.mercadopublico.cl/preguntasfrecuentes]"
  - "Bulk OCDS mensual JSONL comprimido existe [datos-abiertos.chilecompra.cl/descargas/procesos-ocds]"
deferred:
  - "Parser OCDS + filtrado local por RUT sobre los archivos bulk — FUERA DE ALCANCE de esta fase"
depende_de:
  - "Universo real de RUTs = RUT-01 (Phase 69, checkpoint operador PENDIENTE)"
---

# 70 — SPIKE: Cuota ChileCompra + mecánica bulk OCDS (registro)

Registro del SPIKE de cuota que gatea el diseño del backfill LIVE. **No se corrió el endpoint
LIVE en esta sesión** (ver §f). Este documento caracteriza; no construye.

## (a) CUOTA — 10.000 requests/día, NO modificable

Cada ticket `MERCADOPUBLICO_TICKET` tiene un límite **no modificable de 10.000 requests/día**.
El uso excesivo → **suspensión temporal o bloqueo permanente** del ticket.
`[VERIFIED: ayuda.mercadopublico.cl/preguntasfrecuentes — KA-01967]`

Consecuencia de diseño: no se puede "pedir más cuota" para acelerar el backfill. La única palanca
es **repartir el trabajo en varios días** (partición LOCAL reanudable) y **no gastar de más** (solo
días con actividad). Pedir un segundo ticket paralelo para esquivar la cuota es exactamente el
"uso excesivo" que provoca el bloqueo → **prohibido**.

## (b) COSTO por RUT

Cada RUT cuesta:
- **1 request** paso 1 — `BuscarProveedor` (resuelve el proveedor/entidad).
- **N requests** paso 2 — una consulta de órdenes **por día** del rango (`fechasEntre` itera
  ddmmaaaa; tope defensivo de **366 días por llamada** en `query.ts`, así que un rango largo se
  parte en varias ventanas).

**Cota superior grosera:** un backfill de ~4 años ⇒ N ≈ 1.460 días/RUT ⇒ 1 + 1.460 ≈ 1.461
requests/RUT ⇒ **~6 RUTs completos/día** bajo la cuota de 10k. Con **ventanas cortas** (solo los
días con actividad real del proveedor) el costo baja mucho — la ventana de días es la palanca
principal para caber en la cuota.

**Universo de RUTs INDETERMINADO hoy:** el set de RUTs a consultar es el de las **empresas/entidades
ligadas** (el proveedor es una entidad, no el parlamentario directamente), que sale del cruce que
**RUT-01 (Phase 69)** puebla. Hasta que ese checkpoint operador se aplique, el universo está vacío
→ el número de días de crawl no se puede fijar aún.

## (c) PARTICIÓN LOCAL multi-día reanudable — OBLIGATORIA

Por (a)+(b), el backfill LIVE **debe** partirse en lotes `(RUTs × ventana de días)` que sumen
< 10.000 requests/día, repartidos en varios días, con hash-check en R2 (envelope por-RUT
content-addressed → 412=ya-descargado=skip) e idempotencia por clave natural (re-correr = no-op).
El procedimiento operativo completo vive en **`70-BACKFILL-CHILECOMPRA-RUNBOOK.md`** (este SPIKE
solo justifica por qué la partición es obligatoria).

## (d) OCDS BULK — ALTERNATIVA que esquiva la cuota, pero DEFERRED (fuera de alcance)

`datos-abiertos.chilecompra.cl/descargas/procesos-ocds` publica **JSON/JSONL comprimido agrupado
por mes, actualizado a diario** (y JSON/Excel/CSV por año o histórico completo; cada proceso = 1
línea JSONL). Las órdenes del mes anterior se consolidan mensualmente (≤ día 20).
`[VERIFIED: datos-abiertos.chilecompra.cl]` `[CITED: data.open-contracting.org/en/publication/144]`

- **Ventaja:** el bulk es **descarga de archivos, NO API** → **esquiva por completo la cuota de
  10.000/día**. Es la vía natural para un snapshot histórico masivo.
- **Tradeoff (por qué NO se construye ahora):** la forma **OCDS difiere** del REST que
  `parse-chilecompra.ts` ya parsea → requeriría (1) un **parser OCDS nuevo** y (2) **filtrado local
  por RUT** sobre archivos grandes (millones de filas). Ambas cosas son trabajo neto que excede el
  wire del REST existente que esta fase entrega.
- **Disposición:** **DEFERRED / FUERA DE ALCANCE de esta fase.** Se documenta como **opción de
  operador / fase futura**; NO se implementa aquí. El operador elige en el runbook entre (a) el REST
  per-RUT particionado multi-día, o (b) descargar el bulk OCDS y procesarlo aparte (fuera de este
  wire).

## (e) DEPENDENCIA — RUT-01 (Phase 69, checkpoint operador PENDIENTE)

El universo real de RUTs a consultar depende de que **RUT-01 puble la maestra** en la Supabase
remota (write vía db-url = checkpoint de operador, aún PENDIENTE). Sin RUT-01, el crawl no tiene
universo. Consistente con "backfill LIVE = operador": esta fase entrega **wire + tests fake +
runbook + este SPIKE**, no datos.

## (f) REACHABILITY — el LIVE NO se probó en esta sesión

**No se golpeó `api.mercadopublico.cl` LIVE en esta corrida del agente.** El ticket es secreto de
operador (`MERCADOPUBLICO_TICKET` no está disponible al agente) y **consumir cuota sería
irrespetuoso** (podría restar del presupuesto diario del operador). El probe
`live-chilecompra.probe.ts` es la **herramienta del operador** para confirmar la forma del REST
antes del backfill. Honestidad: la forma Zod de `model.ts` está derivada de docs; el operador la
confirma con el probe antes de escalar.

---

**Conclusión del SPIKE:** cuota 10k/día NO modificable → **partición LOCAL multi-día reanudable es
obligatoria** (runbook). El **bulk OCDS esquiva la cuota** pero su parser es **DEFERRED** (fuera de
alcance). El **universo de RUTs depende de RUT-01** (checkpoint operador pendiente). El agente **no
consumió cuota, no probó el LIVE, no flipeó ningún gate**.
