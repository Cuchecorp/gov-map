# Phase 115 — Deuda diferida (fuera del alcance de la fase)

## D-115-01 — La ingesta persiste una consulta SPARQL mal formada en `declaracion*.enlace` (A-5)

- **Origen:** `115-VEREDICTO.md` §4, acción A-5 (patrón P-11).
- **Evidencia:** `115-MUESTRA.json`, registro `P-11-c01` → HTTP 400 con cuerpo
  `Virtuoso 37000 Error SP030: SPARQL compiler, line 1: syntax error at 'alessandri' before 'vergara'`.
  El servidor de `datos.cplt.cl` está sano: rechaza **nuestra** consulta. El `enlace`
  almacenado tiene la forma `?query=<texto libre>`, que no es SPARQL.
- **Alcance del defecto:** **9.441 filas** sobre las 7 tablas `declaracion*` (conteo de
  `115-VEREDICTO.md` §4 A-5). Cero valores de fila, cero columnas PII en este registro.
- **Por qué NO se arregla aquí:** el defecto vive en el **conector de ingesta** que
  persiste ese `enlace`, no en un patrón de la UI. Esta fase valida y corrige patrones de
  link; cambiar un conector excede su límite declarado (`115-CONTEXT.md` §Phase Boundary).
- **Lo que sí se hizo en esta fase:** la limitación quedó **declarada en la UI**
  (`app/components/provenance-badge.tsx`, `LEYENDA_RECURSO_NO_HUMANO`), de modo que el
  ciudadano no recibe un enlace roto sin explicación de formato.
- **Trabajo pendiente (dueño futuro):** corregir el conector para que persista una URL de
  consulta humana del portal del CPLT o, si no existe, dejar de persistir un `enlace` que
  no resuelve — jamás fabricar uno.
