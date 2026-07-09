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
