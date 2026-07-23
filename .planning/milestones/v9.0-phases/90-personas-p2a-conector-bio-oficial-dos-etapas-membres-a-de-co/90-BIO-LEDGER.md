# 90-BIO-LEDGER — Apply de 0059 a PROD + pgTAP + corrida LIVE de bio

**Fase:** 90 (PERSONAS P2a — Conector bio oficial dos-etapas + membresía de comisiones)
**Plan:** 90-03
**Ejecutado:** 2026-07-22

---

## 1. Apply de la migración 0059 a PROD

Migración **aditiva** (4 tablas nuevas deny-by-default, RLS on, cero grant anon) — dentro de la
autoridad del agente por precedente de pasada-1 (0055–0058). Sin riesgo destructivo.

**Precondición verificada** (idempotencia): antes de aplicar, `count(*)` de las 4 tablas en
`information_schema.tables` = **0** (schema limpio, nunca aplicada). Segura de aplicar UNA vez.

**Comando LOCKED** (NUNCA `supabase db push`; `SUPABASE_DB_URL` de `.env` BOM-safe):

```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0059_bio_comisiones.sql
```

**Resultado:**

```
CREATE TABLE / ALTER TABLE / REVOKE   (× 4 tablas: parlamentario_bio, parlamentario_militancia, comision, comision_membresia)
```

Todo en una sola transacción (`--single-transaction` → rollback atómico si algo falla). Aplicada
**una sola vez**. **NO se re-aplica** (los `create table` no son re-ejecutables sin drop).

---

## 2. pgTAP contra el schema APLICADO

Prueba de que Postgres ejecutó el DDL (build/typecheck son falso-positivo, research Pitfall 6):

```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0059_bio_comisiones.test.sql
```

**Resultado: 28 ok / 0 not ok** (`plan(28)`).

- Las 4 tablas existen (ok 1–4).
- RLS habilitada en las 4 (ok 5–8).
- Deny-by-default: cero policies en las 4 (ok 9–12).
- Deny-by-default: anon SIN grant SELECT en las 4 (ok 13–16).
- Provenance NOT NULL (origen/fecha_captura/enlace) (ok 17–25).
- Nullables honestos (profesion / hasta / cargo) (ok 26–28).

Confirma: **RLS on, cero policies, cero grant anon, provenance NOT NULL** contra el schema vivo.

---

## 3. Corrida LIVE acotada de bio (2026-07-22, rate-limit 2-3s, UA identificatorio)

Cada corrida hizo dry-run PRIMERO (parsea + cuenta, no escribe), luego LIVE. Etapa 1 = envelope
crudo content-addressed en R2; Etapa 2 = write a PROD. Idempotente por clave natural + short-circuit
por sha de R2. NINGÚN nombre/DIPID sin-match se persiste fuera de la maestra (solo log local).

### Fuente A — Diputados (opendata.camara.cl, sin WAF)

- **Endpoint:** `WSDiputado.asmx/retornarDiputadosPeriodoActual` (1 request cubre la cámara).
- **Dry-run:** 315 militancias parseadas, 155 DIPID match, **0 sin match**.
- **LIVE:** 315 militancias escritas, 155 `parlamentario.partido` refrescados desde la militancia
  ACTUAL, **0 sin match**.
- **Cobertura: 155/155 diputados** (100% — todos los del XML empataron por DIPID exacto).
- **r2Path:** `bio/envelope/2026-07-22/f299bdea74beeb4afaeefe02fdec2a59a3f6f9d068e323f7b812809f87e6bc06.json`
- **Verificado en PROD:** `parlamentario_militancia` origen `camara-bio-diputados` = 315;
  `es_actual` = 155; `parlamentario.partido` fresco (fecha_captura 2026-07-22) = 155.

### Fuente B — Senadores (BCN SPARQL, sin WAF)

- **Endpoint:** `datos.bcn.cl/sparql` (GET anónimo).
- **CORRECCIÓN LIVE (bug del plan/spike, Rule 1):** la query original `?person a bio:Senador`
  devolvía **0 bindings** — NO existe la clase `bio:Senador` en el grafo BCN (las personas son
  `foaf:Person`). El probe en vivo reveló que un senador se distingue por el predicado
  **`bio:idSenado`** (= `parlid_senado` de la maestra). Se corrigió la query a
  `?person bio:idSenado ?idSenado ...` y el enlace pasó de name-match (research A3) a **join
  DETERMINISTA por `parlid_senado`** (más fuerte que el nombre). El fallback name-match
  (`enlazarSenadores`) queda escrito para degradación honesta.
- **LIVE:** BCN devolvió 117 personas-senador históricas (48 militancias mapeadas a los actuales).
  **31 confirmados / 85 sin match.**
- **Cobertura: 31/31 senadores del período vigente** (100% de los que la maestra tiene con
  `parlid_senado`). Los **85 sin match** son senadores HISTÓRICOS de BCN que NO están en la
  maestra de parlamentarios activos (2026-2034) → fail-closed correcto, NO un bug: la degradación
  se DECLARA aquí, jamás se defaultea en silencio. Todos los sin-match quedaron como skip
  (`SEN:<parlid>`), cero FK fabricado.
- **r2Path:** `bio/envelope/2026-07-22/1fab3cb0939333c45cb01b20dcdd9232ca3e584f8d6a78aa2e02589ca4329549.json`
- **Verificado en PROD:** `parlamentario_militancia` origen `bcn-senadores` = 48;
  senadores distintos con militancia = 31; `parlamentario` con `parlid_senado` no nulo = 31 (match
  perfecto); **militancias con FK inexistente = 0**.

### Fuente C — Comisiones (www.camara.cl, WAF → curl-first)

- **Fuente (veredicto 90-02):** `comisiones_permanentes.aspx` (catálogo) → `integrantes.aspx?prmID=<N>`.
  `www.camara.cl` tiene WAF sobre el fetch de Node → **curl-first** (34 catálogo + 34 integrantes,
  rate-limit 2.5-8s con reintentos ante 403 intermitente; todos recuperados a 200).
- **Dry-run:** 34 comisiones, 386 membresías, 1 sin match.
- **LIVE:** **34 comisiones + 386 membresías escritas**; enlace FAIL-CLOSED por DIPID exacto.
  **1 sin match** (`COM:0` — ancla de staff/malformada sin DIPID válido → excluida por construcción).
- **Estado: CON membresía (sin degradación)** — la fuente elegida sí trae integrantes con DIPID.
- **Cobertura: 34 comisiones permanentes, 386 membresías, 154 diputados distintos**; cargos
  capturados (Presidente/Presidenta/integrante-null).
- **r2Path:** `bio/envelope/2026-07-22/606ed81b01478f88faefb8bb1079115c97c06576bdd1f205291f8a8682437120.json`
- **Verificado en PROD:** `comision` = 34; `comision_membresia` = 386;
  **membresías con FK inexistente (parlamentario) = 0; (comisión) = 0.**

### Idempotencia

Re-correr comisiones LIVE con el mismo crudo → `[skip] sin novedades — bio envelope` (short-circuit
por sha de R2). El upsert por clave natural garantiza conteos idénticos en un 2× run.

### CERO FK fabricado (invariante rector)

Los tres checks de integridad referencial en PROD dan **0** filas con `parlamentario_id`/`comision_id`
inexistente. Todo sin-match (0 diputados, 85 senadores históricos, 1 ancla de comisión) quedó como
**skip**, nunca como FK inventado. Los nombres/DIPIDs sin-match viven SOLO en el log local de la
corrida, JAMÁS persistidos fuera de la maestra.

### bio 1:1 (`parlamentario_bio`)

**0 filas** — intencional (Known Stub de 90-02): ninguna fuente probada trae profesión estructurada
(research Open Q3). Las militancias + partido + comisiones SÍ se pueblan; la profesión se resuelve
en 91 o en un spike de ficha. NO bloquea el gate de header de 91.

---

## Resumen de cobertura (N/M por fuente)

| Fuente     | Confirmados | Sin match | Cobertura del universo vigente | Estado                  |
|------------|-------------|-----------|--------------------------------|-------------------------|
| Diputados  | 155         | 0         | 155/155 (100%)                 | Poblado                 |
| Senadores  | 31          | 85 (hist.)| 31/31 (100% del período)       | Poblado (fallback listo)|
| Comisiones | 34 com / 386 memb / 154 dip | 1 (staff) | 34 comisiones permanentes | CON membresía (sin degradar) |

Gate de 91 DESBLOQUEADO: modelo + columna/tabla de bio + membresía + bio de diputados poblada.
