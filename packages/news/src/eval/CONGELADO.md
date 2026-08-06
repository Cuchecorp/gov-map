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
