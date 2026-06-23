# HANDOFF — Cobertura de búsqueda + Agenda (citaciones/tabla) + deploy a prod

**Fecha:** 2026-06-23 · **Para:** ventana nueva (contexto limpio) · **Regla transversal:** toda ingesta respeta la convención LOCKED de 2 etapas (**fuente → R2 crudo → Supabase**) y el rate-limit 2-3s/host, para NO estresar los servidores gubernamentales. **Al final: dejar la página DESPLEGADA en producción y verificada.**

Tres frentes (A y B son ingesta de datos; C es deploy+verificación). Ejecutar A y B (independientes entre sí), luego C.

---

## FRENTE A — Cobertura de la búsqueda semántica

### Diagnóstico (ya hecho)
El documento embebido es **título + materia + idea matriz + cuerpos legales (normas que modifica)** (`packages/fichas/src/embed-ficha.ts` → `componerTextoEmbed`). NO es title-only por diseño. La relevancia floja es por **cobertura de datos**: 57/74 con idea matriz, 60/74 con cuerpos, **11/74 solo título**; embeddings: 65 `v1-reembed` ricos + **9 `v1` stale title-only**.

### Trabajo (17 boletines, vía `pipeline-cli` de @obs/fichas — YA respeta R2 gateado por credencial)
- **Grupo A1** (tienen texto_r2, falta idea matriz → re-extraer+embeber): `18303-15 18328-05 18330-07 18334-10 18361-02 18363-06 18364-07`
- **Grupo A2** (sin texto_r2 → ingerir fuente→R2→extraer→embeber): `18308-11 18314-07 18318-19 18320-18 18324-07 18326-18 18327-07 18354-07 18358-03 18371-21`
- **Grupo A3**: re-embeber los 9 `v1` stale (`--reembed`) tras A1+A2.

### Comandos
```
# DRY-RUN (confirmar que R2 sube el crudo en el log — NO debe degradar a solo-Supabase — y que la idea matriz se extrae)
./packages/fichas/node_modules/.bin/tsx packages/fichas/src/pipeline-cli.ts \
  --boletines 18303-15,18328-05,18330-07,18334-10,18361-02,18363-06,18364-07,18308-11,18314-07,18318-19,18320-18,18324-07,18326-18,18327-07,18354-07,18358-03,18371-21 \
  --dry-run
# LIVE (idempotente; background si tarda por rate-limit 2-3s/PDF)
./packages/fichas/node_modules/.bin/tsx packages/fichas/src/pipeline-cli.ts --boletines <misma lista>
# re-embed de los stale
./packages/fichas/node_modules/.bin/tsx packages/fichas/src/pipeline-cli.ts --reembed
```
**Flags:** `--boletines a,b,c` · `--reembed` · `--limite N` · `--dry-run` · `--service-key K` (o `SUPABASE_SECRET_KEY`). El `pipeline-cli` usa `SUPABASE_URL`/`SUPABASE_API_URL` para prod (NO está hardcodeado a local, a diferencia del de agenda — ver Frente B).
**Gotcha A:** idea matriz = PDF del mensaje/moción (`link_mensaje_mocion`/`enlace`) → http→https + unpdf (`texto-fuente.ts`/`extraer.ts`). Si el PDF es 404/inaccesible → honest-null (NUNCA fabricar) y REPORTAR cuáles quedaron sin cobertura y por qué. Extracción = DeepSeek (`json_object` + zod).

---

## FRENTE B — Agenda: citaciones de comisiones + tabla de sala (NUEVO)

### Diagnóstico
`/agenda` sale vacío: "No hay citaciones…" y "Cámara: tabla no disponible". Las tablas `citacion / citacion_invitado / citacion_punto / sesion_sala / sesion_tabla_item` EXISTEN pero están vacías. El paquete **`@obs/agenda` está completo** (connectors Cámara+Senado, parsers de citaciones + tabla Senado, writer, `ingest-cli`, `transport-curl`). Es trabajo de OPERADOR: correr la ingesta por SEMANA ISO.

### Fuentes (CLAUDE.md §1)
- **Cámara citaciones** = `citaciones_semana.aspx` (ASP.NET WebForms `__VIEWSTATE`, GET→POST). **OJO WAF**: igual que el lobby, el WAF de camara.cl bloquea Node fetch → el paquete YA trae `transport-curl.ts` (createCurlTransport) para esto. Confirmar que la corrida lo use (no debe 403).
- **Senado citaciones + tabla de sala** = portal Next.js SSR → `__NEXT_DATA__` (parse-senado-citaciones.ts / parse-senado-tabla.ts). **NO hardcodear `buildId`** (cambia por deploy): leer `__NEXT_DATA__.buildId` de la página.
- **Cámara tabla de sala** = NO existe como dato estructurado (solo PDF). Es honest-degraded POR DISEÑO; la página ya muestra el enlace al PDF oficial. NO intentar parsearla — dejar como está.

### ⚠ BLOQUEANTE de prod: el `ingest-cli` de agenda apunta a Supabase LOCAL
`packages/agenda/src/ingest-cli.ts` lee `SUPABASE_LOCAL_SERVICE_KEY` + `DEFAULT_LOCAL_URL=http://127.0.0.1:54421`. Para escribir a PROD hay que cablear el writer con la URL/key remotas. **Solución:** escribir un thin runner `packages/agenda/src/run-agenda-prod-cli.ts` que MIRRORee el patrón de `packages/lobby/src/run-camara-lobby-cli.ts` (loader `.env` BOM-safe → `SupabaseAgendaWriter({ url: env.SUPABASE_API_URL, serviceKey: env.SUPABASE_SECRET_KEY })`, connectors reales con `createCurlTransport` para Cámara, `runIngest` por rango de semanas). NO escribir secretos en argv.

### Trabajo
1. Crear el `run-agenda-prod-cli.ts` (mirror del de lobby/probidad). Reusa `runIngest`, `CitacionesCamaraConnector` (con curl transport), `SenadoActividadConnector`, `SupabaseAgendaWriter`, `isoWeekOf`/`enumerarSemanas`.
2. Correr LIVE para la **semana ISO actual + las próximas 2** (la agenda es forward-looking; el Senado es forward-only). Cámara por rango `--desde`/`--hasta`; Senado por su ventana.
3. Verificar que `citacion` + `sesion_tabla_item` (Senado) se poblaron para esas semanas.
**Freshness:** la agenda es SEMANAL → para que no vuelva a quedar vacía, dejar recomendado/cableado un job semanal (pg_cron→Edge Function o GitHub Actions L–V) que corra la semana actual+próxima. Si hay tiempo, cablearlo; si no, DEJARLO DOCUMENTADO como deuda con el comando exacto.
**Gotcha B:** el WeekNav de `/agenda` usa la semana ISO actual (`semana-iso.ts`); si ingieres solo una semana pasada no se verá. Ingerir la semana ACTUAL (y siguientes).

---

## FRENTE C — Deploy a producción + verificación (HACER AL FINAL)

Los datos (A y B) se ven SIN redeploy (el front es SSR data-driven). Pero si en B creaste/cambiaste CÓDIGO (el nuevo CLI no afecta el bundle del front; solo afecta si tocaste `app/`), redeploy. **Igual hacer un deploy final + barrido** para dejar la página "en producción" como pidió el usuario:

```
# Build OpenNext en Linux/Docker vía PowerShell (Git Bash mangla /host; Windows da EPERM por symlinks)
docker rm -f obs-cf-build 2>$null; docker run --name obs-cf-build -v "C:\Users\Carlo\OneDrive - pjud.cl\Documentos\GitHub\Observatorio:/host" node:22-bookworm bash /host/docker-cf-build.sh
docker cp "obs-cf-build:/build/app/.open-next" "<repo>\app\.open-next"   # ruta Windows explícita; borrar .open-next previo
docker rm -f obs-cf-build
cd app; .\node_modules\.bin\wrangler deploy   # wrangler YA autenticado (OAuth, workers:write)
```
**Verificación en prod** (`observatorio-congreso.thevalis.workers.dev`, vía curl SSR — browseros NO corre en este entorno):
- `/buscar?q=protección de datos personales` → resultados on-topic mejoran; off-topic ("recetas de cocina") sigue "Sin resultados" (piso 0.59).
- `/agenda` → citaciones de comisiones de la semana actual aparecen; tabla de sala del Senado aparece; Cámara tabla sigue mostrando el PDF (honest, OK).
- Invariantes intactos: `/red` 404, `/contraparte` 404 (gated-OFF), noindex, sin partido.

---

## Env / reglas comunes
- `.env` BOM-safe (extraer con node, NO el CLI supabase). Vars: `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL` (pooler sa-east-1, psql directo — NUNCA `db push`, drift ≤0025), `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `R2_*` (bucket `observatorio`).
- **pnpm, no npm** (workspace). `psql` con `PGCLIENTENCODING=LATIN1` si hay bytes inválidos en datos.
- Verificación de cobertura A en DB:
  `PGCLIENTENCODING=LATIN1 psql "$DB_URL" -At -c "select count(*) filter(where idea_matriz is not null and idea_matriz<>'') con_idea, count(*) filter(where cuerpos_legales is not null and jsonb_array_length(cuerpos_legales)>0) con_cuerpos, count(*) total from proyecto_ficha; select embedding_version, count(*) from proyecto_embedding group by 1;"`
- Verificación de cobertura B en DB:
  `PGCLIENTENCODING=LATIN1 psql "$DB_URL" -At -c "select 'citacion='||count(*) from citacion; select 'sesion_tabla_item='||count(*) from sesion_tabla_item;"`

## Estado del repo al hacer este handoff
Rama `master`, árbol limpio. Últimos commits: `2e00aaa` (este handoff), `7fe998a` (patrimonio bienes), `7993356` (piso búsqueda 0.59). v3.0 automatable en vivo (version `5aa97388`). Gates humanos pendientes: 29 (RUT), 30/31 (legal F13/F17). Contexto de fondo: `[[v3-datos-progreso-y-gotchas]]`.
