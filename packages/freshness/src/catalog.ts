/**
 * catalog.ts — configuración declarativa de las 6 fuentes monitoreadas.
 *
 * Fuente→tabla/columna map (derivado de 56-CRON-AUDIT.md "Frescura baseline"):
 *
 * | fuente           | tabla                  | columna          | umbral | notas                                       |
 * |------------------|------------------------|------------------|--------|---------------------------------------------|
 * | leyes            | proyecto               | fecha_captura    | 7d     | última vez que tramitación ingestó           |
 * | agenda           | citacion               | fecha_captura    | 7d     | citaciones y sesiones de tabla               |
 * | lobby-camara     | lobby_audiencia        | fecha_captura    | 14d    | WAF bloquea GH Actions → local semanal      |
 * | lobby-leylobby   | lobby_ingesta_estado   | ingestado_hasta  | 7d     | tabla distinta para distinguir de camara    |
 * | probidad         | declaracion            | fecha_captura    | 30d    | patrimonio/intereses CPLT                   |
 * | fichas           | proyecto               | fecha_captura    | 30d    | mismo proyecto; fichas llena idea_matriz    |
 *
 * NOTA lobby-camara vs lobby-leylobby:
 *   Ambas fuentes escriben en lobby_audiencia (sin columna discriminadora "fuente").
 *   Para distinguirlas, lobby-leylobby usa lobby_ingesta_estado.ingestado_hasta,
 *   que solo escribe el conector leylobby. lobby-camara usa MAX(fecha_captura) de
 *   lobby_audiencia completa (señal conservadora: si cualquier lobby está fresco, ok).
 *
 * overrideEnv: nombre de variable de entorno para override de umbral por fuente.
 *   Formato: FRESHNESS_UMBRAL_<FUENTE_UPPERCASE_GUIONES_A_UNDERSCORE>
 *
 * workflowYml: nombre del archivo .yml en .github/workflows/ (señal GH Actions).
 */

export interface FuenteConfig {
  fuente: string;
  tabla: string;
  columna: string;
  umbralDias: number;
  overrideEnv: string;
  workflowYml: string;
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
    fuente: "agenda",
    tabla: "citacion",
    columna: "fecha_captura",
    umbralDias: 7,
    overrideEnv: "FRESHNESS_UMBRAL_AGENDA",
    workflowYml: "agenda-weekly.yml",
  },
  {
    fuente: "lobby-camara",
    tabla: "lobby_audiencia",
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
    tabla: "declaracion",
    columna: "fecha_captura",
    umbralDias: 30,
    overrideEnv: "FRESHNESS_UMBRAL_PROBIDAD",
    workflowYml: "probidad-weekly.yml",
  },
  {
    fuente: "fichas",
    tabla: "proyecto",
    columna: "fecha_captura",
    umbralDias: 30,
    overrideEnv: "FRESHNESS_UMBRAL_FICHAS",
    workflowYml: "fichas-backfill.yml",
  },
];
