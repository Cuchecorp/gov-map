# 121 — VERIFICATION: cierre de ESCALERA-DOC

**Fase:** 121-escalera-doc-extension-solo-con-benchmark
**Plan:** 121-01
**Fecha:** 2026-07-28 (2026-07-28T20:53:24Z)
**Artefacto verificado:** `.planning/phases/121-escalera-doc-extension-solo-con-benchmark/121-ESCALERA-ESTADO.md`

---

## 1. Comando y resultado

**Comando exacto (corrida final registrada):**

```
bash .planning/phases/121-escalera-doc-extension-solo-con-benchmark/check-escalera-doc.sh
```

**Exit code: 0** — `=== GATE VERDE`

El script también se invocó como `sh .planning/phases/121-escalera-doc-extension-solo-con-benchmark/check-escalera-doc.sh`
(la forma que usa el `<verify>` del plan) con el mismo **exit code 0**.

**Salida íntegra (sin secretos):**

```
=== check-escalera-doc.sh — gate de 121-ESCALERA-ESTADO.md
repo: C:/Users/Carlo/OneDrive - pjud.cl/Documentos/GitHub/Observatorio

--- C1 · el documento existe
PASS C1 121-ESCALERA-ESTADO.md presente

--- C2 · las 5 tareas LLM están nombradas
PASS C2 tarea presente en la tabla maestra: routing
PASS C2 tarea presente en la tabla maestra: clasificaci
PASS C2 tarea presente en la tabla maestra: juez
PASS C2 tarea presente en la tabla maestra: extracci
PASS C2 tarea presente en la tabla maestra: adjudicaci

--- C3 · estado explícito por tarea (vocabulario cerrado, celdas de la tabla maestra)
C3 celdas de estado -> EXTENDIDA=1 · NO EXTENDIDA=3 · INTOCABLE=1 · total=5
PASS C3 exactamente 1 celda EXTENDIDA
PASS C3 exactamente 3 celdas NO EXTENDIDA
PASS C3 exactamente 1 celda INTOCABLE
PASS C3 la tabla maestra tiene 5 filas de tarea con estado
PASS C3 existe la sección 'Cómo leer los estados'

--- C4 · citas verificables
PASS C4 cita presente (10 ocurrencia(s)): 107-VEREDICTO-LIVE-FULL-2026-07-27
PASS C4 cita presente (9 ocurrencia(s)): be0b1b9
PASS C4 cita presente (6 ocurrencia(s)): 120-FLIP-RECORD
PASS C4 la adjudicación referencia SEED-001 (decisión de diseño, no métrica)
PASS C4 las 5 filas de la tabla maestra citan una fuente

--- C5 · subparte 'qué evidencia … la extendería'
C5 ocurrencias de 'qué evidencia'=6 (mínimo 5)
PASS C5 las 5 tareas declaran qué evidencia las extendería
PASS C5 adjudicación responde N/A por diseño (presencia, no omisión)

--- C6 · anti-secreto (sobre el artefacto, jamás sobre este script)
C6 filtro aplicado: se excluye 'CLASIFICACION_ESCALERA=1' y los placeholders redactados (*** / <X> / ${X})
PASS C6 cero patrones de secreto en 121-ESCALERA-ESTADO.md

--- C7 · self-check anti-secreto (dos fixtures inventados, fuera del repo)
C7 fixture A (asignación con valor): hits=1 · fixture B (blob hex suelto): hits=1
PASS C7 el detector MUERDE la rama de asignación con valor
PASS C7 el detector MUERDE la rama de blob que parece credencial
PASS C7 la excepción CLASIFICACION_ESCALERA=1 no abre agujero (control: 1 hit, el otro token)

=== RESULTADO: 0 falta(s)
=== GATE VERDE
```

**Self-check anti-secreto:** ambas ramas del detector **mordieron** (fixture A = asignación de
credencial con valor falso inventado; fixture B = blob hex de 40 caracteres suelto, sin `=` delante),
más un control negativo que confirma que la excepción `CLASIFICACION_ESCALERA=1` no abre un agujero
general (1 hit sobre el token de control, 0 sobre la excepción). Los dos fixtures son **inventados**:
en ningún momento se copió un valor real de `.env`. Los temporales se crearon fuera del repo (en el
scratchpad de sesión) y se borraron por `trap … EXIT` — verificado: cero archivos
`escalera-selfcheck-*` residuales.

---

## 2. Mapeo SC#1–SC#4 → comprobación → sección del documento

| SC | Enunciado | Comprobación del script | Sección de `121-ESCALERA-ESTADO.md` que lo satisface |
|---|---|---|---|
| **SC#1** | Las 5 tareas LLM tienen estado explícito con evidencia de benchmark que lo respalda | **C2** (las 5 tareas nombradas) + **C3** (1 EXTENDIDA / 3 NO EXTENDIDA / 1 INTOCABLE, celdas del vocabulario cerrado, total 5) + **C4** (cada fila cita una fuente) | `## Tabla maestra` · `## Cómo leer los estados` · las 5 secciones por tarea (subpartes **Estado** y **Evidencia**) |
| **SC#2** | Las tareas sin benchmark de paridad quedan NO EXTENDIDAS citando "ante la duda, siempre calidad", con el flip de routing y el veto es-CL registrados | **C3** (3 celdas NO EXTENDIDA) + **C4** (cita a `107-VEREDICTO-LIVE-FULL-2026-07-27` / `be0b1b9`) | `## Recuadro — la lección` (flip 10-sample `+0.10` → full-40 `−0.10`, regla LOCKED literal) · `## Routing` · `## Extracción` (veto es-CL por corto-circuito, `negacion.accuracy` 0/3 vs 1/3) · `## Juez` |
| **SC#3** | Adjudicación INTOCABLE por decisión explícita (SEED-001), con su propia subparte "qué la extendería" respondida N/A por diseño — presencia, no omisión | **C3** (1 celda INTOCABLE) + **C4** (referencia `SEED-001`) + **C5** (`N/A por diseño` presente) | `## Adjudicación de identidad` (las 4 subpartes, incluida **Qué evidencia concreta la extendería: N/A por diseño**) · `## Régimen de guards` |
| **SC#4** | Cada tarea pendiente declara qué evidencia concreta y verificable la extendería | **C5** (≥5 ocurrencias de "qué evidencia"; observadas 6) | Subparte **Qué evidencia concreta la extendería** en `## Clasificación`, `## Routing`, `## Extracción`, `## Juez`, `## Adjudicación de identidad` |

**Criterios adicionales del plan:**

| Criterio | Comprobación | Resultado |
|---|---|---|
| El check por grep pasa en verde | corrida completa | exit 0, 0 faltas |
| El self-check de secretos muerde | **C7** (dos fixtures + control negativo) | PASS ×3 |
| Cero código de producto tocado | `git status --porcelain` | sólo los 3 archivos de `files_modified` de esta fase; cero cambios en `packages/`, `app/`, `supabase/`, `.env`, `.env.example`, `package.json` |

---

## 3. Muestreo de fidelidad

Verificación de que las cifras del documento existen **literalmente** en el archivo de origen
(`grep -cF` sobre ambos archivos):

| Cifra | Ocurrencias en `121-ESCALERA-ESTADO.md` | Ocurrencias en `107-VEREDICTO-LIVE-FULL-2026-07-27.md` |
|---|---|---|
| `−0.1000` (Δcalidad routing) | 2 | 1 |
| `0.9167` (`recall_rechazo` Phi) | 2 | 2 |
| `0.098/0.182` (value P/R Granite, extracción) | 2 | 1 |
| `996.5s` (duración de la corrida full-40) | 1 | 1 |
| `+0.1667` (Δcalidad juez) | 2 | 1 |
| `0.9500` (`precision_ok`) | 2 | 1 |
| `$0.0107` (costo/1k casos Granite) | 1 | 1 |

Cero cifras de memoria. Cero redondeos nuevos.

**Nota de codificación:** el signo del Δ de routing es el **menos tipográfico U+2212** (`−`), no el
guion ASCII. Se copió byte a byte del veredicto; un `grep -- '-0.1000'` con guion ASCII devuelve 0
tanto en el origen como aquí, y eso es correcto, no una falta.

---

## 4. Límites de esta verificación

1. El gate comprueba **completitud y forma** del documento, no la veracidad de las cifras del
   veredicto — eso lo fija la corrida de la Phase 107, que este documento cita, no re-mide.
2. El gate **no re-ejecuta** el drift canary ni el shadow-eval: son env-gated y consumen `.env` y
   red. La §Condición de vigencia del documento da el comando para re-ejecutarlos cuando toque.
3. Esta fase **no autoriza ni flipea nada**. El estado `CLASIFICACION_ESCALERA=1` viene de la
   Phase 120 y no fue tocado aquí.
