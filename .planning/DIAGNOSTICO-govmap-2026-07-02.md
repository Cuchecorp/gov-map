# DIAGNÓSTICO COMPLETO — gov-map.com (2026-07-02)

Auditoría de tres frentes: (1) sitio en vivo navegado con browser, (2) mapa del frontend en código, (3) inventario de datos PROD vía psql (solo lectura) + deuda documentada en `.planning/`. Objetivo: insumo para milestone de mejora de presentación, cruces y corrección de bugs.

---

## 0. HALLAZGO MAYOR — el estado de datos contradice la deuda documentada

La auditoría 44 (2026-06-26) midió **10 votaciones / 1.389 votos**. PROD hoy tiene:

| Tabla | Filas (2026-07-02) |
|---|---|
| `votacion` | **133** (120 Cámara / 13 Senado), 22 boletines distintos |
| `voto` | **18.700** (93% confirmados; 546 `ausente`) |
| `lobby_audiencia` | 17.760 (5.106 confirmadas — solo diputados) |
| `declaracion` | 1.060 (136 parlamentarios) + 8.376 bienes |
| `proyecto` | 136 (`autores` vacío en **136/136**) |
| `proyecto_ficha` / `embedding` | 74 / 74 (60 con idea matriz) |
| `arista` (grafo) | 7.394 |
| `cruce_senal` | 30 (limitado: solo 34/17.681 contrapartes clasificadas con sector) |
| `contrato` / `aporte` / `entidad_tercero` | **0 / 0 / 0** |

**Consecuencia**: la ingesta masiva de votaciones YA corrió. Los gates de F47 (chart votos/ausencias) y F49 (comparativo vs cámara) que estaban "GATED por datos" probablemente **ya están desbloqueados** — re-evaluar antes del próximo milestone. F48 (autoría) sigue bloqueado (`autores` = 0/136).

---

## 1. BUGS — verificados en vivo

### Críticos (rompen la primera impresión)

- **B1. Pill del home "15234-07" → "Proyecto no encontrado".** La portada sugiere un boletín que no existe en la base. El ejemplo LOCKED del hero es un dead-end. Fix: código (elegir boletín existente, o validar pills contra DB). `app/app/page.tsx:23-28`.
- **B2. F45/F46 NO desplegados.** La ficha de parlamentario en vivo es el muro pre-45: sin acordeones, sin índice de chips, sin chart de patrimonio. La ficha de Alessandri vuelca **~89 KB de texto plano** (4.200 líneas de markdown extraído). Fix: **operador** (build Docker Linux + wrangler; cubre F45+F46 en un deploy).
- **B3. Patrimonio muestra URIs crudas de CPLT como valores.** En vivo: `Monto de la deuda: http://datos.cplt.cl/datos/infoprobidad/moneda_6b2366...`, `Acreedor: http://datos.cplt.cl/.../entidad_847`, `Tipo de obligación: .../tipoObligacion_1`. Miles de líneas de basura visual por ficha. F46 lo resolvió para el chart (conteos), pero la **lista** sigue vomitando URIs. Fix: código (filtrar/mapear campos URI a labels o a "no disponible en la fuente"; idealmente dereferenciar CPLT en ingesta).
- **B4. Comparador de declaraciones inalcanzable + copy contradictorio.** En vivo: "Se necesita más de una versión para comparar. **Hay 16 versiones registradas.**" No hay UI para seleccionar versiones — la feature solo funciona por deep-link manual `?comparar=A,B` (ya flagged en 12-UI-REVIEW, nunca cableada). Fix: código.

### Altos (distorsionan la lectura del dato)

- **B5. "Votó distinto a su bancada" ilegible y semánticamente dudoso.** En vivo (Alessandri): 7 filas que muestran **boletín crudo sin título** ("Boletín N°17451-15"), con **duplicados** (14309-04 ×4) y donde **las 7 "rebeldías" son ausencias** ("Su voto: Ausente · Mayoría: A favor"). Una ausencia no es votar distinto; presentarla como disidencia roza la insinuación que el proyecto prohíbe. Fix: código + posible ajuste RPC `rebeldias_de_parlamentario` (excluir ausente/pareo o separarlas), hidratar título, dedupe por votación.
- **B6. Badge de procedencia en ÁMBAR permanente en todo el sitio.** El umbral es 48 h (`lib/format.ts:56-58`) y la ingesta es semanal ⇒ el 100% de los badges están en color alarma ("Actualizado hace 6 días" en naranja). El color de advertencia perdió todo significado y el sitio entero "parece roto/desactualizado". Fix: código (umbral por fuente ~10-14 días, o ámbar solo cuando `fecha_captura` excede el cadence esperado de esa fuente).
- **B7. `/agenda` traga errores de DB (viola doctrina #34).** `CitacionesSection` y `SalaTableServer` desestructuran `{ data }` sin chequear `.error` (`agenda/page.tsx:276-284,404-421`) → un fallo de red se renderiza como "No hay citaciones esta semana" (hecho fabricado). Única página que rompe el patrón honest-states. Fix: código.
- **B8. Timeline de tramitación: chip literal "Cámara origen desconocida"** visible en vivo en eventos tipo `informe`. Fix: código (fallback de label).
- **B9. Rutas sin `error.tsx`**: `/proyecto/[boletin]`, `/parlamentarios`, `/buscar`, `/agenda`. Sus secciones lanzan ante error de RPC → página genérica de Next **en inglés**. Solo parlamentario y contraparte tienen boundary. Fix: código.
- **B10. Copy de lobby hardcodeado a la Cámara en fichas de senadores.** En vivo (Pedro Araya, Senado): "…el registro oficial de **la Cámara (camara.cl/transparencia)**". Fix: código (parametrizar por cámara).
- **B11. "identidad no verificada" en el 100% de las filas de lobby.** La contraparte nunca se verifica (por diseño P11, `contraparte_id` siempre NULL) ⇒ el marcador aparece en todas las filas y en todos los cruces. Es ruido que erosiona confianza en vez de darla. Fix: producto/código (mostrar el caveat una vez por sección, o solo cuando exista pipeline de verificación de terceros).

### Medios

- **B12. Fechas con locale mal capitalizado**: "Jueves, 2 **De** Julio" en headers de agenda. Fix: código.
- **B13. Nombre de comisión truncado**: "de Desafíos del Futuro, Ciencia…" (pierde el prefijo "Comisión"; primera letra en minúscula como título de card). Fix: ingesta o presentación.
- **B14. Votación del Senado sin desenlace**: card del 27-ago-2024 muestra totales pero sin "El proyecto fue…" ni "Resultado:" (resultado null en fuente Senado) — inconsistente con las cards de Cámara. Fix: código (línea explícita "desenlace no informado por la fuente").
- **B15. "Autores no informados." en proyectos Mensaje.** Un Mensaje no tiene autores parlamentarios; el copy correcto es "Iniciativa del Ejecutivo". Además `autores` = 0/136 → TODOS los proyectos dicen "no informados". Fix: código (caso Mensaje) + datos (ingesta autores para mociones).
- **B16. Diputados sin distrito/región en el directorio.** Solo los senadores muestran "Circunscripción · Región"; las 155 filas de diputados muestran solo chip+nombre. Gap de datos (`distrito`/`region` null para diputados). Fix: datos.
- **B17. `fecha_presentacion` sin guard en la lista de patrimonio**: `VersionRow` hace `new Date(version.fecha_presentacion)` sin el guard WR-03 que sí tiene el chart (`patrimonio-de-parlamentario.tsx:383,713-720`) → riesgo "Invalid Date" renderizado. Fix: código.
- **B18. Pertinencia de búsqueda floja y sin cobertura declarada.** El pill del home "protección de datos personales" devuelve consumidores/transporte; el corpus embebido es 74/136 y el universo es 136 proyectos en tramitación (no incluye los emblemáticos ya promulgados). No se comunica el alcance ("buscamos entre N proyectos ingresados desde X"). Fix: producto/datos.
- **B19. Timeline con eventos duplicados de urgencia**: cada urgencia genera 2 eventos ("Cuenta del Mensaje que hace presente la urgencia Suma" + evento `urgencia: Suma` misma fecha). En 14309-04 son ~30 pares. Fix: presentación (colapsar) o ingesta (dedupe).

### Latentes (en código, se activan con flags/datos)

- **B20. `RedGraph`: `nodosVisiblesIds` computado y nunca usado** → al filtrar aristas quedan nodos huérfanos (`red-graph.tsx:164-175`); `posicion()` tiene `Math.floor(index/1)` no-op — layout "carriles" no implementado (`:95-104`). Se activa al encender NET.
- **B21. `/red` sin selector de semilla** — si se enciende el flag, el estado inicial es un dead-end textual sin forma de elegir parlamentario; y **ninguna ficha enlaza a `/red?seed=`**.
- **B22. Cap 1000 en conteo de votos presentado como exacto** (`parlamentario-resumen-conteos.ts:109-116`) — con 18.7k votos ya en DB, hay diputados con >107 votos hoy; verificar cuán cerca están del cap. Real fix = RPC de count.
- **B23. `noIngestado` hardwired `false` en `VotosSection`** (`votos-por-parlamentario.tsx:617`) — parlamentario sin ingesta se muestra como "sin votaciones" (estado deshonesto); el chip F45 sí deriva 3-estado → chip y sección discreparán tras el deploy.
- **B24. Paginación inconsistente** (`normalizarPagina` estricta solo en votos; `parseInt||1` en el resto); **búsqueda re-embebe y pide `PAGE_SIZE*page+1` vecinos por página** (costo creciente); `LEGISLATURA_VIGENTE=58` hardcodeado; `.dev.vars.example` pide ANON key pero el código exige SECRET (onboarding local roto); componente muerto `voto-ficha-row.tsx` (231 líneas).
- **B25. `forceMount` en acordeones F45**: los 5-7 carriles viajan completos en el HTML aunque colapsados — con patrimonio de 1.600+ líneas por ficha el peso de página sigue alto tras el deploy. Considerar detalle server-driven (`?ver=`) también para bienes, o paginar bienes.

### Seguridad / operacional

- **B26. Rotar DB password de Supabase** (expuesto en transcript 2026-06-18; deuda v1.0 aún abierta). Operador.
- **B27. Sin CI quality gate** (TEST-02/07 del ledger 43): con Camino A, el guard estático `lockdown-guard.test.ts` es la única muralla PII y no corre en CI obligatorio. Operador.
- **B28. Legacy JWT de Supabase sin desactivar** (deuda Camino A). Operador.

---

## 2. PRESENTACIÓN Y SOBRECARGA COGNITIVA

### 2.1 Ficha de parlamentario (la página más crítica)

Estado en vivo: una columna con TODO expandido. Votaciones = lista de ~107 votos donde un solo proyecto ("Para la reconstrucción nacional") aporta **~90 líneas visualmente idénticas** ("En contra PRIMER TRÁMITE 20 may 2026 · Rechazado 72–79") sin nada que las distinga. Patrimonio = 3.900 líneas de `<dl>` con fojas, roles de avalúo y URIs.

Lo que el deploy F45/F46 ya arregla: acordeones colapsados + índice de chips + chart de conteos de patrimonio.

Lo que F45/F46 NO arregla (propuestas nuevas):

1. **Agregar por proyecto, no listar por voto.** El arco por proyecto debería mostrar UNA línea-resumen ("Votó en 45 ocasiones sobre este proyecto: 28 a favor · 15 en contra · 2 ausente, entre may 2026 y jun 2026") con las líneas individuales bajo un "ver detalle". El 90% del volumen de la sección desaparece sin perder un dato.
2. **Suprimir "De qué trata: no disponible aún"** cuando idea_matriz es null (hoy se repite en casi todos los arcos — es ruido, no honestidad; la honestidad va una vez por sección).
3. **Patrimonio: versión = tarjeta-resumen** (fecha, tipo, conteos por categoría de bien — los mismos datos del chart F46) con "Ver detalle" server-driven; jamás el `<dl>` completo inline. Filtrar todo campo cuyo valor sea URI.
4. **Lobby: agrupar por contraparte** ("Enel Chile — 4 reuniones: fechas...") con orden por frecuencia además del cronológico. Hoy 146 reuniones = 8 páginas planas. La pregunta ciudadana es "¿con quién se reúne más?", no "¿qué pasó el 16 de junio?".
5. **Un dato de asistencia arriba**: "Presente en 107 de 114" ya existe — subirlo al header/resumen como el dato más digerible de la ficha.
6. **Cabecera pobre**: hoy solo chip+nombre+cargo. Sin foto ni partido (LOCKED legal), pero puede llevar región/distrito, período, y los chips-resumen F45.

### 2.2 Ficha de proyecto

1. **"¿Dónde está hoy?" arriba.** El proyecto 14309-04 está en Comisión Mixta con urgencia Suma — para saberlo hay que leer 100 eventos. Falta un bloque de estado actual (etapa + último hito + urgencia vigente + hace cuánto) como primer elemento tras el header.
2. **Timeline en dos niveles**: hitos estructurales (ingreso, informes, votaciones, oficios, cambios de trámite) siempre visibles; el ruido repetitivo (30 pares de urgencia "retira y hace presente") colapsado en una sola línea por período ("Urgencia Suma renovada 12 veces entre jun 2021 y jun 2026 — ver todas"). Hoy la señal está enterrada.
3. **Procedencia una vez por sección**, no un badge por evento (100+ badges ámbar idénticos en una ficha).
4. **Votaciones agrupadas por jornada/trámite** con explicación del porqué de múltiples votaciones el mismo día (general/particular/quórum LOC/modificaciones). Hoy 7 cards sueltas, dos del mismo día 2021 con resultados opuestos sin explicación.
5. **Roll-call (`VotoDetalle`) es la joya escondida** — el detalle por parlamentario existe pero está tras un expandible discreto. Darle jerarquía: "¿Cómo votó cada diputado?" con mini-resumen por bancada cuando exista.
6. **Similares con umbral más honesto**: hoy muestra 5 aunque la similitud sea baja (transporte escolar como "similar" de subvenciones de reingreso). Cortar por score mínimo y decir "no encontramos proyectos cercanos" cuando corresponda.

### 2.3 Directorio de parlamentarios

- 186 filas planas idénticas (chip+nombre). Propuesta: fila con territorio (arreglar B16), período, y 2-3 micro-conteos (votaciones registradas / reuniones de lobby / declaraciones) que ya están calculados por las RPCs de conteo F45 — convierte el directorio en un mapa de cobertura y da razones para clickear.
- Agrupar u ordenar por región como opción; hoy solo alfabético con filtro por texto.

### 2.4 Agenda

- Semana actual con 2 citaciones (solo Senado) — si la semana está rala, mostrar además "próximos eventos" de semanas siguientes en vez de una página casi vacía con navegación a ciegas.
- Truncar materia en la tabla de sala (hoy una acusación constitucional mete ~12 líneas en una celda).
- Falta cruce inverso: en la ficha de proyecto no se ve "este proyecto está citado en comisión el jueves" — el dato existe (`citacion_punto.boletin`).

### 2.5 Global

- **No hay footer** — licencia CC BY 4.0, metodología, fuentes y contacto deberían estar en cada página (hoy la atribución vive solo dentro de secciones).
- **Home = solo buscador.** No hay ninguna señal de vida ("qué se votó esta semana", "proyectos con urgencia", "última actualización de datos"). Un módulo de actualidad convertiría la portada en razón de retorno diario y expondría los cruces.
- **Tres buscadores desacoplados** (proyectos semántico / agenda FTS / directorio por nombre). Unificar al menos la entrada: un buscador global que detecte boletín → ficha, nombre → parlamentario, texto → proyectos+citaciones.
- **Sin sitemap/noindex**: `PUBLIC_INDEXABLE` sigue OFF — decisión pendiente de sign-off, pero recordar que mientras tanto Google no existe como canal.

---

## 3. CRUCES

### 3.1 Ya implementados (RPC + UI)

| Cruce | Estado |
|---|---|
| Parlamentario × votación × proyecto (con desenlace) | LIVE |
| Disciplina de bancada (`rebeldias_`) | LIVE pero defectuoso (B5) |
| Parlamentario × lobby | LIVE (solo diputados) |
| Parlamentario × patrimonio (historial + comparación) | LIVE; comparador inalcanzable (B4) |
| Parlamentario × sector de lobby (`cruce_senal`) | LIVE pero raquítico: 30 señales porque solo 34/17.681 contrapartes tienen sector |
| Co-lobby entre parlamentarios (grafo, 7.394 aristas) | datos listos, UI gated (`NET_PUBLIC_ENABLED` OFF pese a dossier F17 firmado) |
| Agenda × proyecto por boletín | LIVE (solo ida; falta vuelta proyecto→agenda) |
| Proyecto × similares (kNN) | LIVE, pertinencia floja (B18) |
| Contraparte × dinero | código listo, 0 datos, gated F13 |

### 3.2 Posibles HOY sin ingesta nueva (mayor ROI)

1. **Lobby × tramitación (ventana temporal)** — "qué reuniones registró X mientras se tramitaba el boletín Y" / "quiénes se reunieron con diputados la semana en que la comisión vio el proyecto". Tablas: `lobby_audiencia(fecha, materia)` × `tramitacion_evento`/`citacion_punto(boletin, fecha)`. Yuxtaposición pura con fuente — compatible con la doctrina anti-causalidad si se presenta como "en el mismo período".
2. **Asistencia comparada** — 546 ausencias en 18.7k votos; "Presente en 107 de 114" ya se muestra por ficha. Falta el agregado vs promedio de cámara (= F49, cuyo gate de datos ya se cumplió). Requiere RPC nueva allowlisted.
3. **Tiempos de tramitación** — 1.329 eventos 2016-2026: "este proyecto lleva N días en etapa X; el 80% de ese tiempo esperando informe de Hacienda". Sin tabla `comision` propia, pero parseable de `descripcion` o cruzable con `citacion.comision`.
4. **Mapa de votación por votación individual** — "quiénes votaron sí/no en V" ya existe como roll-call; agregación por bancada dentro de UNA votación es presentación, no señal acumulada (el acumulado co-votación está vetado por el dossier NET).
5. **Panorama de urgencias del Ejecutivo** — las urgencias son eventos: "proyectos con urgencia vigente esta semana" como módulo del home/agenda.

### 3.3 Bloqueados y su desbloqueador

| Cruce | Bloqueador | Acción |
|---|---|---|
| Votación × sector (lobby o patrimonio) | `proyecto_ficha.sector_id` = 0/74; contrapartes 34/17.681 clasificadas | **Correr el clasificador sectorial** (pipeline CRUCE ya escrito) — enciende de verdad `cruce_senal` y habilita votación×sector |
| Cualquier cruce robusto por contraparte (lobby×contratos×aportes, invitados de comisión×lobbistas) | `entidad_tercero` = 0 (el join actual del grafo es `lower(trim(nombre))`) | **Backfill entity-resolution de terceros** (migraciones 0034-0037 listas, pipeline sin correr) |
| Proyectos presentados por X (+ todo cruce de autoría) | `proyecto.autores` = 0/136 | Ingesta de autores + resolución nombre→id (F48) |
| Lobby de senadores | fuente/blocking pendiente | Ingesta leylobby Senado |
| MONEY (contratos/aportes) | sign-off legal F13 + RUT-01 (seed humano de RUTs) | Operador/humano |

---

## 4. PLAN DE ATAQUE SUGERIDO (para próxima sesión)

**P0 — Operador (sin código, máximo impacto):**
deploy F45+F46 (Docker+wrangler; un deploy cubre ambos) · flip `NET_PUBLIC_ENABLED` (dossier firmado; antes resolver B20/B21) · rotar DB password · verificación visual post-deploy (checklist en 45/46-UI-REVIEW).

**P1 — Quick wins de código (1 fase corta):**
B1 pill home · B6 umbral ámbar · B10 copy lobby Senado · B12 locale fechas · B8 "origen desconocida" · B14 desenlace null · B15 copy Mensaje · B17 guard fecha · B9 error.tsx ×4 · B7 agenda honest-errors · suprimir "De qué trata: no disponible" repetido.

**P2 — Legibilidad profunda (fase de diseño):**
resumen de votos por proyecto + detalle colapsado (mata las 90 líneas) · timeline dos niveles con urgencias colapsadas + bloque "¿dónde está hoy?" · patrimonio tarjeta-resumen + detalle bajo demanda + filtro URIs (B3) · comparador cableado (B4) · rebeldías con título/dedupe/sin-ausencias (B5) · lobby agrupado por contraparte · provenance por sección · footer global.

**P3 — Cruces nuevos (datos ya disponibles):**
clasificador sectorial (desbloquea cruces reales) · asistencia comparada (F49, gate ya cumplido — re-evaluar F47 también) · lobby×tramitación temporal · proyecto→agenda inverso · módulo de actualidad en home.

**P4 — Estructural:**
backfill `entidad_tercero` · ingesta autores (F48) · lobby Senado · buscador unificado · OCR fichas bloqueadas · cadencia de ingesta agenda (decisión abierta) · dereferenciar montos CPLT.

---

*Evidencia: navegación en vivo 2026-07-02 (fichas Alessandri D..., Pedro Araya, proyecto 14309-04, agenda semana 27, buscar, /red); conteos PROD vía psql read-only; código en `app/`; artefactos `.planning/phases/43-46`, `44-AUDIT-UX.md`, `44-DATA-INVENTORY.md`, UI-REVIEWs 10-16/45/46, `43-DEBT-LEDGER.md`.*
