# Architecture Research

**Domain:** Observatorio ciudadano de datos públicos (ingesta multi-fuente → procesamiento con LLM/embeddings → servicio API + búsqueda semántica + frontend)
**Researched:** 2026-06-17
**Confidence:** HIGH (stack ya validado en PROJECT.md + Documento Maestro v2.0; decisiones de plataforma verificadas contra docs oficiales de Supabase/pgvector/AGE)

---

## Standard Architecture

### Principio rector arquitectónico

Una sola regla domina todo el diseño: **trazabilidad sobre interpretación**. Cada dato servido debe poder rastrearse a (fuente, fecha, enlace original, snapshot crudo). Esto fuerza un flujo de datos *append-only en el crudo* y *reconstruible* en el normalizado. La arquitectura no es "scraper → DB → web"; es una **tubería con procedencia** donde el crudo en R2 es la fuente de verdad inmutable y Postgres es una proyección derivada y re-construible.

Segundo principio: la **identidad es un subsistema crítico aislado**, no una columna. Un match equivocado produce una afirmación falsa y creíble (riesgo existencial #1). Por eso vive en su propio dominio con compuertas, golden set y auditoría.

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                       CAPA 1 — INGESTA (Deno)                          │
│   "trae crudo respetuosamente, versiona, detecta drift"                │
├──────────────────────────────────────────────────────────────────────┤
│   ┌───────────────── Connector Framework (núcleo común) ──────────┐    │
│   │  rate-limit 2-3s · UA identificado · robots · caché diaria    │    │
│   │  validación de esquema · snapshot versionado · drift detect   │    │
│   └───────┬──────────────┬──────────────┬──────────────┬──────────┘    │
│     ┌─────┴────┐   ┌──────┴─────┐  ┌─────┴──────┐ ┌─────┴──────┐        │
│     │ Cámara   │   │ Senado     │  │ BCN/       │ │ (futuro:   │        │
│     │ doGet    │   │ wspublico  │  │ LeyChile   │ │ SERVEL,    │        │
│     │ .asmx    │   │ XML        │  │ obtxml     │ │ ChileCompra)│       │
│     └─────┬────┘   └──────┬─────┘  └─────┬──────┘ └────────────┘        │
│           └───────────────┴──────────────┘                             │
│                           │ escribe crudo + metadata                   │
├───────────────────────────┼────────────────────────────────────────────┤
│                           ▼                                            │
│   ┌──────────────────────────────────────┐   ┌──────────────────┐     │
│   │   R2 (crudo inmutable, append-only)  │   │ Postgres:        │     │
│   │   {fuente}/{recurso}/{fecha}/raw     │   │ ingest_run,      │     │
│   │   + hash + manifest                  │   │ source_snapshot  │     │
│   └──────────────────────────────────────┘   └──────────────────┘     │
├──────────────────────────────────────────────────────────────────────┤
│                  CAPA 2 — PROCESAMIENTO (Deno / Edge)                   │
│   "normaliza, reconcilia identidad, extrae con LLM, embeddea"          │
├──────────────────────────────────────────────────────────────────────┤
│   ┌───────────┐   ┌──────────────────┐   ┌───────────┐ ┌───────────┐  │
│   │ Parsers/  │──▶│ SUBSISTEMA       │   │ Extracción│ │ Embeddings│  │
│   │ Normaliz. │   │ IDENTIDAD        │   │ LLM (idea │ │ (Gemini)  │  │
│   │ (XML/JSON │   │ (adjudicación)   │   │ matriz,   │ │           │  │
│   │ →modelo)  │   │ determ→LLM→gate  │   │ cuerpos)  │ │           │  │
│   └─────┬─────┘   └────────┬─────────┘   └─────┬─────┘ └─────┬─────┘  │
│         │                  │  ┌──────────────────────────────┐ │       │
│         │                  │  │  Capa LLM/Embedding Provider │ │       │
│         │                  └──│  (routing por criticidad)    │─┘       │
│         │                     └──────────────────────────────┘         │
│         ▼ upsert normalizado          ▼ vectores                       │
├──────────────────────────────────────────────────────────────────────┤
│         CAPA DATOS — Supabase Postgres + pgvector (+ R2 crudo)         │
│   Parlamentario · Proyecto · Votacion · Voto · Tramitacion · Texto    │
│   identity_candidate · golden_set · audit_log · embeddings (HNSW)     │
├──────────────────────────────────────────────────────────────────────┤
│                   CAPA 3 — SERVICIO                                     │
│   ┌──────────────────────┐         ┌────────────────────────────┐     │
│   │ API (Edge Functions /│         │ Frontend Next.js (SSR)     │     │
│   │ PostgREST + RPC)     │◀────────│ fichas, timeline, buscador │     │
│   │ búsqueda semántica   │         │ indicador de frescura      │     │
│   └──────────────────────┘         └────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
        ▲ Orquestación: pg_cron + pg_net + pgmq (cola)  ────────────────┘
```

### Component Responsibilities

| Componente | Responsabilidad (qué posee) | Habla con | Implementación |
|------------|------------------------------|-----------|----------------|
| **Connector Framework** | Política de fetch respetuoso, snapshot, drift, validación de esquema. NO conoce el modelo de dominio. | Fuentes externas (lectura), R2 (escritura crudo), Postgres `ingest_run`/`source_snapshot` | Módulo Deno común + clase base por conector |
| **Conector por fuente** | Conoce *un* endpoint: su URL, su forma cruda, su parser de "qué cambió". | Solo a través del framework | Subclase/implementación por fuente |
| **R2 (crudo)** | Fuente de verdad inmutable. Todo crudo, versionado por fecha + hash. | Escrito por ingesta, leído por procesamiento | Cloudflare R2 (S3 API) |
| **Parsers/Normalización** | Crudo R2 → entidades de dominio (idempotente, re-ejecutable). | Lee R2, escribe Postgres normalizado | Deno, invocado por cola |
| **Subsistema Identidad** | Resolver "este nombre/RUT/PARLID = qué Parlamentario". Único que escribe `parlamentario_id` reconciliado. | Lee candidatos, llama LLM Provider, escribe golden set + audit | Pipeline aislado (ver más abajo) |
| **LLM/Embedding Provider** | Abstracción enchufable; routing por criticidad/sensibilidad. | Llamado por Identidad y Extracción | Interfaz TS + adaptadores |
| **Extracción LLM** | Idea matriz, cuerpos legales desde textos íntegros. | Lee textos R2, llama LLM Provider, escribe campos estructurados | Deno + prompt-cache |
| **Embeddings** | Generar y mantener vectores en pgvector. | Lee texto normalizado, llama Embedding Provider, escribe pgvector | Deno + cola pgmq |
| **API / Servicio** | Exponer fichas, timelines, búsqueda semántica con trazabilidad. NO escribe datos de dominio. | Lee Postgres (RPC/PostgREST), llama Embedding Provider para query-time | Edge Functions + PostgREST |
| **Frontend Next.js** | Render SSR de fichas, buscador, indicador de frescura. | Solo a la API (nunca a fuentes externas — CORS/WAF) | Next.js React |
| **Orquestador** | Disparar ingesta/procesamiento en schedule, manejar reintentos. | pg_cron → pg_net → Edge Function; cola pgmq | Nativo Supabase |

**Límite duro a respetar:** el navegador (Next.js cliente) NUNCA llama fuentes gubernamentales. Todas las llamadas externas salen del backend (WAF gubernamental + CORS). Confirmado en PROJECT.md como regla, no preferencia.

---

## Recommended Project Structure

```
/
├── connectors/                    # CAPA 1
│   ├── framework/                 # núcleo común reutilizable
│   │   ├── base-connector.ts      # clase base: orquesta fetch→snapshot→validate→drift
│   │   ├── rate-limiter.ts        # delay 2-3s, jitter, por-host
│   │   ├── fetcher.ts             # UA identificado, robots, retry/backoff
│   │   ├── cache.ts               # caché diaria (clave: fuente+recurso+día)
│   │   ├── snapshot.ts            # escribe crudo a R2 + manifest + hash
│   │   ├── schema-validator.ts    # valida forma cruda esperada
│   │   └── drift-detector.ts      # compara forma/hash vs snapshot previo → alerta
│   ├── camara/                    # implementa base-connector
│   │   ├── camara.connector.ts    # doGet.asmx (JSON), citaciones (HTML)
│   │   └── camara.schema.ts       # forma esperada del crudo
│   ├── senado/                    # wspublico XML + portal Next.js __NEXT_DATA__
│   ├── bcn/                       # LeyChile obtxml
│   └── _shared/                   # tipos crudos comunes
│
├── processing/                    # CAPA 2
│   ├── normalize/                 # R2 crudo → entidades dominio (idempotente)
│   │   ├── proyecto.normalizer.ts
│   │   ├── votacion.normalizer.ts
│   │   └── tramitacion.normalizer.ts
│   ├── identity/                  # SUBSISTEMA AISLADO (límite propio)
│   │   ├── pipeline.ts            # orquesta las etapas de adjudicación
│   │   ├── deterministic.ts       # atajo: RUT / PARLID / match exacto
│   │   ├── blocking.ts            # genera candidatos (bloqueo por apellido/normalizado)
│   │   ├── adjudicator.ts         # LLM crítico (MiniMax) sobre candidatos
│   │   ├── validation-gate.ts     # compuerta: confianza mínima / abstención
│   │   ├── human-review.ts        # cola de revisión humana
│   │   ├── golden-set.ts          # pares confirmados (verdad de referencia)
│   │   └── audit.ts               # log inmutable de cada decisión
│   ├── extraction/                # idea matriz + cuerpos legales (LLM volumen)
│   └── embeddings/                # genera vectores → pgvector
│
├── providers/                     # CAPA TRANSVERSAL enchufable
│   ├── llm/
│   │   ├── llm-provider.interface.ts
│   │   ├── router.ts              # criticidad/sensibilidad → modelo
│   │   ├── minimax.adapter.ts     # crítico/sensible (identidad)
│   │   └── deepseek.adapter.ts    # volumen (extracción), prompt-cache
│   └── embedding/
│       ├── embedding-provider.interface.ts
│       └── gemini.adapter.ts
│
├── api/                           # CAPA 3 — servicio
│   ├── search/                    # búsqueda semántica (embed query → pgvector)
│   ├── proyecto/                  # ficha + timeline
│   └── _shared/                   # serializadores con trazabilidad (fuente+fecha+link)
│
├── db/
│   ├── migrations/                # esquema relacional + pgvector + RLS
│   ├── rpc/                       # funciones Postgres (search, timeline cross-cámara)
│   └── cron/                      # pg_cron jobs + colas pgmq
│
├── frontend/                      # Next.js (proyecto separado, consume API)
│
└── shared/
    ├── domain/                    # tipos de entidades (Parlamentario, Proyecto...)
    └── provenance/                # tipo Provenance {fuente, fecha, url, snapshotRef}
```

### Structure Rationale

- **`connectors/framework/` separado de cada conector:** el patrón de conector aislado exige que la *política* (rate-limit, caché, snapshot, drift) viva una sola vez. Añadir SERVEL/ChileCompra en M2+ debe ser implementar una subclase, no re-escribir política. El framework no conoce el dominio; los conectores no conocen rate-limiting.
- **`processing/identity/` como carpeta-subsistema:** físicamente aislado porque es el riesgo existencial #1. Es el único módulo autorizado a escribir `parlamentario_id` reconciliado. Cualquier otro código que necesite resolver identidad llama a su API, no replica lógica.
- **`providers/` transversal:** ni Identidad ni Extracción conocen *qué* modelo corre. Solo la interfaz + el router. Cambiar de DeepSeek a otro = un adaptador, cero cambios aguas arriba.
- **`shared/provenance/`:** la trazabilidad es un tipo de primera clase que acompaña cada entidad servida, no un afterthought.
- **`frontend/` separado:** Next.js SSR consume la API; no comparte runtime con Deno backend.

---

## Architectural Patterns

### Pattern 1: Conector aislado sobre framework común (Template Method)

**What:** Una clase base define el flujo invariante (fetch respetuoso → snapshot → validar → detectar drift → emitir crudo); cada conector implementa solo los *hooks* específicos de su fuente.
**When to use:** Toda fuente externa. Es el patrón medular de la Capa 1.
**Trade-offs:** (+) política única, fuentes nuevas baratas, drift uniforme. (−) requiere disciplina para no filtrar conocimiento de dominio al framework.

```typescript
abstract class BaseConnector<Raw> {
  // Hooks que cada fuente implementa:
  protected abstract sourceId: string;
  protected abstract endpoints(): RequestSpec[];
  protected abstract validateShape(body: unknown): Raw;     // schema guard
  protected abstract fingerprint(raw: Raw): string;          // para drift

  // Flujo invariante (no se sobreescribe):
  async run(ctx: IngestRun): Promise<SnapshotRef[]> {
    const refs: SnapshotRef[] = [];
    for (const spec of this.endpoints()) {
      if (await this.cache.hasToday(this.sourceId, spec.key)) continue; // caché diaria
      await this.rateLimiter.wait(spec.host);                 // 2-3s + jitter
      const body = await this.fetcher.get(spec, { ua: IDENTIFIED_UA });
      const raw = this.validateShape(body);                   // falla ruidosa si cambió
      const drift = await this.drift.check(this.sourceId, spec.key, this.fingerprint(raw));
      if (drift.changed) await this.drift.alert(drift);       // no detiene, avisa
      refs.push(await this.snapshot.write(this.sourceId, spec.key, body)); // R2 + hash
    }
    return refs; // procesamiento consume estos refs, no la red
  }
}
```

### Pattern 2: Raw-immutable / normalized-derived (procedencia reconstruible)

**What:** R2 guarda el crudo append-only e inmutable. Postgres es una *proyección* derivada, siempre reconstruible re-ejecutando la normalización sobre el crudo. Normalizadores idempotentes (upsert por clave natural).
**When to use:** Siempre. Es lo que hace defendible la trazabilidad y permite re-procesar sin re-scrapear (cuando mejora el parser/prompt).
**Trade-offs:** (+) re-proceso barato y sin tocar fuentes (respeta WAF), auditoría perfecta, parsers evolucionan sin pérdida. (−) duplicación de almacenamiento (mitigada: R2 barato, Postgres solo normalizado por límite de 8 GB).

```
Ingesta:    fuente → R2://camara/votaciones/2026-06-17/{boletin}.json (+ hash)
                   → Postgres source_snapshot(id, source, key, r2_path, hash, fetched_at)
Procesar:   pgmq.dequeue(snapshot_id) → leer R2 → normalizar → upsert Proyecto/Votacion
Re-proceso: re-encolar snapshot_ids → mismo flujo, parser nuevo, cero red externa
```

### Pattern 3: Pipeline de adjudicación con compuerta (Identidad)

**What:** Cascada de etapas donde cada una resuelve lo que puede y *escala* lo dudoso. El orden barato→caro→humano minimiza costo y maximiza seguridad. La compuerta de validación puede **abstenerse** (no adivinar).
**When to use:** Reconciliación de identidad. Aislado tras una API interna.
**Trade-offs:** (+) seguro por diseño (abstención > falso positivo), costo controlado, auditable. (−) más componentes; requiere golden set y cola humana desde el día uno.

```typescript
// Aislado: nadie fuera de identity/ replica esta lógica.
async function reconcile(mention: Mention): Promise<Resolution> {
  // 1. Determinista (gratis, alta confianza): RUT exacto / PARLID / nombre canónico
  const exact = await deterministic.match(mention);
  if (exact) return confirmed(exact, "deterministic");

  // 2. Blocking → candidatos (reduce espacio de búsqueda)
  const candidates = await blocking.candidates(mention);     // p.ej. mismo apellido
  if (candidates.length === 0) return human.enqueue(mention, "no-candidate");

  // 3. Adjudicación LLM (modelo CRÍTICO/sensible vía router → MiniMax)
  const verdict = await adjudicator.decide(mention, candidates); // {id, confidence, why}

  // 4. Compuerta de validación: umbral + abstención
  if (verdict.confidence >= GATE_HIGH) {
    await goldenSet.add(mention, verdict);                     // alimenta verdad
    await audit.log(mention, verdict, "auto-confirmed");
    return confirmed(verdict.id, "llm");
  }
  // 5. Zona gris → revisión humana (nunca adivina)
  await audit.log(mention, verdict, "escalated");
  return human.enqueue(mention, "low-confidence");
  // 6. Confirmación humana → golden_set → re-alimenta deterministic/blocking
}
```

### Pattern 4: Provider enchufable con routing por criticidad

**What:** Interfaz estable (`complete`, `embed`); un router elige el modelo concreto según *criticidad* (¿una afirmación falsa hace daño?) y *sensibilidad* (¿el dato es personal/protegido por Ley 21.719?).
**When to use:** Todo cómputo LLM/embedding.
**Trade-offs:** (+) swappable por config, modelo final elegido por benchmark sobre golden set, cumplimiento legal centralizado (tier sin-entrenamiento/DPA). (−) abstracción que debe no filtrar features específicas de un modelo.

```typescript
interface LLMProvider {
  complete(req: LLMRequest): Promise<LLMResponse>;
  readonly traits: { tier: "no-train" | "standard"; promptCache: boolean };
}

function routeLLM(task: { critical: boolean; sensitive: boolean }): LLMProvider {
  if (task.critical || task.sensitive) return minimax;   // identidad, datos personales
  return deepseek;                                         // volumen, prompt-cache
}
// Embeddings: provider único hoy (Gemini), misma interfaz para futuro swap.
```

### Pattern 5: Cross-cámara timeline por clave boletín (en la capa de servicio)

**What:** El boletín es la clave que une Cámara y Senado. El timeline de un proyecto se construye con un RPC Postgres que mezcla tramitación de ambas cámaras ordenada por fecha, cada evento con su `Provenance`.
**When to use:** Ficha de proyecto. La unión vive en SQL/RPC, no en el frontend.
**Trade-offs:** (+) una sola fuente de verdad para el timeline, frescura por fuente calculable. (−) requiere normalizar fechas/etapas heterogéneas de dos sistemas distintos.

---

## Modelo de datos relacional (M1) y camino al grafo

### Núcleo relacional

```
Parlamentario (TABLA MAESTRA — respaldada FUERA de Supabase, sí o sí)
  id (PK interna estable) · rut (interno, no expuesto) · parlid_camara · parlid_senado
  nombre_canonico · nombres_variantes[] · camara_origen · vigente · provenance
        ▲                    ▲                         ▲
        │ RUT (más fuerte)   │ nombre normalizado      │ boletín NO aplica aquí
        │ (interno)          │ (puente más usado)      │
        │                    │                         │
Voto (PUENTE) ──────────────┘                          │
  votacion_id (FK) · parlamentario_id (FK, RECONCILIADO) · valor · provenance
        │
        ▼
Votacion                              Proyecto (CLAVE: boletin)
  id · boletin (FK) · fecha           boletin (PK natural) · titulo
  camara · resultado · provenance     idea_matriz · cuerpos_legales[]
        │                             estado · camara_origen · provenance
        └──────── boletin ────────────────────┘
                                              │
                              Tramitacion (eventos por boletin, ambas cámaras)
                              TextoIntegro (link/contenido, ref R2) → Embedding (pgvector)
```

**Las tres llaves de cruce — dónde vive cada una:**

| Llave | Fuerza | Conecta | Uso |
|-------|--------|---------|-----|
| **boletín** | Alta (determinista) | Proyecto ↔ Votacion ↔ Tramitacion ↔ Texto; une Cámara y Senado | Público, clave natural de proyecto |
| **nombre normalizado** | Media (ambiguo) | Mención en fuente ↔ Parlamentario | Puente más usado; entra al pipeline de identidad |
| **RUT** | Máxima | Parlamentario ↔ (futuro: SERVEL, ChileCompra) | **Interno, nunca expuesto** (minimización Ley 21.719) |

Decisión clave: `Voto.parlamentario_id` **solo** lo escribe el subsistema de identidad. Las fuentes traen un *nombre/PARLID*, no un `parlamentario_id`. Esa frontera es lo que contiene el riesgo #1.

### Camino al grafo — sin sobre-construir en M1

| Etapa | Cuándo | Cómo | Por qué no antes |
|-------|--------|------|------------------|
| **Recursive CTEs sobre el relacional** | **M1** | `WITH RECURSIVE` en RPC Postgres para timelines y co-ocurrencias simples | Cero infra nueva; suficiente para fichas y "proyectos similares" (que de hecho es pgvector, no grafo) |
| **Apache AGE (property graph + Cypher)** | M5/M6, *condicionado* | **VERIFICADO: AGE NO está disponible en Supabase managed.** Requiere o (a) segunda DB con `postgres_fdw`, o (b) migrar a Postgres self-hosted/EDB/Azure | No malgastar M1 en infra de grafo que el modelo aún no puede poblar; el grafo de influencia (P6) se habilita cuando hay datos |
| **SPARQL / RDF** | Horizonte lejano | Export a triple-store si se busca interoperabilidad de datos abiertos | Especulativo; solo si aparece demanda de federación |

**Implicación de orden de build:** M1 NO introduce AGE. El modelo relacional se diseña *grafo-amigable* (entidades y puentes explícitos, sin desnormalizar) para que la migración futura a AGE sea un mapeo node/edge directo, pero la decisión de plataforma de grafo se difiere. Esto es una restricción real, no preferencia: AGE en Supabase exige cambiar de plataforma o correr dos DBs.

---

## Subsistema de Identidad — aislamiento arquitectónico

El requisito explícito es "aislarlo arquitectónicamente". Concretamente:

1. **Frontera de API interna:** el resto del sistema llama `identity.reconcile(mention)` / `identity.resolve(parlamentario_id)`. Nadie más hace JOINs por nombre ni adivina RUT.
2. **Propiedad exclusiva de escritura:** es el único componente que escribe `parlamentario_id` reconciliado en tablas puente (`Voto`, futuras menciones de lobby/patrimonio).
3. **Estado propio:** `identity_candidate`, `golden_set`, `audit_log`, cola de revisión humana son tablas del subsistema, no del dominio público.
4. **Modelo propio en el router LLM:** sus llamadas se marcan `critical: true, sensitive: true` → siempre al modelo de alta calidad (MiniMax), tier sin-entrenamiento (RUT = dato personal).
5. **Auditoría inmutable:** cada decisión (auto-confirmada, escalada, humana) queda logueada con candidatos, confianza y razón. Reconstruible.
6. **Realimentación cerrada:** confirmaciones humanas → golden_set → mejoran etapas determinista/blocking. El sistema aprende sin perder la compuerta.

**Por qué importa para el roadmap:** el pipeline de identidad debe existir *antes* de poblar `Voto`, porque sin él los votos no se pueden atribuir con seguridad. Pero la versión M1 puede ser mínima: determinista (PARLID/RUT de `senadores_vigentes.php`) + cola humana, con LLM-adjudicación como capa que se enchufa cuando entran fuentes con nombres ambiguos.

---

## Data Flow

### Flujo de ingesta (escritura)

```
pg_cron (schedule diario)
   → pg_net.http_post → Edge Function "ingest:{fuente}"
      → Connector.run(): rate-limit → fetch (UA id) → validateShape → drift-check
         → R2.write(crudo + hash)         [fuente de verdad inmutable]
         → Postgres.insert(source_snapshot)
         → pgmq.enqueue("normalize", snapshot_id)
```

### Flujo de procesamiento (derivación)

```
pg_cron → Edge Function "process" → pgmq.dequeue("normalize")
   → R2.read(crudo) → normalizer (idempotente) → upsert Proyecto/Votacion/Tramitacion
   → para menciones de parlamentario: identity.reconcile() → escribe Voto.parlamentario_id
   → pgmq.enqueue("extract"|"embed", entity_id)
"extract":  R2.read(texto) → LLM Provider (DeepSeek, prompt-cache) → idea_matriz/cuerpos
"embed":    texto normalizado → Embedding Provider (Gemini) → pgvector (HNSW upsert)
```

> Nota de plataforma (VERIFICADO): background tasks de Edge Functions topan en ~400s (plan Pro). Los lotes pesados (embeddings masivos, extracción) **deben** ser dirigidos por cola (pgmq) y chunked — no un único run largo. El patrón pg_cron + pg_net + pgmq es exactamente el que Supabase documenta para "automatic embeddings".

### Flujo de consulta (lectura, búsqueda semántica)

```
Usuario (Next.js SSR) → API /search?q="..."
   → Embedding Provider (Gemini) embeddea la query
   → Postgres RPC: pgvector <-> (HNSW) top-K + filtros
   → serializa fichas con Provenance {fuente, fecha, url, snapshot}
   → indicador de frescura por fuente (max(fetched_at) por source)
Usuario ← ficha estructurada, cada dato con enlace a la fuente original
```

### Flujo de re-procesamiento (sin tocar la red)

```
Mejora parser o prompt → re-encolar source_snapshot_ids existentes
   → mismo flujo de procesamiento sobre crudo R2 → re-derivación
   → cero llamadas a fuentes gubernamentales (respeta WAF + minimiza scraping)
```

---

## Scaling Considerations

El "escalado" aquí no es usuarios concurrentes (público general, lectura, cacheable vía SSR/CDN) sino **volumen de datos y costo de cómputo LLM**.

| Eje | Arranque (M1) | Crecimiento (M2-M4) | Maduro (M5-M6) |
|-----|---------------|---------------------|-----------------|
| Crudo | R2, pocos GB | R2 escala linealmente, barato | Política de retención por snapshot |
| Postgres | Pro 8 GB, solo normalizado + vectores | Vigilar tamaño de tabla embeddings (HNSW usa memoria) | Particionar histórico; revisar plan |
| pgvector | HNSW desde el inicio (default seguro <1M filas) | HNSW aguanta bien hasta ~1M | Considerar IVFFlat solo si dataset enorme y estático |
| Cómputo LLM | Free tiers (MiniMax 45k/sem, DeepSeek volumen, Gemini embed) | Prompt-cache + re-proceso desde R2 evita recómputo | Modelo final por benchmark; costo por tier |
| Lectura usuarios | SSR + CDN absorbe el grueso | Cachear fichas; búsqueda es lo caro (embed query-time) | Cache de queries frecuentes |

### Scaling Priorities

1. **Primer cuello: cómputo LLM, no tráfico.** Mitigación primaria = crudo inmutable en R2 permite re-procesar sin re-llamar fuentes ni (con prompt-cache) recomputar extracción. Diseñar para idempotencia desde M1.
2. **Segundo cuello: tamaño de Postgres (8 GB).** Por eso el crudo va a R2 y Postgres solo guarda normalizado + vectores. Vigilar el índice HNSW (memoria).
3. **Tercer cuello: ventana de 400s de Edge Functions.** Resuelto por arquitectura de cola (pgmq) desde el inicio, no como parche.

---

## Anti-Patterns

### Anti-Pattern 1: Escribir `parlamentario_id` directo desde el normalizador

**What people do:** El parser de votaciones hace un match por nombre y escribe el FK al vuelo.
**Why it's wrong:** Es exactamente el riesgo existencial #1. Un match silencioso equivocado = afirmación falsa creíble, sin auditoría.
**Do this instead:** El normalizador escribe la *mención* (nombre/PARLID crudo); solo `identity.reconcile()` escribe el FK, con compuerta y abstención.

### Anti-Pattern 2: Postgres como fuente de verdad del crudo

**What people do:** Guardar el JSON/XML/HTML original en columnas de Postgres "por comodidad".
**Why it's wrong:** Revienta el límite de 8 GB, mezcla crudo inmutable con datos derivados, y dificulta el re-proceso.
**Do this instead:** Crudo siempre a R2 (append-only, hash). Postgres guarda solo la referencia (`r2_path`, `hash`) + lo normalizado.

### Anti-Pattern 3: Llamar fuentes externas desde el navegador o sin política central

**What people do:** Fetch desde el cliente Next.js, o cada conector con su propio delay copy-pasteado.
**Why it's wrong:** El WAF gubernamental bloquea ráfagas; CORS lo impide; y el rate-limit divergente entre conectores produce baneos.
**Do this instead:** Todo fetch externo desde backend, vía el Connector Framework con rate-limit/UA/robots únicos.

### Anti-Pattern 4: Construir el grafo (AGE/SPARQL) en M1

**What people do:** Montar Apache AGE "para estar listos" para el observatorio de redes.
**Why it's wrong:** AGE no existe en Supabase managed (verificado) → forzaría cambiar de plataforma o correr dos DBs, gastando M1 en infra que el modelo aún no puede poblar.
**Do this instead:** Recursive CTEs en M1; modelo relacional grafo-amigable; diferir la decisión de plataforma de grafo a cuando los datos existan (P6).

### Anti-Pattern 5: Acoplar el código de dominio a un modelo LLM concreto

**What people do:** Llamar a la SDK de DeepSeek directamente en el extractor.
**Why it's wrong:** El modelo final se elige por benchmark sobre golden set; el cumplimiento legal (tier sin-entrenamiento/DPA) debe ser central y por-tarea.
**Do this instead:** Interfaz `LLMProvider` + router por criticidad/sensibilidad. El extractor no sabe qué modelo corre.

---

## Integration Points

### External Services

| Servicio | Patrón de integración | Gotchas (de PROJECT.md) |
|----------|------------------------|--------------------------|
| Cámara `doGet.asmx` | WS JSON, conector dedicado | `Votos`=null → voto individual NO está aquí (vive en `opendata.camara.cl`, sin validar, bloquea P3) |
| Senado `wspublico` | XML, conector dedicado | `citaciones.php` da 404; citaciones vía portal Next.js `__NEXT_DATA__` |
| Senado portal (citaciones) | Parsear `__NEXT_DATA__` | `buildId` cambia por deploy → autodetectar (caso de drift gestionado) |
| BCN/LeyChile `obtxml` | XML de norma | `obtenerinfoley` obsoleto (404) — no usar |
| Cloudflare R2 | S3 API desde backend | Crudo append-only; clave por fuente/recurso/fecha/hash |
| LLM (MiniMax/DeepSeek) | Vía `LLMProvider` | Tier sin-entrenamiento / DPA — son subencargados (Ley 21.719) |
| Gemini (embeddings) | Vía `EmbeddingProvider` | Free tier; mismo vector model en ingest y query-time |

### Internal Boundaries

| Frontera | Comunicación | Consideraciones |
|----------|--------------|------------------|
| Conector ↔ Framework | Herencia/hooks | Framework no conoce dominio; conector no conoce política |
| Ingesta ↔ Procesamiento | R2 (crudo) + cola pgmq | Desacoplados; procesamiento nunca toca la red externa |
| Normalización ↔ Identidad | API interna `reconcile()` | Identidad es el único escritor de `parlamentario_id` |
| Dominio ↔ Providers | Interfaces TS + router | Sin acoplar a SDK de un modelo |
| API ↔ Frontend | HTTP (PostgREST/RPC) | Frontend nunca llama fuentes externas |
| Orquestación ↔ todo | pg_cron + pg_net + pgmq | Reintentos en la cola; observabilidad en `cron.job_run_details` |

---

## Orden de build sugerido para M1 (dependencias)

El orden lo dictan las dependencias duras, no la conveniencia. M1 = Fundaciones + P2 Tramitación + P1 Búsqueda semántica.

```
0. FUNDACIONES (bloquean todo)
   0a. Connector Framework (rate-limit, caché, snapshot R2, schema, drift)
   0b. Esquema de datos + R2 + tablas source_snapshot/ingest_run
   0c. Interfaces LLMProvider/EmbeddingProvider + router (stubs OK)
        │
        ▼
1. TABLA MAESTRA PARLAMENTARIO + IDENTIDAD (mínima)
   Conector senadores_vigentes.php (+ Cámara) → siembra maestra
   Pipeline identidad: determinista (PARLID/RUT) + cola humana
   (LLM-adjudicación se enchufa después; no bloquea siembra)
        │
        ▼
2. P2 TRAMITACIÓN  (ahora hay maestra para atribuir)
   Conectores Cámara doGet + Senado wspublico → crudo R2
   Normalizadores Proyecto(boletín) + Votacion + Tramitacion
   Voto vía identity.reconcile()
   Timeline cross-cámara (RPC, recursive CTE)
   Frontend: ficha de proyecto + timeline + indicador de frescura
        │
        ▼
3. P1 BÚSQUEDA SEMÁNTICA  (necesita proyectos ya cargados)
   Descarga textos íntegros (Senado links + BCN obtxml) → R2
   Extracción idea matriz/cuerpos (LLM volumen, prompt-cache)
   Embeddings (Gemini) → pgvector HNSW
   Buscador lenguaje natural → fichas con trazabilidad
   "Proyectos similares" por vecindad semántica
```

**Razonamiento de dependencias:**
- **0 antes que todo:** sin framework de conectores no hay ingesta respetuosa; sin esquema/R2 no hay dónde escribir; las interfaces de provider deben existir aunque los adaptadores lleguen después.
- **Identidad (mínima) antes de P2:** `Voto` necesita `parlamentario_id` reconciliado; sin maestra sembrada no hay a qué atribuir. Pero solo la rama determinista bloquea — la LLM-adjudicación se añade cuando entran nombres ambiguos.
- **P2 antes de P1:** la búsqueda semántica embeddea textos *de proyectos*; sin proyectos cargados no hay corpus.
- **Embeddings al final:** dependen de textos íntegros, que dependen de identificar los proyectos (P2). HNSW se puede crear sin datos (no requiere training), así que el índice puede existir temprano y poblarse vía cola.

**Research flags para fases posteriores:**
- `opendata.camara.cl` (voto individual por diputado) **sin validar** → bloquea P3 (M2). Requiere spike de investigación antes de planificar.
- Plataforma de grafo (AGE vs FDW vs migración) → decisión diferida a P6, requiere su propia investigación cuando el modelo esté poblado.

---

## Sources

- PROJECT.md + Documento Maestro de Implementación v2.0 (endpoints validados en vivo 17/06/2026) — HIGH (espec de referencia del proyecto)
- [Supabase Edge Functions — Background Tasks](https://supabase.com/docs/guides/functions/background-tasks) — HIGH (límite ~400s plan pago confirmado)
- [Supabase Edge Functions — Limits](https://supabase.com/docs/guides/functions/limits) — HIGH (wall clock 400s, CPU 2s)
- [Supabase — Automatic Embeddings (pg_cron + pgmq)](https://supabase.com/docs/guides/ai/automatic-embeddings) — HIGH (patrón canónico de orquestación por cola)
- [Supabase — Scheduling Edge Functions (pg_cron + pg_net)](https://supabase.com/docs/guides/functions/schedule-functions) — HIGH
- [pgvector README (HNSW/IVFFlat)](https://github.com/pgvector/pgvector) — HIGH; [análisis 2025/2026 HNSW por defecto <1M filas](https://medium.com/@philmcc/pgvector-index-selection-ivfflat-vs-hnsw-for-postgresql-vector-search-6eff26aaa90c) — MEDIUM
- [Supabase Discussion — Apache AGE no soportado en managed](https://github.com/orgs/supabase/discussions/40285) — HIGH (confirma que AGE no está en el set de extensiones de Supabase)
- [Running Apache AGE: cloud provider landscape](https://gdotv.com/blog/running-apache-age-docker-cloud/) — MEDIUM (FDW dos-DBs / EDB / Azure como vías para AGE)

---
*Architecture research for: Observatorio del Congreso 360 — capa de ingesta/procesamiento/servicio con identidad y LLM como subsistemas*
*Researched: 2026-06-17*
