# Phase 44 — Inventario de datos (gráficos candidatos → fuente → ¿gap?)

**Fecha:** 2026-06-26 · **Fuente:** lectura de `app/` + `supabase/migrations/` + consultas reales a PROD (psql, pooler sa-east-1).

> Conclusión de una línea: **la data manda sobre la viz.** De 6 gráficos candidatos, **1 es construible hoy con cobertura real (patrimonio, solo conteos)**, 2 son técnicamente posibles pero casi vacíos (votos/ausencias: 10 votaciones en total), y 3 están bloqueados por gaps de ingesta/identidad (comparativo cámara, autoría, similares-del-parlamentario).

## Tabla maestra: gráfico → fuente → ¿existe? → cobertura → qué falta

| # | Gráfico candidato | Fuente real (tabla.columna / RPC) | ¿Data? | Cobertura PROD (2026-06-26) | Qué falta |
|---|---|---|---|---|---|
| 1 | **Votos en el tiempo** (sí/no/abst/pareo/ausente por sesión, fechado) | `voto.seleccion` + `votacion.fecha` vía RPC `votos_de_parlamentario` (ya devuelve `fecha`,`seleccion`,`etapa`,`boletin`) | **PARCIAL (ralo)** | `votacion`=**10 filas** (2021→2026), `voto`=1389 (1154 confirmados); **máx 9 votos por persona** en 5 años; 172 con algún voto | Serie ≤9 puntos. Cuello = **ingesta de votaciones** (solo 10 votaciones cargadas). Degradar fuerte. |
| 2 | **Evolución de patrimonio** (año a año) | `declaracion.fecha_presentacion` (DATE) + RPCs `declaraciones_de_parlamentario`, `bienes_de_parlamentario` (jsonb por tipo) | **PARCIAL (la mejor)** | `declaracion`=**1060**, 136 parlamentarios, **11 años (2016-2026)**; **135 con ≥2 años** → serie viable; `pasivo`=1820, `inmueble`=2841 | **Solo CONTEO de ítems por año**, NO montos: `monto_deuda`/`valor_plaza` son **URIs** (`datos.cplt.cl/.../moneda_<hash>`), nunca números → magnitud = gap de ingesta CPLT. Mezcla tipos de declaración (rotular). |
| 3 | **Ausencias en el tiempo** (tasa ausencia/pareo) | derivado `voto.seleccion in ('ausente','pareo')` ÷ total, fechado por `votacion.fecha` | **PARCIAL (muy ralo)** | `voto='ausente'`=**95 filas en TODA la cámara**; denominador por persona ≤9 | Tasa poco significativa con n≤9. **No existe tabla de asistencia** (`%asisten%/%ausen%/%pareo%` → 0 tablas); ausencia es solo un valor del enum de `voto`. |
| 4 | **Ausencias vs resto de la cámara** (su tasa vs promedio/ranking) | — | **GAP** | n/a | **RPC agregada NUEVA** (no hay ninguna que agregue cross-parlamentario). `security definer`, devuelve solo el derivado (tasa propia + promedio/percentil), nunca la maestra. Allowlistear. Además depende de #3 (votos ralos). |
| 5 | **Proyectos como autor/coautor** (listado + métricas por etapa) | `proyecto.autores text[]`, `proyecto.estado/etapa` | **GAP (columna vacía)** | `proyecto`=74 pero **`autores` poblado en 0 filas**; sin RPC parlamentario→proyectos | Falta **ingesta** que pueble `autores` + **resolución nombre→parlamentario_id** (pipeline identidad) + RPC `proyectos_de_parlamentario`. Hoy el único nexo parlamentario↔proyecto es `voto` (votó), no autoría. |
| 6 | **Proyectos sustancialmente similares** (embeddings) | `match_proyectos(query_embedding,count,threshold,exclude_boletin)` + `proyecto_embedding vector(768)` HNSW | **PARCIAL** | `proyecto_embedding`=**74/74**, HNSW cosine vivo, RPC allowlisted | Funciona a nivel **proyecto**. Para "similares entre los proyectos de un parlamentario" está **bloqueado por #5** (sin autoría no hay set de proyectos del parlamentario). |

## RPCs existentes relevantes (+ allowlist público)

`PUBLIC_RPC_ALLOWLIST` vive en `app/lib/lockdown-guard.test.ts:157-173`. Todas las RPCs de la ficha hoy están allowlisted.

| RPC | Mig | Devuelve | Allowlist |
|---|---|---|---|
| `votos_de_parlamentario(text,int,int)` | 0019→0028 | filas confirmadas con `fecha,seleccion,etapa,boletin` + (0028) `titulo,idea_matriz,resultado,totales,quorum`; `security invoker`, orden `fecha DESC` | SÍ |
| `rebeldias_de_parlamentario(text)` | 0019 | `votacion_id,boletin,fecha,seleccion_propia,mayoria_bancada`; `security definer` | SÍ |
| `declaraciones_de_parlamentario(text)` | 0022 | metadata por versión: `fecha_presentacion,tipo,cargo,organismo,enlace,licencia`; `security definer` | SÍ |
| `bienes_de_parlamentario(text)` | 0031 | `fecha_presentacion,tipo_bien,contenido jsonb,enlace,licencia` (6 tipos) | SÍ |
| `comparar_declaraciones(text,date[])` | 0022→0031 | filas etiqueta/valor literal por versión; **CERO delta/veredicto** | SÍ |
| `match_proyectos(vector,int,float8,text)` | 0011 | `boletin,similarity` (kNN cosine, self-exclusion) | SÍ |
| `parlamentario_publico` / `parlamentarios_publico` | 0020/0026 | cabecera PII-safe (incluye `periodo`) | SÍ |
| lobby/contratos/aportes/agregado/cruces/subgrafo | 0021-0041 | secciones (MONEY/CRUCES gated) | SÍ |

**No existe ninguna RPC de agregación a nivel cámara** (promedios/rankings/percentiles). La única "agregación" es `agregado_por_contraparte` (un parlamentario) y `subgrafo_red`. Nada comparativo entre parlamentarios → todo el frente "vs cámara" es RPC nueva.

## Columnas con FECHA (clave para series temporales)

| Columna | Tipo | Sirve para | Cobertura |
|---|---|---|---|
| `votacion.fecha` | `timestamptz` | eje X charts 1 y 3 | 10 filas, 0 null, 2021→2026 |
| `voto.seleccion` | enum `si/no/abstencion/pareo/ausente` | valor de serie 1/3 (`voto` **no tiene fecha propia** → join a `votacion.fecha`) | 1389 filas |
| `declaracion.fecha_presentacion` | **`date`** | eje X chart 2 | 1060 filas, 2016→2026, 11 años |
| `declaracion.tipo` | text (10 tipos) | filtrar versiones comparables (periódica vs rectificación vs cese) | — |
| `*.fecha_captura` | `timestamptz` | provenance/frescura, **NO** eje del dato | todas |
| `proyecto` | sin fecha de presentación (solo `fecha_captura`) | — | no apto para timeline de autoría |

## GAPS que requieren acción fuera de la viz

1. **Chart 4 (vs cámara) — RPC NUEVA.** p.ej. `tasa_ausencia_comparada(p_id) → {tasa_propia, promedio_camara, percentil, n}`, `security definer`, sin proyectar identidad. Allowlistear.
2. **Chart 5 (autoría) — INGESTA + IDENTIDAD + RPC.** `proyecto.autores` vacío (0/74). Requiere poblar autores + resolver nombre→`parlamentario_id` + RPC `proyectos_de_parlamentario`.
3. **Chart 2 (magnitud patrimonio) — INGESTA.** montos = URIs; graficar magnitud necesita re-ingesta dereferenciando CPLT. Mientras: solo **conteo de bienes/pasivos por declaración**.
4. **Charts 1/3 (votos/ausencias) — INGESTA.** 10 votaciones es insuficiente para una tendencia honesta. Necesita re-ingesta de votaciones masiva (la Phase 27 no logró cobertura real).

## Honestidad / dónde degrada

- **Votos/ausencias (1,3): casi vacíos** — ≤9 puntos/persona. Mostrar "datos insuficientes para una tendencia" o el conteo crudo, NUNCA una curva que aparente densidad.
- **Patrimonio (2): mejor cobertura** — serie real viable, pero **solo conteos**, con caveat montos-como-URI y rótulo de tipo de declaración.
- **Autoría (5): cero hoy** — estado honesto "aún no ingerido" (patrón `noIngestado` ya usado en `votos-por-parlamentario.tsx`/`patrimonio-de-parlamentario.tsx`).
- **Similares (6):** 74 embeddings cubren el universo; útil en la ficha del parlamentario solo tras resolver autoría.

## Seguridad (Camino A, recordatorio)

El árbol público corre con `service_role` (bypassa RLS). **Toda RPC nueva** debe ir al `PUBLIC_RPC_ALLOWLIST` (`app/lib/lockdown-guard.test.ts:157`) o el guard CI falla; **prohibido `.from('parlamentario')`** directo (lista PII en `lockdown-guard.test.ts:125-136`) — leer siempre vía RPC PII-safe. Cualquier RPC nueva jamás proyecta `rut`/donante crudo.

## Archivos clave
- Ficha: `app/app/parlamentario/[id]/page.tsx`
- Secciones: `app/components/{votos,lobby,patrimonio,contratos,financiamiento,cruces}-de-parlamentario.tsx`
- Migraciones: `0008` (voto/votacion/proyecto.autores), `0019`+`0028` (votos RPC), `0011` (embeddings/match_proyectos), `0022`+`0031` (probidad/bienes), `0005` (maestra)
- Guard/allowlist: `app/lib/lockdown-guard.test.ts:157-173`
