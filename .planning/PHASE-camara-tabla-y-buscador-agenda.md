# FASE — Tabla de sala de la Cámara (DeepSeek-desde-PDF) + buscador/navegación de agenda

**Fecha de diseño:** 2026-06-23 · **Para:** ventana nueva (contexto limpio) · **Estado del repo:** rama `master`, repo `github.com/xenaquis/observatorio-congreso` (privado). Deploy prod vigente: `observatorio-congreso.thevalis.workers.dev`.

**Regla transversal (LOCKED):** toda ingesta en 2 etapas **fuente → R2 crudo → Supabase**, rate-limit 2-3s/host, User-Agent identificatorio. DDL **solo por `psql --db-url`** (NUNCA `db push`; drift ≤ migración actual). Extracción LLM = DeepSeek `json_object` + **zod** (sin `json_schema` nativo). Degradación honesta SIEMPRE: PDF inaccesible / escaneado / con RUT → null, **nunca fabricar**. `pnpm`, no `npm`. `.env` BOM-safe. Contexto de fondo: memorias `[[cobertura-y-agenda-2026-06-23]]`, `[[v3-datos-progreso-y-gotchas]]`.

Dos frentes independientes. **A** = poblar la tabla de sala de la Cámara (hoy honest-degraded a PDF). **B** = buscador de agenda + mejor navegación. Hacer A y B; luego deploy + verificación.

---

## FRENTE A — Tabla de sala de la Cámara vía DeepSeek-desde-PDF

### Decisión (revierte el diseño previo)
La tabla de sala de Cámara estaba **honest-degraded a PDF POR DISEÑO** (`runIngest` paso 4 + `<SalaTableSection mode="degraded">`). **El usuario decidió conformarla con DeepSeek desde el PDF.** Esta fase la convierte en dato estructurado, manteniendo el enlace al PDF oficial como procedencia.

### Feasibility — YA VERIFICADA LIVE (2026-06-23), no re-investigar
- **Source real:** `https://www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL` (`prmId=0` = la semanal vigente). Devuelve **HTTP 200 `application/pdf` ~148 KB, `%PDF-1.7`**.
- **WAF:** el plain UA da **403**; pasa con el **header-set completo anti-Cloudflare** (`BROWSER_HEADERS_CAMARA` de `packages/agenda/src/headers-camara.ts`) **+ `Referer: https://www.camara.cl/legislacion/sala_sesiones/tabla.aspx`**. ⚠️ Añadir el `Referer` (no está hoy en el header-set; el verDoc lo exige). Node `fetch` igual será bloqueado → usar el **transporte curl** (`createCurlTransport`, ya en el paquete) como con citaciones.
- **Capa de texto:** RICA (5237 chars no-blancos con `unpdf`). NO es escaneo. Estructura real extraída:
  ```
  TABLA SEMANAL 22, 23 y 24 de junio de 2026
  LUNES 22 Sesión ordinaria de 17:00 a 19:00 horas
  MARTES 23 Sesión ordinaria a las 10:00 horas
  MIÉRCOLES 24 Sesión ordinaria de 10:00 a 14:00 horas
  <materia larga>. Boletín N° 10986- 24. Moción 1er. trámite constitucional SUMA (25.06.2026) ...
  <materia>. Boletín N° 18257-10. FACIL DESPACHO 1er. trámite constitucional Informante: ...
  ```
- **Gotcha de boletín:** aparecen como `Boletín N° 10986- 24` (espacio antes del sufijo) → la extracción DEBE normalizar a `10986-24` (`/(\d{3,5})-\s*(\d{2})/` → `$1-$2`). Algunos ítems NO traen boletín (acusaciones constitucionales) → `boletin: null` honesto.

### El modelo YA soporta Cámara (sin DDL nuevo para la tabla)
`SesionSala.camara` es `"camara" | "senado"` y `sesion_sala`/`sesion_tabla_item` (migración 0010) ya existen. Solo falta producir filas con `camara="camara"`. NO se necesita migración para A (sí para B).

### Trabajo A
1. **Connector** (`packages/agenda/src/connector-camara.ts`): añadir `fetchTablaSalaPdf(): Promise<Uint8Array>` que GETea el verDoc con `BROWSER_HEADERS_CAMARA` + `Referer`, devolviendo bytes crudos (no string). Reusa el orden LOCKED (`assertAllowedUrl → robots → rateLimiter.wait → fetcher.get`). 403 → `CamaraBloqueadaError` (ya existe). **Quitar/retirar** `fetchPdfTabla()` como única vía (mantener `CAMARA_TABLA_PDF_URL` como enlace de procedencia).
2. **Texto:** reusar el patrón `obtenerTextoFuente`/unpdf de `@obs/fichas` (`texto-fuente.ts`): magic-bytes `%PDF-` → `extractText` (unpdf). Si `<200` chars no-blancos → escaneo → degrada honesto (no fabrica). **Etapa 1 R2:** subir el PDF crudo content-addressed (`camara/tabla-sala/<fecha>/<sha256>.pdf`, `putImmutable`, gateado por credencial R2 como en fichas). **Etapa 2 lee del crudo.**
3. **Parser LLM** (`packages/agenda/src/parse-camara-tabla.ts`, NUEVO): `parseCamaraTabla(texto, semanaIso, opciones)` → `SesionSala[]`. Llama DeepSeek (`@obs/llm` `DeepSeekProvider.complete({system, user, criticality:"bulk", sensitivity:"public"}, Schema)`) con un schema zod que devuelve **una lista de sesiones (una por DÍA del PDF)** con sus ítems. El system-prompt: "extrae LITERAL, no inventes; boletín formato NNNNN-NN normalizado o null; cada ítem = {materia, boletin, tramite→ guarda en `quorum` la urgencia si aplica o null, parte_sesion = etiqueta de sección p.ej. 'FACIL DESPACHO'/'ORDEN DEL DÍA'/'TABLA' o el día}; posicion = orden de aparición (entero)". Validar con zod por sesión; la que no valide se descarta (no fabrica). **Decisión de modelado (tomar al implementar, según lo que el PDF segmente confiablemente):**
   - Preferente: **una `SesionSala` por día** (`id = camara:sesion:<YYYY-MM-DD>`), `fecha` = ese día, items asignados al día. SOLO si el PDF asigna ítems a días sin ambigüedad.
   - Fallback honesto si los ítems NO son segmentables por día: **una `SesionSala` por semana** (`id = camara:sesion:<YYYY-Www>`, `fecha` = primer día), todos los ítems juntos. NO fabricar la asignación día↔ítem.
   - `id_proyecto`=null, `alias`=null (la Cámara no los trae), `origen="camara-tabla-semanal"`, `enlace=CAMARA_TABLA_PDF_URL`.
4. **RUT gate:** el `DeepSeekProvider` ya tiene `assertNoRutInLlmInput` fail-closed. Si el texto trae un RUT → lanza → degrada esa corrida (honest). Improbable en una tabla, pero respétalo: NO lo desactives.
5. **Orquestación** (`ingest-run.ts` paso 4): reemplazar la degradación honesta pura por: fetch PDF → R2 → unpdf → `parseCamaraTabla` → `writer.upsertSesiones(...)` con `camara="camara"`. Si el PDF falla/escanea/RUT → MANTENER la degradación honesta actual (el enlace PDF) como fallback — no romper la página. El `prmId=0` es solo la semana vigente: si se backfillea, hay que descubrir el prmId histórico (FUERA DE ALCANCE; documentar). El cron semanal (`agenda-weekly.yml`) capturará la vigente cada lunes.
6. **CLI:** `run-agenda-prod-cli.ts` ya orquesta; al extender `runIngest` el flujo lo toma solo. Pasar el `DeepSeekProvider` + R2Store al `runIngest`/connector (inyección, como el lobby/fichas). Requiere `DEEPSEEK_API_KEY` + `R2_*` en `.env`/secrets (añadir esos secrets al workflow `agenda-weekly.yml` — hoy solo trae los `SUPABASE_*`).
7. **Frontend** (`app/app/agenda/page.tsx` `SalaTableServer`): hoy filtra `.eq("camara","senado")`. Añadir una consulta paralela `.eq("camara","camara")` y renderizar una sub-sección "Cámara de Diputados" con `<SalaTableSection mode="available">` cuando haya filas; si NO hay (PDF falló) caer al `mode="degraded"` actual (enlace PDF). El Senado queda intacto.

### Tests A (mismo patrón que el resto)
- `parse-camara-tabla.test.ts`: fixture = el texto unpdf real (guardar un recorte en `__fixtures__`), provider DeepSeek MOCK → verifica normalización de boletín, descarte de ítems sin clave, degradación si texto vacío. NO quemar cuota (mock).
- Connector: test del header-set + Referer + 403→`CamaraBloqueadaError`.

---

## FRENTE B — Buscador de agenda + navegación

### Objetivo
Hoy `/agenda` es solo semana-por-semana (`WeekNav`). El usuario quiere **buscar citaciones** (por comisión, materia, boletín, invitado) y que **navegar quede mejor estructurado**.

### Diseño (keyword search en Postgres, NO pgvector)
La búsqueda de agenda es por palabra clave (nombres de comisión, materias, boletín) → **Postgres Full-Text Search** (config `spanish`) o `pg_trgm`. NO usar embeddings (eso es para proyectos). Recomendado: **FTS `spanish`** sobre una columna generada / RPC.

1. **Migración** (`supabase/migrations/00NN_agenda_search.sql`, vía `psql --db-url`, tier DDL → pasar por `supabase-ops`/`supabase-architect` antes de aplicar):
   - Índice FTS sobre `citacion` combinando `comision || materia` + (vía join) `citacion_invitado.nombre` + `citacion_punto.materia/boletin`. Opciones: columna `tsvector` generada en `citacion` (solo comision+materia) + índice GIN; los hijos se buscan con `ilike`/`EXISTS` en el RPC. O materializar una vista. Mantener simple.
   - **RPC `buscar_citaciones(q text, limite int default 50)`** → devuelve filas de `citacion` (id, comision, fecha, camara, materia, semana_iso, snippet) rankeadas. `grant execute to anon`. RLS public-read ya existe en estas tablas (0010). Atajo boletín: si `q` matchea `NNNNN-NN`, filtrar por `citacion_punto.boletin`/`sesion_tabla_item.boletin`.
   - Parametrizar SIEMPRE (`q` jamás interpolado; usar `plainto_tsquery`/`websearch_to_tsquery`).
2. **Capa de datos** (`app/lib/agenda-buscar.ts`, NUEVO, `import "server-only"`): espeja `app/lib/buscar.ts` — valida `q` (trim, cap ≤300), atajo boletín (`BOLETIN_RE` → redirige a la ficha o filtra), llama `rpc("buscar_citaciones", {...})`, honest-degradation (error RPC ≠ "sin resultados").
3. **UI:**
   - Caja de búsqueda en `/agenda` (arriba del `WeekNav`), reusando el patrón de `SearchBox`/`/buscar` (solo navega, server-side; nunca llama modelos — la agenda no embebe).
   - Ruta `/agenda?q=...` (param) o `/agenda/buscar` — preferir el param en `/agenda` para mantener una sola página. Cuando hay `q`, mostrar resultados de búsqueda EN VEZ del listado semanal; sin `q`, el comportamiento actual (semana).
   - **Mejor navegación (el "todo mejor estructurado"):** (a) filtros por cámara (Cámara/Senado/ambas); (b) cada citación con boletín → link a `/proyecto/[boletin]` (cruce a la ficha; el campo ya existe vía `primerBoletin`); (c) índice/agrupación por comisión además de por día; (d) los ítems de tabla de sala con boletín → link a la ficha. Mantener UI-SPEC (sobria, fuente+fecha, sin insinuación).
4. **Invariantes a preservar:** noindex, sin partido, `/red` 404, `/contraparte` 404. La búsqueda de agenda NO expone PII (invitados son terceros con nombre+calidad crudos, ya públicos en la fuente — OK, igual que hoy en las cards).

### Tests B
- `agenda-buscar.test.ts`: validación de `q`, atajo boletín, honest-degradation con RPC mock (offline). Test SQL de la migración (`supabase/tests/00NN_agenda_search.test.sql`, patrón pgTAP de 0011): la función existe, anon tiene execute, un `q` de dominio devuelve filas, basura devuelve vacío.

---

## FRENTE C — Deploy + verificación

1. **DB primero** (B requiere migración): aplicar la migración por `psql "$SUPABASE_DB_URL"` (NUNCA `db push`). Verificar el RPC con un `select` directo.
2. **Ingesta A** (poblar tabla Cámara): correr `run-agenda-prod-cli.ts` LIVE (semana actual). Verificar `select count(*) from sesion_sala where camara='camara'` y `sesion_tabla_item` cruzados.
3. **Build + deploy** (idéntico a la última vez):
   ```
   docker rm -f obs-cf-build 2>$null; docker run --name obs-cf-build -v "C:\Users\Carlo\OneDrive - pjud.cl\Documentos\GitHub\Observatorio:/host" node:22-bookworm bash /host/docker-cf-build.sh
   # docker cp "obs-cf-build:/build/app/.open-next" "<repo>\app\.open-next"  (borrar .open-next previo; ruta Windows explícita)
   docker rm -f obs-cf-build
   cd app; .\node_modules\.bin\wrangler deploy   (vía PowerShell; wrangler ya autenticado)
   ```
   tsx en Windows: `node packages/<pkg>/node_modules/tsx/dist/cli.mjs <script>` (no el `.bin` shim). pipeline-cli/agenda-cli necesitan env → `run-agenda-prod-cli.ts` ya carga `.env`; para fichas usar `scripts/run-with-env.mjs`.
4. **Verificación en prod** (curl SSR; browseros no corre acá):
   - `/agenda` → aparece sub-sección "Cámara de Diputados" con ítems de tabla (materia + boletín linkeado), además del Senado. Si el PDF falla, cae al enlace PDF (honest).
   - `/agenda?q=medio ambiente` (o una comisión real) → resultados de citaciones rankeados; `q` off-topic/sin match → "Sin resultados" honesto; `q=<boletín>` → cruce a la ficha.
   - Invariantes intactos: `/red` 404, `/contraparte` 404, noindex, sin partido.

---

## Riesgos / decisiones abiertas (ser crítico)
- **Modelado día↔ítem de la tabla Cámara** (A.3): si el PDF no segmenta ítems por día de forma fiable, usar 1 sesión/semana — NO fabricar la asignación.
- **Backfill histórico de tabla Cámara:** `prmId=0` = solo la vigente. El histórico exige descubrir prmId por semana (no trivial). FUERA DE ALCANCE; el cron semanal acumula hacia adelante.
- **Costo DeepSeek:** 1 PDF/semana = trivial. OK.
- **Secrets del workflow:** `agenda-weekly.yml` hoy solo trae `SUPABASE_*`; A necesita `DEEPSEEK_API_KEY` + `R2_*` en el workflow (añadirlos con `gh secret set` + al `env:` del yml). **OJO billing GitHub Actions bloqueado** (memoria `[[cobertura-y-agenda-2026-06-23]]`) — el cron no corre hasta que el operador arregle el pago; mientras, correr la ingesta local.
- **DDL (B):** es cambio de schema → gate `supabase-ops`/`supabase-reviewer` antes de aplicar; drift de `schema_migrations` (aplicar por psql directo y registrar la fila como en deploys previos).
- **R2 en @obs/agenda:** hoy el paquete NO hace etapa R2 (fetch→upsert directo); A introduce R2 para el PDF crudo (alinea con la regla LOCKED). Las citaciones siguen sin R2 (deuda pre-existente; opcional alinearlas).

## Comandos de verificación DB
```
PGCLIENTENCODING=LATIN1 psql "$DB_URL" -At -c "select camara,count(*) from sesion_sala group by 1; select camara,count(*) from sesion_tabla_item i join sesion_sala s on s.id=i.sesion_id group by 1;"
PGCLIENTENCODING=LATIN1 psql "$DB_URL" -At -c "select proname from pg_proc where proname='buscar_citaciones';"
```
