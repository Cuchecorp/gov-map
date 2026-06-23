# HANDOFF — Cobertura de búsqueda: ingerir texto faltante + extraer idea matriz + re-embeber

**Fecha:** 2026-06-23 · **Para:** ventana nueva (contexto limpio) · **Objetivo:** subir la relevancia de `/buscar` cerrando la brecha de DATOS (no del motor).

## Por qué (diagnóstico ya hecho)
El motor de búsqueda está bien: el documento embebido es **título + materia + idea matriz + cuerpos legales (normas que modifica)** — ver `packages/fichas/src/embed-ficha.ts` `componerTextoEmbed` (orden: titulo → materia → idea_matriz → cuerpos serializados). NO es title-only por diseño.

La relevancia floja viene de **cobertura de datos**, no del embedding. Estado actual (74 fichas):
- 57/74 con idea matriz · 60/74 con cuerpos legales · 64/74 con texto_r2 · **11/74 solo título**.
- Embeddings: 65 `v1-reembed` (ricos) · **9 `v1` viejos (title-only, stale)**.

## El trabajo (3 grupos, todo vía R2 — convención LOCKED de 2 etapas)

> **REGLA R2 (el usuario insistió): NO estresar el server.** Etapa 1 = fuente → **R2 crudo** content-addressed (`fuente/recurso/fecha/sha256`, PUT `If-None-Match:*`, 412=ya existía=OK). Etapa 2 = **R2 → Supabase** (parse/extract/embed leen del crudo, no re-golpean la fuente). El `pipeline-cli` YA respeta esto: R2 está "gateado por presencia de credencial" → con `R2_*` en `.env` persiste el crudo a R2 antes de extraer. Verificar que R2 esté activo en la corrida (no debe degradar a solo-Supabase).

**Grupo A — tienen texto_r2 pero NO idea matriz (solo re-extraer + re-embeber):** 7 boletines
`18303-15 18328-05 18330-07 18334-10 18361-02 18363-06 18364-07`

**Grupo B — sin texto_r2 (ingerir fuente → R2 → extraer → embeber):** 10 boletines
`18308-11 18314-07 18318-19 18320-18 18324-07 18326-18 18327-07 18354-07 18358-03 18371-21`

**Grupo C — re-embeber los 9 `v1` stale** una vez que A+B tengan idea/cuerpos (para que dejen de ser title-only). `--reembed` bumpea la versión de embedding.

## Cómo (entry point que YA existe)
`packages/fichas/src/pipeline-cli.ts` — ensambla Fetcher/HostRateLimiter/RobotsGuard (orden LOCKED rate-limit 2-3s) + DeepSeekProvider (extracción) + GeminiEmbeddingProvider (768, L2) + R2Store + SupabaseFichasWriter. Flags:
- `--boletines a,b,c` lista explícita (salta descubrimiento)
- `--reembed` reprocesa TODO con bump de versión
- `--limite N` · `--dry-run` (no escribe; corre fetch/extract/embed)
- `--service-key K` o `SUPABASE_SECRET_KEY` del entorno

Correr con el tsx del paquete (pnpm workspace, NO npm):
```
# 1) DRY-RUN primero (verifica que R2 esté activo + que el texto fuente baje + idea matriz se extraiga)
./packages/fichas/node_modules/.bin/tsx packages/fichas/src/pipeline-cli.ts \
  --boletines 18303-15,18328-05,18330-07,18334-10,18361-02,18363-06,18364-07,18308-11,18314-07,18318-19,18320-18,18324-07,18326-18,18327-07,18354-07,18358-03,18371-21 \
  --dry-run

# 2) LIVE (escribe ficha + embedding a prod). Idempotente. Background si tarda (rate-limit 2-3s/PDF).
./packages/fichas/node_modules/.bin/tsx packages/fichas/src/pipeline-cli.ts --boletines <misma lista>

# 3) (si quedan v1 stale con idea ya poblada) re-embeber:
./packages/fichas/node_modules/.bin/tsx packages/fichas/src/pipeline-cli.ts --reembed
```

## Env (`.env`, BOM-safe — extraer con node, NO el CLI supabase)
`SUPABASE_API_URL` (REST) · `SUPABASE_SECRET_KEY` (sb_secret_) · `DEEPSEEK_API_KEY` · `GEMINI_API_KEY` · `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT_URL`/`R2_BUCKET=observatorio`.
DB directo: `SUPABASE_DB_URL` (pooler sa-east-1) por `psql --db-url` (NUNCA `supabase db push` — drift schema_migrations ≤0025; BOM rompe el CLI).

## GOTCHAS (verificados, no obvios)
- **Idea matriz = PDF del mensaje/moción**: `link_mensaje_mocion` (o `proyecto.enlace`) es PDF → el código hace **http→https + unpdf**. Si el link es 404/inaccesible, queda honest-null (NUNCA fabricar). Ver `packages/fichas/src/texto-fuente.ts` + `extraer.ts`.
- **R2 gateado por credencial**: confirmar en el log de la corrida que dice que sube a R2 (no "degrada"). El crudo va a R2; Supabase es derivado.
- **NO requiere redeploy**: el frontend lee los embeddings de Supabase en vivo (SSR). Re-embeber actualiza `proyecto_embedding` y `/buscar` mejora al instante. (Si tocaras CÓDIGO del front, sí: build OpenNext en Docker/Linux vía PowerShell + `wrangler deploy`, ver `docs/deploy-cloudflare.md` / [[v3-datos-progreso-y-gotchas]].)
- **pnpm, no npm** (workspace). **DeepSeek** hace la extracción (idea matriz/cuerpos) — `json_object`, validar con zod.

## Verificación (cerrar el loop)
1. DB: re-medir cobertura — debe subir idea_matriz y cuerpos, bajar "solo_titulo":
   ```
   PGCLIENTENCODING=LATIN1 psql "$DB_URL" -At -c "select count(*) filter(where idea_matriz is not null and idea_matriz<>'') as con_idea, count(*) filter(where cuerpos_legales is not null and jsonb_array_length(cuerpos_legales)>0) as con_cuerpos, count(*) as total from proyecto_ficha;"
   ```
2. Embeddings: `select embedding_version, count(*) from proyecto_embedding group by 1;` — los 9 `v1` deberían pasar a `v1-reembed` (o la nueva versión).
3. Relevancia LIVE: re-correr el sondeo (embed query Gemini RETRIEVAL_QUERY → RPC `match_proyectos`) con "protección de datos personales" / "40 horas" y confirmar que los boletines recién enriquecidos suben en score y que sigue separando off-topic (<0.59) de on-topic. (El piso `DEFAULT_MATCH_THRESHOLD=0.59` ya está en `app/lib/buscar.ts`.)

## Estado del repo al hacer este handoff
- Rama `master`, árbol limpio. Últimos commits: `7fe998a` (patrimonio bienes), `7993356` (piso búsqueda 0.59), `798021b` (labels cargo/organismo + lobby copy).
- v3.0 frente automatable completo y en vivo (`observatorio-congreso.thevalis.workers.dev`, version `5aa97388`). Gates humanos pendientes: 29 (RUT), 30/31 (legal F13/F17).
- Contexto de fondo: `[[v3-datos-progreso-y-gotchas]]` en memoria.
