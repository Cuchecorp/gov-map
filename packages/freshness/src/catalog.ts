/**
 * catalog.ts — configuración declarativa de las 6 fuentes monitoreadas.
 *
 * Fuente→tabla/columna map (derivado de 56-CRON-AUDIT.md "Frescura baseline"):
 *
 * | fuente           | tabla                  | columna          | umbral | notas                                       |
 * |------------------|------------------------|------------------|--------|---------------------------------------------|
 * | leyes            | proyecto               | fecha_captura    | 7d     | última vez que tramitación ingestó           |
 * | agenda           | citacion               | fecha_captura    | 7d     | citaciones y sesiones de tabla               |
 * | lobby-camara     | lobby_contraparte      | fecha_captura    | 14d    | WAF bloquea GH Actions → local semanal      |
 * | lobby-leylobby   | lobby_ingesta_estado   | ingestado_hasta  | 7d     | cobertura por parlamentario (ver CAVEAT)    |
 * | probidad         | declaracion            | fecha_captura    | 30d    | patrimonio/intereses CPLT                   |
 * | fichas           | proyecto_ficha         | fecha_captura    | 30d    | tabla propia del pipeline de fichas         |
 * | chilecompra      | contratos_ingesta_estado | ingestado_hasta | 30d  | marcador de barrido (dist. "0 filas" de "no barrido") |
 * | actualidad-refresh | actualidad_senal     | fecha_captura    | 2d     | panel de actualidad, cadencia intradía L-V  |
 *
 * REGLA (G4, 119-01): cada fuente mide una tabla que llena SU PROPIO cron.
 *   Medir una tabla que llena OTRO cron produce "verde prestado": la avería del cron
 *   propio queda tapada por la frescura que aporta el ajeno. Dos entradas lo padecían y
 *   fueron reapuntadas: `lobby-camara` (medía lobby_audiencia, que también llena el
 *   conector leylobby) y `fichas` (medía proyecto, que llena el cron de tramitación).
 *
 * NOTA lobby-camara vs lobby-leylobby:
 *   Ambas fuentes escriben en lobby_audiencia (sin columna discriminadora "fuente"), así
 *   que NINGUNA de las dos la usa como señal. lobby-camara mide
 *   lobby_contraparte.fecha_captura (solo la escribe el conector de Cámara, vía
 *   `upsertContrapartes`) — esa atribución sí es exclusiva.
 *
 * CAVEAT lobby-leylobby — la atribución NO es exclusiva (119-07, hallazgo de 119-06):
 *   Una versión previa de este comentario afirmaba que `lobby_ingesta_estado.ingestado_hasta`
 *   "solo lo escribe el conector leylobby". Es FALSO y está invertido. `marcarIngestado` vive
 *   en el writer COMPARTIDO (`packages/lobby/src/writer-supabase.ts:145`) y lo invocan LOS DOS
 *   conectores: el de la Cámara (`packages/lobby/src/run-camara-lobby.ts:164`) y —desde 119-06—
 *   el de leylobby (`packages/lobby/src/ingest-run.ts:322`). Empíricamente, las 136 filas
 *   vigentes (`max(ingestado_hasta) = 2026-06-22`) las escribió el conector de la CÁMARA:
 *   leylobby nunca ha confirmado un parlamentario (32 filas, todas `no_confirmado`), porque su
 *   alcance LOCKED son instituciones del EJECUTIVO, cuyos sujetos pasivos no son parlamentarios
 *   (`lobby-leylobby-weekly.yml:3-5`).
 *
 *   Consecuencia honesta: esta señal mide la COBERTURA DE LOBBY POR PARLAMENTARIO —no la
 *   frescura del conector leylobby—, y por eso su `stale:true` NO implica que leylobby esté
 *   caído. Es la dirección espejo del "verde prestado" que G4 erradicó: acá el rojo es prestado.
 *   La señal que sí es propia de leylobby es su huella en `source_snapshot`
 *   (`where source = 'lobby-leylobby'`, existente desde 2026-07-28), que hoy `r2Snapshot` ya
 *   expone al lado. Gap residual y criterio de cierre: `119-GAP-CLOSURES.md` §G12-119.
 *
 * HUECOS DECLARADOS DE COBERTURA (G3, 119-02)
 *
 * Estas unidades de cron del inventario de 118 NO tienen entrada en `CATALOG`, y su ausencia
 * es una DECISIÓN, no un olvido. Un hueco no declarado en el instrumento es indistinguible
 * de un cron sano; declararlo lo convierte en información.
 *
 *   W-3 `backup-parlamentario` — QUEDA FUERA porque NO escribe en Supabase. El workflow
 *     regenera el snapshot y lo commitea al repo (`backup-parlamentario.yml:60-62`,
 *     `supabase/seeds/parlamentario.seed.json`); la carga a DB se omite por diseño (no hay
 *     service key en CI, `:58-59`). Cualquier señal de frescura sobre una tabla mediría el
 *     trabajo de OTRO cron: es el verde prestado que G4 acaba de erradicar. Su señal
 *     autoritativa es la fecha del commit del bot sobre ese seed, no una tabla.
 *
 *   W-7 `digest-daily` — QUEDA FUERA porque NOTIF está parked: el `schedule` está comentado
 *     (`digest-daily.yml:24-25`, estreno gated declarado en `:17`) y `notificacion_envio`
 *     tiene 0 filas. Una entrada aquí produciría un STALE permanente que no denuncia una
 *     avería sino un gating deliberado — ruido que enseña al operador a ignorar el rojo.
 *
 * overrideEnv: nombre de variable de entorno para override de umbral por fuente.
 *   Formato: FRESHNESS_UMBRAL_<FUENTE_UPPERCASE_GUIONES_A_UNDERSCORE>
 *
 * workflowYml: nombre del archivo .yml en .github/workflows/ (señal GH Actions).
 *   `null` significa: esta fuente NO tiene workflow de GH Actions POR DECISIÓN DECLARADA
 *   (gating legal MONEY/SERVEL, ingesta local por diseño) — NO "aún no lo escribimos".
 *   Cuando es null el cliente OMITE la llamada a `gh run list` y la señal figura
 *   "n/d (sin workflow)". Crear un .yml vacío para callar el 404 sería FABRICAR COBERTURA
 *   de señal: prohibido (G2 de 118-CRON-VERDICTS.md §4, opción (a)).
 */

export interface FuenteConfig {
  fuente: string;
  tabla: string;
  columna: string;
  umbralDias: number;
  overrideEnv: string;
  /** Archivo .yml en .github/workflows/, o `null` = sin workflow por decisión declarada. */
  workflowYml: string | null;
  /**
   * Agregado SQL de la señal de último upsert. Default MAX (última ingesta) — TODAS las
   * fuentes v6.0 lo OMITEN → conservan MAX sin cambio. Solo `leyes-min-edad` usa "MIN"
   * (proyecto MÁS VIEJO sin refrescar) para revelar la rotación/dilución (SC#4). El campo
   * es opcional y aditivo: `queryFreshness` construye la SQL con `cfg.agregado ?? "MAX"`,
   * por lo que agregarlo NO regresiona ninguna entrada existente.
   */
  agregado?: "MAX" | "MIN";
  /**
   * WR-05 (119-REVIEW) — rótulo con el que ESTE conector escribe `source_snapshot.source`,
   * cuando NO coincide con `fuente`. `r2SnapshotSignal` consulta por este valor.
   *
   * POR QUÉ EXISTE: la señal asumía `source = <fuente del catálogo>`. Para probidad el catálogo
   * dice `"probidad"` y el conector escribe `"infoprobidad"`, así que la señal reportaba
   * "n/d (sin snapshots)" HABIENDO crudo (`infoprobidad|3` en PROD). Un instrumento que dice
   * "sin crudo" cuando hay crudo es peor que no tenerlo.
   *
   * Se mapea en vez de renombrar el rótulo del writer porque las filas YA ESCRITAS en PROD dicen
   * `infoprobidad`: renombrar dejaría huérfano el histórico y volvería a mentir, ahora al revés.
   */
  sourceSnapshot?: string;
}

/**
 * Cobertura del corpus de búsqueda (BUSQ-03) — señal N/M por etapa del pipeline.
 *
 * A diferencia de CATALOG (orientado a STALENESS: ¿hace cuánto no ingiere?), la
 * cobertura responde ¿de M proyectos, cuántos llegaron a esta etapa? El denominador
 * M es `count(proyecto)` (universo total); cada señal es un numerador N.
 *
 * Las SQL son las MISMAS de `scripts/verify-cobertura.sql` (fuente única de verdad):
 * la verificación manual del backfill y esta señal comparten los conteos. El
 * `embedding` (proyecto_embedding) es el N que ve el usuario en el banner de /buscar.
 */
export interface CoberturaSenalConfig {
  /** id estable de la señal (proyecto/ficha/idea/embedding). */
  senal: string;
  /** etiqueta legible para la tabla del operador. */
  etiqueta: string;
  /** SQL read-only que retorna un único count (mismo que verify-cobertura.sql). */
  sql: string;
  /** true = esta señal es el denominador M (universo total). */
  esDenominador: boolean;
}

export const COBERTURA_SENALES: CoberturaSenalConfig[] = [
  {
    senal: "proyecto",
    etiqueta: "proyectos (universo)",
    sql: "SELECT count(*) FROM proyecto;",
    esDenominador: true,
  },
  {
    senal: "ficha",
    etiqueta: "con ficha",
    sql: "SELECT count(*) FROM proyecto_ficha;",
    esDenominador: false,
  },
  {
    senal: "idea",
    etiqueta: "con idea matriz",
    sql: "SELECT count(*) FROM proyecto_ficha WHERE idea_matriz IS NOT NULL AND idea_matriz <> '';",
    esDenominador: false,
  },
  {
    senal: "embedding",
    etiqueta: "indexados (/buscar)",
    sql: "SELECT count(*) FROM proyecto_embedding;",
    esDenominador: false,
  },
];

/**
 * Cobertura del voto individual (VOTO-05) — señal N/M por CÁMARA, denominador PROPIO.
 *
 * A DIFERENCIA de COBERTURA_SENALES (denominador = `proyecto`, semántica del corpus de
 * búsqueda), esta cobertura responde: ¿de M sesiones de sala CONOCIDAS (ingeridas), en
 * cuántas hay voto individual atribuible? El denominador es `count(distinct votacion.id)`
 * (universo de votaciones/sesiones ingeridas), NO `proyecto`. Es un array SEPARADO para NO
 * romper la semántica de denominador único del corpus (RESEARCH pitfall 3 / Open Question 1).
 *
 * Dos numeradores por CÁMARA, declarados HONESTAMENTE (VOTO-05, anti-insinuación):
 *   - Cámara (diputados): sesiones con al menos un voto `estado_vinculo='confirmado'`
 *     (linking DETERMINISTA por DIPID). Voto atribuido de verdad.
 *   - Senado: sesiones con voto por NOMBRE (`estado_vinculo` in probable/no_confirmado).
 *     El Senado publica por nombre, no por id maestro → nunca se declara "confirmado".
 *     Se muestra como techo honesto: hay dato, pero NO es atribución dura.
 *
 * `probable`/`no_confirmado` NUNCA se cuentan como voto atribuido en la Cámara: el numerador
 * Cámara filtra SOLO `confirmado`. El renderer y la UI declaran la brecha, nunca "completo".
 *
 * SQL 100% estático (sin interpolación de input) — T-68-03 (tampering). Corre read-only vía
 * el mismo `psql` de query-runner (T-68-04: nunca imprime dbUrl/password).
 */
export const COBERTURA_VOTO_SENALES: CoberturaSenalConfig[] = [
  {
    senal: "sesiones",
    etiqueta: "sesiones de sala conocidas",
    // Denominador: universo de votaciones/sesiones ingeridas (ambas cámaras).
    sql: "SELECT count(DISTINCT id) FROM votacion;",
    esDenominador: true,
  },
  {
    senal: "camara",
    etiqueta: "Cámara — voto confirmado",
    // Numerador determinista: sesiones de diputados con >=1 voto confirmado (DIPID maestro).
    sql:
      "SELECT count(DISTINCT vo.id) FROM votacion vo " +
      "JOIN voto v ON v.votacion_id = vo.id " +
      "WHERE vo.camara = 'diputados' AND v.estado_vinculo = 'confirmado';",
    esDenominador: false,
  },
  {
    senal: "senado",
    etiqueta: "Senado — voto por nombre",
    // Numerador por nombre: sesiones de senado con voto ingerido (probable/no_confirmado).
    // NUNCA 'confirmado' — el Senado publica por nombre, no por id maestro (techo honesto).
    sql:
      "SELECT count(DISTINCT vo.id) FROM votacion vo " +
      "JOIN voto v ON v.votacion_id = vo.id " +
      "WHERE vo.camara = 'senado' " +
      "AND v.estado_vinculo IN ('probable', 'no_confirmado');",
    esDenominador: false,
  },
];

/**
 * Cobertura del RUT PRESENTE (RUT-01) — techo HONESTO de identificación por RUT.
 *
 * WR-05 (honestidad): el numerador mide PRESENCIA de RUT (`rut IS NOT NULL AND rut <> ''`),
 * NO validez de dígito verificador (módulo-11). Por eso la etiqueta dice "con RUT presente
 * (no vacío)", no "DV-válido": un `rut='xxx'` malformado cuenta como presente pero NO es
 * DV-válido. La DV-validez es un SUB-techo, computado en la capa de identidad
 * (`isRutValido`) y declarado por separado en el CLI, NUNCA afirmado por esta cifra.
 *
 * Señal SEPARADA (dos arrays con denominador PROPIO), igual que COBERTURA_VOTO_SENALES:
 * NO toca el denominador único del corpus (COBERTURA_SENALES = `proyecto`) ni el del voto
 * (COBERTURA_VOTO_SENALES = sesiones). El cruce de dinero de Phases 70/71 consulta AMBAS
 * maestras, por eso se miden las dos (RESEARCH A1 / Open Question 1):
 *
 *   - `parlamentario` (estado='confirmado'): universo CRUZABLE de parlamentarios.
 *   - `entidad_tercero` (tipo_entidad='juridica'): personas jurídicas cruzables por RUT
 *     exacto (proveedores del Estado, donantes). Las naturales de lobby NO traen RUT.
 *
 * `evaluateCobertura` toma UN solo `esDenominador` por evaluación. Para medir DOS maestras
 * con denominadores distintos se usan DOS arrays separados, cada uno con su propio
 * `esDenominador: true`, evaluados por separado en el CLI. Esto respeta el contrato de
 * `evaluateCobertura` (un denominador por array) sin romperlo.
 *
 * TECHO HONESTO — importante: "sin dato de RUT" ≠ "sin vínculos". El estado HOY (seed
 * `filas: []`, `rut` vacío) es cobertura ≈ 0/M, y así se declara: ni 0% fingido ni 100%.
 * El numerador cuenta presencia de RUT (`rut IS NOT NULL AND rut <> ''`); la validez de
 * dígito verificador (DV) se computa en la capa de identidad (`isRutValido`), NO en SQL —
 * el techo aquí es "con RUT no vacío"; la DV-validez es un sub-techo declarado en el CLI.
 * El RUT es INTERNO (minimización 21.719): la señal cuenta filas, NUNCA proyecta el `rut`.
 *
 * SQL 100% estática (sin interpolación de input) — T-69-04 (tampering). Corre read-only vía
 * el mismo `psql` de query-runner (T-69-05: nunca imprime dbUrl/password).
 */
export const COBERTURA_RUT_PARLAMENTARIO_SENALES: CoberturaSenalConfig[] = [
  {
    senal: "parl_universo",
    etiqueta: "parlamentarios cruzables (universo)",
    // Denominador: universo cruzable = maestra parlamentario en estado confirmado.
    sql: "SELECT count(*) FROM parlamentario WHERE estado = 'confirmado';",
    esDenominador: true,
  },
  {
    senal: "parl_con_rut",
    etiqueta: "con RUT presente (no vacío)",
    // Numerador: mismos + RUT presente (no nulo, no vacío). DV-validez = sub-techo (CLI).
    sql:
      "SELECT count(*) FROM parlamentario " +
      "WHERE estado = 'confirmado' AND rut IS NOT NULL AND rut <> '';",
    esDenominador: false,
  },
];

export const COBERTURA_RUT_ENTIDAD_SENALES: CoberturaSenalConfig[] = [
  {
    senal: "ent_universo",
    etiqueta: "entidades jurídicas (universo)",
    // Denominador: personas jurídicas = las cruzables por RUT exacto (proveedores/donantes).
    sql: "SELECT count(*) FROM entidad_tercero WHERE tipo_entidad = 'juridica';",
    esDenominador: true,
  },
  {
    senal: "ent_con_rut",
    etiqueta: "con RUT presente (no vacío)",
    // Numerador: mismas + RUT presente (no nulo, no vacío). DV-validez = sub-techo (CLI).
    sql:
      "SELECT count(*) FROM entidad_tercero " +
      "WHERE tipo_entidad = 'juridica' AND rut IS NOT NULL AND rut <> '';",
    esDenominador: false,
  },
];

/**
 * Jobs de `pg_cron` monitoreados (G3, 119-02) — array SEPARADO de `CATALOG` a propósito.
 *
 * POR QUÉ SEPARADO: un job de pg_cron no tiene tabla/columna que medir ni workflow de GH
 * Actions; su señal es `max(start_time)` de `cron.job_run_details` y su umbral se DERIVA del
 * schedule, no de un umbral en días fijado a mano. Mezclarlo en `CATALOG` obligaría a
 * inventar campos vacíos y a que `evaluate()` tuviera dos semánticas. Mismo criterio con que
 * `COBERTURA_VOTO_SENALES` vive fuera de `CATALOG`.
 *
 * El `schedule` de cada entrada es el ESPERADO, copiado de la migración citada. Se asevera
 * contra el schedule VIVO: un drift es señal por sí mismo (T-119-06) — jamás se adopta el
 * valor vivo en silencio. `active=false` también es señal (un job desprogramado no está sano).
 *
 * MINIMIZACIÓN (T-119-05): la lectura proyecta SOLO `jobid`, `jobname`, `schedule`, `active`
 * y `max(start_time)`. NUNCA `command` ni `return_message`, que pueden embeber URLs/keys de
 * las llamadas `pg_net`. El instrumento OBSERVA el scheduler; nunca lo altera (T-119-04:
 * cero `cron.schedule`/`cron.unschedule`).
 */
export interface PgCronJobConfig {
  /** nombre del job en `cron.job`. */
  jobname: string;
  /** jobid en `cron.job` (clave de join con `cron.job_run_details`). */
  jobid: number;
  /** schedule ESPERADO, copiado de la migración que lo crea. */
  schedule: string;
  /** override del umbral EN HORAS por variable de entorno. */
  overrideEnv: string;
}

export const PGCRON_JOBS: PgCronJobConfig[] = [
  {
    // 0003_orchestration.sql:214 — worker de la cola de ingesta.
    jobname: "process-ingest-jobs",
    jobid: 1,
    schedule: "30 seconds",
    overrideEnv: "FRESHNESS_UMBRAL_PGCRON_PROCESS_INGEST_JOBS",
  },
  {
    // 0003_orchestration.sql:229 — poda de la tabla de respuestas de pg_net.
    jobname: "cleanup-net-http",
    jobid: 2,
    schedule: "*/15 * * * *",
    overrideEnv: "FRESHNESS_UMBRAL_PGCRON_CLEANUP_NET_HTTP",
  },
  {
    // 0030_net.sql:162 — materialización de aristas del grafo.
    jobname: "net-materializar-aristas",
    jobid: 3,
    schedule: "17 3 * * *",
    overrideEnv: "FRESHNESS_UMBRAL_PGCRON_NET_MATERIALIZAR_ARISTAS",
  },
  {
    // 0039_cruce_senal.sql:138 — materialización de señales de cruce.
    jobname: "cruces-materializar",
    jobid: 4,
    schedule: "23 3 * * *",
    overrideEnv: "FRESHNESS_UMBRAL_PGCRON_CRUCES_MATERIALIZAR",
  },
  {
    // 0065_actualidad_senal.sql:326 — rebuild intradía L-V del panel de actualidad.
    jobname: "actualidad-materializar",
    jobid: 5,
    schedule: "7 11,14,17,20 * * 1-5",
    overrideEnv: "FRESHNESS_UMBRAL_PGCRON_ACTUALIDAD_MATERIALIZAR",
  },
];

export const CATALOG: FuenteConfig[] = [
  {
    fuente: "leyes",
    tabla: "proyecto",
    columna: "fecha_captura",
    umbralDias: 7,
    overrideEnv: "FRESHNESS_UMBRAL_LEYES",
    workflowYml: "leyes-weekly.yml",
  },
  {
    // leyes-min-edad (SC#4) — señal de EDAD-MÍNIMA del corpus de proyectos.
    //
    // POR QUÉ MIN y no MAX: la entrada `leyes` de arriba mide MAX(fecha_captura) → el
    // ÚLTIMO upsert. Un solo refresh del cron leyes-weekly la pone verde, aunque ~3.657
    // proyectos lleven MESES sin tocar (T-74-11: cobertura falsa). MIN(fecha_captura)
    // mide el proyecto MÁS VIEJO sin refrescar → si la rotación round-robin del plan
    // 74-02 (cursor leyes_rotacion_estado) NO cubrió la cola, esta señal se pone stale y
    // la dilución se hace VISIBLE. Un solo refresh NO puede ponerla verde: hay que rotar
    // el corpus entero para que el proyecto más viejo entre en umbral.
    //
    // umbral 45d GENEROSO: la rotación cubre la cola en ceil(cola/porRonda) corridas
    // semanales; 45d (~6-7 semanas) da margen para una vuelta completa sin declarar
    // stale de más. Override por FRESHNESS_UMBRAL_LEYES_MIN_EDAD.
    //
    // ADITIVA: reusa el mismo pipeline evaluate() (stale = null|días>umbral, fail-closed).
    // MIN nulo/ilegible → stale (misma regla honesta). NO toca la entrada `leyes` (MAX).
    fuente: "leyes-min-edad",
    tabla: "proyecto",
    columna: "fecha_captura",
    umbralDias: 45,
    overrideEnv: "FRESHNESS_UMBRAL_LEYES_MIN_EDAD",
    workflowYml: "leyes-weekly.yml",
    agregado: "MIN",
  },
  {
    fuente: "agenda",
    tabla: "citacion",
    columna: "fecha_captura",
    umbralDias: 7,
    overrideEnv: "FRESHNESS_UMBRAL_AGENDA",
    workflowYml: "agenda-weekly.yml",
  },
  {
    // G4 (119-01): ANTES medía `lobby_audiencia`, tabla que TAMBIÉN llena el conector
    // leylobby (W-5) → "verde prestado": una avería de lobby-camara-weekly quedaba tapada
    // por la frescura que aportaba el OTRO cron. Ahora mide `lobby_contraparte`, tabla
    // PROPIA del conector de Cámara (la escribe `upsertContrapartes` de writer-supabase.ts).
    // Columna `fecha_captura` verificada por psql read-only contra el schema de PROD
    // (lección A2 de 118 §5: las columnas temporales NO son uniformes).
    fuente: "lobby-camara",
    tabla: "lobby_contraparte",
    columna: "fecha_captura",
    umbralDias: 14,
    overrideEnv: "FRESHNESS_UMBRAL_LOBBY_CAMARA",
    workflowYml: "lobby-camara-weekly.yml",
  },
  {
    fuente: "lobby-leylobby",
    tabla: "lobby_ingesta_estado",
    columna: "ingestado_hasta",
    umbralDias: 7,
    overrideEnv: "FRESHNESS_UMBRAL_LOBBY_LEYLOBBY",
    workflowYml: "lobby-leylobby-weekly.yml",
  },
  {
    fuente: "probidad",
    // WR-05: el conector escribe `source_snapshot.source = "infoprobidad"` (el nombre del
    // servicio del CPLT), no "probidad". Verificado contra PROD 2026-07-28: `infoprobidad|3`.
    sourceSnapshot: "infoprobidad",
    tabla: "declaracion",
    columna: "fecha_captura",
    umbralDias: 30,
    overrideEnv: "FRESHNESS_UMBRAL_PROBIDAD",
    workflowYml: "probidad-weekly.yml",
  },
  {
    // G4 (119-01): ANTES medía `proyecto`, tabla que llena el cron de tramitación (W-4) →
    // mismo "verde prestado": una avería de fichas-backfill quedaba tapada por la frescura
    // de leyes-weekly. Ahora mide `proyecto_ficha`, la tabla que llena el propio pipeline
    // de fichas. Columna `fecha_captura` verificada por psql read-only contra PROD.
    fuente: "fichas",
    tabla: "proyecto_ficha",
    columna: "fecha_captura",
    umbralDias: 30,
    overrideEnv: "FRESHNESS_UMBRAL_FICHAS",
    workflowYml: "fichas-backfill.yml",
  },
  {
    // ChileCompra (MONEY-01) — staleness del barrido de contratos del Estado por RUT.
    //
    // Se mide `contratos_ingesta_estado.ingestado_hasta` (marcador de ingesta por-parlamentario,
    // 0023_dinero.sql), NO `contrato.fecha_captura` — MISMO patrón que `lobby-leylobby`: el
    // marcador de ingesta distingue "consultado sin contratos" (ingestado_hasta al día, 0 filas
    // en `contrato`) de "no consultado" (ingestado_hasta null/viejo). Un MAX(contrato.fecha_captura)
    // no puede distinguir esos dos casos (0 filas se ve igual que "nunca barrido"). Columna EXISTENTE
    // de 0023 (NO se añade migración).
    //
    // umbral 30d: la fuente OCDS/Mercado Público se refresca mensual (día ~20); >30d = stale honesto.
    // workflowYml "chilecompra-weekly.yml" AÚN NO existe (el flip MONEY vive en Phase 73) → la señal
    // de GH Actions figura "n/d" hasta entonces: comportamiento honesto, NO un error.
    // G2 (119-01): el campo `workflowYml` va en nulo para DECLARAR esa ausencia en vez de
    // apuntar a un archivo inexistente (que producía un HTTP 404 en stderr en cada corrida).
    // El .yml NO se crea.
    // HONESTIDAD (MONEY-01): sin crawl LIVE corrido, `ingestado_hasta` es null HOY → la señal reporta
    // stale (desconocido = stale, fail-closed), reflejando cobertura ≈ 0, no un fresco fingido.
    fuente: "chilecompra",
    tabla: "contratos_ingesta_estado",
    columna: "ingestado_hasta",
    umbralDias: 30,
    overrideEnv: "FRESHNESS_UMBRAL_CHILECOMPRA",
    workflowYml: null,
  },
  {
    // SERVEL (MONEY-02) — staleness del barrido de aportes de campaña por parlamentario.
    //
    // Se mide `aportes_ingesta_estado.ingestado_hasta` (marcador de ingesta por-parlamentario,
    // 0024_servel.sql), NO `aporte.fecha_captura` — MISMO patrón que `lobby-leylobby`/`chilecompra`:
    // el marcador distingue "consultado sin aportes" (ingestado_hasta al día, 0 filas en `aporte`) de
    // "no consultado" (ingestado_hasta null/viejo). Un MAX(aporte.fecha_captura) no puede distinguir
    // esos dos casos. Columna EXISTENTE de 0024 (NO se añade migración).
    //
    // LOCAL POR DISEÑO (DEBT-01): SERVEL no publica una API amable — el operador descarga el `.xlsx`
    // a mano y lo coloca en R2 (run-servel-local-cli). NO hay cron ni GH Actions → `servel-weekly.yml`
    // NO existe ni debe crearse → la señal de GH Actions figura "n/d" (honesto, NO un error).
    // G2 (119-01): el campo `workflowYml` va en nulo para DECLARAR esa ausencia (antes
    // apuntaba a un archivo inexistente → HTTP 404 en stderr en cada corrida). El .yml NO se crea.
    //
    // umbral 365d GENEROSO: los ciclos electorales son bianuales/cuatrienales; un barrido con >365d
    // sigue siendo el corte vigente hasta la próxima elección. Override por `FRESHNESS_UMBRAL_SERVEL`.
    // HONESTIDAD (MONEY-02): sin barrido corrido, `ingestado_hasta` es null HOY → la señal reporta
    // stale (desconocido = stale, fail-closed), reflejando cobertura ≈ 0, no un fresco fingido.
    fuente: "servel",
    tabla: "aportes_ingesta_estado",
    columna: "ingestado_hasta",
    umbralDias: 365,
    overrideEnv: "FRESHNESS_UMBRAL_SERVEL",
    workflowYml: null,
  },
  {
    // actualidad-refresh (G3, 119-02) — W-1 de 118 §2 era un punto ciego del instrumento:
    // el cron que rellena el panel de actualidad podía averiarse SIN disparar ninguna señal.
    //
    // Tabla `actualidad_senal` (0065_actualidad_senal.sql) y columna `fecha_captura`
    // VERIFICADAS por psql read-only contra el schema de PROD antes de commitear — la
    // REFUTACIÓN A2 de 118 §5 es exactamente que la columna temporal NO es uniforme entre
    // tablas: aquí NO es `creado_en`, es `fecha_captura`.
    //
    // umbralDias 2: la cadencia es intradía L-V (`0 11,14,17,20 * * 1-5`, cuatro ventanas
    // por día hábil). Más de 2 días sin escritura implica un fin de semana largo MÁS al
    // menos una ventana hábil perdida — es decir, avería, no calendario.
    fuente: "actualidad-refresh",
    tabla: "actualidad_senal",
    columna: "fecha_captura",
    umbralDias: 2,
    overrideEnv: "FRESHNESS_UMBRAL_ACTUALIDAD_REFRESH",
    workflowYml: "actualidad-refresh.yml",
  },
];
