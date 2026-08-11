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
