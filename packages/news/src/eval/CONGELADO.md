# CONGELADO — log de congelación de `packages/news/src/eval/`

## Régimen

Los artefactos congelados de este directorio son proyecciones canónicas JSON, hasheadas con
sha256 sobre sus **bytes** (nunca sobre el `.ts` fuente — un drift de formateo del `.ts`
produciría un falso positivo). Un **cambio legítimo** es siempre **un solo commit** que trae
las **tres** cosas juntas:

1. El artefacto (`taxonomia.json` y/o `thresholds.json`) regenerado con el CLI.
2. La constante de hash actualizada dentro de `congelado.test.ts`.
3. Una **entrada nueva** en este archivo, con `hash_anterior → hash_nuevo`, fecha, razón y
   firma del operador.

Cualquier otra combinación (artefacto sin entrada, entrada sin cambiar el test, etc.) es
**drift** y debe tratarse como una regresión, no como una actualización.

**Limitación declarada, no disimulada:** la "firma" de cada entrada es un string dentro de un
archivo markdown — no impone ninguna garantía criptográfica ni de control de acceso. El
control real de que el cambio fue deliberado es el **commit en git** (autoría, fecha, mensaje,
revisión). Este archivo es el log legible por humanos de esa historia, no un mecanismo de
integridad por sí mismo.

`golden-set.json` **no existe todavía** en 133-a — se construye y se congela en 133-b, con su
propia firma independiente del operador. Su ausencia aquí es declarada, no un hueco olvidado.

## Entradas

### 2026-08-06 — congelación inicial 133-a

- **Razón:** congelación inicial 133-a bajo D-133-A2/D-133-D2, firmada por el operador
  2026-08-06.
- **Firma:** operador, 2026-08-06.
- **`taxonomia.json`:** `hash_anterior: (ninguno)` → `hash_nuevo: 90981888979773ec3f483c4bb6f10c26a75f7e248f18a03b662bcb1fcd9f706c`
- **`thresholds.json`:** `hash_anterior: (ninguno)` → `hash_nuevo: e428594463ebae3b6b4b1bce0c0ee2c3fd35516b70d2f7b6e9c73e2583938d1e`
- **`golden-set.json`:** no existe todavía — se congela en 133-b con su segunda firma.

### 2026-08-10 — congelación del golden set (133-b-07)

- **Razón:** cierre de 133-b — golden set de 159 casos (154 de la ventana 2026-08-05..07 +
  5 `P-dirigido` de fixtures), doble etiquetado Sonnet/Opus ronda 2 (prompt v2 tras la
  gatillada de C2.1.3 en ronda 1), 18 arbitrajes proxy, κ(m↔m)=0.8293, κ(fable↔m)=0.8149,
  Δ=0.0144 (C2.1.3 no gatillada). `tramitacion_legislativa` n=22 y `actividad_parlamentaria`
  n=6 quedan **no-medidas** (fail-closed D-133-D2: T4/T9 no vetan, **ninguna de las dos
  clases enruta a fichas** hasta medición futura). κ(humano↔máquina) **NO MEDIDO**
  (calibración por proxy Fable, `133-b-ENMIENDA-PROXY.md`).
- **Firma:** **PROXY Fable** bajo instrucción verbatim del operador 2026-08-10 —
  **RATIFICACIÓN DE OPERADOR PENDIENTE** (mismo régimen D-133-RATIF). Si no se ratifica,
  este hash se revoca con entrada nueva.
- **`taxonomia.json`:** sin cambios — vigente `90981888979773ec3f483c4bb6f10c26a75f7e248f18a03b662bcb1fcd9f706c`
- **`thresholds.json`:** sin cambios — vigente `e428594463ebae3b6b4b1bce0c0ee2c3fd35516b70d2f7b6e9c73e2583938d1e`
- **`golden-set.json`:** `hash_anterior: (ninguno)` → `hash_nuevo: 47ace935f85ae921c5ca8e2c11133b3a82278b371ba21ba516f498cada33c03c`

### 2026-08-11 — veredicto del benchmark 135-03 (elección de modelo COMPUTADA)

- **Razón:** corrida live del bench sobre el golden congelado (159 casos × 3 candidatos).
  **DeepSeek aprueba** (T3=0.8766 [0.813,0.918], T1=0, T2=0) y **MiniMax aprueba**
  (T3=0.9018 [0.844,0.939]); empate por solapamiento de IC95 ⇒ **elección: deepseek**
  (incumbente, regla D-133-D2). **Granite NO-MEDIDO en dominio:** sus 159/159
  `parse_fallido` en 53 s son un **401 de Workers AI** (credencial vencida, probado con
  sonda), no calidad del modelo — su re-validación de dominio queda pendiente de credencial
  nueva y NO afecta la elección. T4/T9 siguen no-medidos (fail-closed 133-b).
- **Firma:** PROXY Fable (régimen `133-b-ENMIENDA-PROXY.md`) — ratificación pendiente.
- **`taxonomia.json`:** vigente `90981888979773ec3f483c4bb6f10c26a75f7e248f18a03b662bcb1fcd9f706c`
- **`thresholds.json`:** vigente `e428594463ebae3b6b4b1bce0c0ee2c3fd35516b70d2f7b6e9c73e2583938d1e`
- **`golden-set.json`:** vigente `47ace935f85ae921c5ca8e2c11133b3a82278b371ba21ba516f498cada33c03c`
- **`veredicto-135.json`:** `hash_anterior: (ninguno)` → `hash_nuevo: d6fa8c37aa5ca382df4a46618da1c2c4343a2067639f875f1fdc55a8ae374ca1`

### 2026-08-11 — re-congelado de veredicto-135.json (H3 de la verificación 135)

- **Razón:** el artefacto registraba a Granite como vetado (T2=1.0) cuando en realidad quedó
  **no-medido por credencial** (401 de Workers AI). Se añade el campo computado
  `granite_estado` para que el artefacto que sobrevive diga lo que pasó — la causa no puede
  vivir solo en prosa. Ningún número medido cambia; la elección (deepseek) no cambia.
- **Firma:** PROXY Fable (régimen `133-b-ENMIENDA-PROXY.md`) — ratificación pendiente.
- **`veredicto-135.json`:** `hash_anterior: d6fa8c37aa5ca382df4a46618da1c2c4343a2067639f875f1fdc55a8ae374ca1` → `hash_nuevo: 8fa3a6908b7eebb93e61d758096c51f1313a389638ad3b531815f6562428edd1`
- Vigentes sin cambio: `taxonomia.json` `90981888979773ec3f483c4bb6f10c26a75f7e248f18a03b662bcb1fcd9f706c`,
  `thresholds.json` `e428594463ebae3b6b4b1bce0c0ee2c3fd35516b70d2f7b6e9c73e2583938d1e`,
  `golden-set.json` `47ace935f85ae921c5ca8e2c11133b3a82278b371ba21ba516f498cada33c03c`
