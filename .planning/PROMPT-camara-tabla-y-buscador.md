Lee `.planning/PHASE-camara-tabla-y-buscador-agenda.md` y ejecútalo de punta a punta. Sé crítico y detallista; reporta qué queda sin cobertura y por qué.

Dos frentes + deploy:

FRENTE A — Tabla de sala de la Cámara con DeepSeek (hoy sale honest-degraded a PDF). Conformarla como dato estructurado:
- Source YA verificado LIVE: `https://www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL` → PDF 148KB con CAPA DE TEXTO RICA (no escaneo). Pasa el WAF SOLO con `BROWSER_HEADERS_CAMARA` (packages/agenda/src/headers-camara.ts) + `Referer: https://www.camara.cl/legislacion/sala_sesiones/tabla.aspx`, vía transporte curl (Node fetch da 403). NO re-investigar el source.
- Flujo: fetch PDF → R2 crudo (etapa 1) → unpdf (etapa 2, patrón de @obs/fichas texto-fuente.ts) → DeepSeek (json_object + zod) → SesionSala[] con camara="camara" → writer.upsertSesiones. El modelo sesion_sala/sesion_tabla_item YA soporta camara="camara" (sin DDL para A).
- Gotcha: boletines vienen como "Boletín N° 10986- 24" (espacio) → normalizar a 10986-24; ítems sin boletín (acusaciones) → null. Respetar el RUT gate del DeepSeekProvider (no desactivar). Modelado día↔ítem: 1 sesión/día si el PDF segmenta fiable, si no 1 sesión/semana (no fabricar).
- Frontend: app/app/agenda/page.tsx SalaTableServer hoy filtra .eq("camara","senado") → añadir sub-sección Cámara cuando haya filas; si el PDF falla, mantener el fallback PDF actual.

FRENTE B — Buscador de citaciones + mejor navegación en /agenda (hoy solo semana-por-semana):
- Postgres Full-Text Search (config spanish), NO pgvector. Migración por psql --db-url (NUNCA db push; gate supabase-ops antes de aplicar) + RPC `buscar_citaciones(q, limite)` grant a anon, atajo boletín, parametrizado (websearch_to_tsquery).
- Capa de datos app/lib/agenda-buscar.ts (server-only, espeja app/lib/buscar.ts) + caja de búsqueda en /agenda (param ?q=, reusa patrón SearchBox, solo navega). Navegación: filtros por cámara, boletín→link a /proyecto/[boletin], agrupar por comisión, ítems de tabla con boletín linkeados.

FRENTE C — Deploy: migración por psql primero; correr run-agenda-prod-cli.ts LIVE (poblar tabla Cámara); build OpenNext en Docker/Linux vía PowerShell + wrangler deploy; barrido curl en prod (/agenda muestra tabla Cámara + buscador funciona; invariantes /red 404, /contraparte 404, noindex, sin partido intactos).

Regla transversal LOCKED: ingesta 2 etapas (fuente→R2 crudo→Supabase) + rate-limit 2-3s; DDL solo psql --db-url; extracción DeepSeek json_object+zod; degradación honesta (PDF inaccesible/escaneado/con RUT → null, nunca fabricar); pnpm no npm; .env BOM-safe; tsx en Windows = `node packages/<pkg>/node_modules/tsx/dist/cli.mjs`. OJO: GitHub Actions bloqueado por billing de la cuenta → cron no corre, ingerir local. Contexto: memorias [[cobertura-y-agenda-2026-06-23]] y [[v3-datos-progreso-y-gotchas]].
