// reconciliar-senado — cruce por NOMBRE del voto-a-voto del Senado vía correrPipeline (Fase 4).
//
// El Senado entrega los votos por NOMBRE ("Coloma C., Juan Antonio"), no por un id oficial.
// Por eso la reconciliación pasa por el pipeline de identidad asistida (Fase 4): blocking +
// adjudicación LLM + compuerta fail-closed. El RUT NUNCA cruza al LLM (la mención no lo
// transporta por construcción, T-04-02/T-05-08).
//
// GUARDA DE IDENTIDAD LOCKED (riesgo existencial #1, T-05-06):
//   SOLO `tipo === "determinista"` (nombre único en cámara+periodo, o RUT exacto) puebla
//   `voto.parlamentario_id`. El auto-aceptar del LLM mapea a `probable` y NUNCA vincula a la
//   ficha pública: aunque el pipeline escriba un vínculo 'probable' en `vinculo_identidad`,
//   la capa pública del voto deja `parlamentario_id=null` y conserva la mención cruda para
//   mostrar con marca "identidad no verificada". `revision`/`no_confirmado` → igual: null.
//
// `provider` y `writer` son inyectables (mock/espía en tests, MiniMax + RevisionWriter reales
// en la ola 4). El provider LLM NO es obligatorio para los votos que resuelven
// determinísticamente: `correrPipeline` corta antes del LLM (0 llamadas).

import type { Parlamentario } from "@obs/core";
import { normalizarNombre } from "@obs/core";
import {
  correrPipeline,
  type PipelineWriter,
  type MencionForanea,
} from "@obs/adjudication";

// El provider LLM se tipa derivándolo de la firma de `correrPipeline` (3.er parámetro),
// evitando un edge de dependencia directo a `@obs/llm` (`@obs/adjudication` ya lo encapsula).
type LLMProvider = Parameters<typeof correrPipeline>[2];
import {
  type Voto,
  type MetodoVinculo,
  type EstadoVinculo,
  VotoSchema,
} from "./model";
import type { VotoSenadoCrudo } from "./parse-senado-votacion";

/** Periodo vigente del Senado (filtro DURO del blocking del pipeline). */
const PERIODO_SENADO = "senado-vigente-2026";

/** Mapeo del resultado del pipeline a la guarda LOCKED del voto público. */
interface Vinculo {
  parlamentario_id: string | null;
  metodo: MetodoVinculo | null;
  estado_vinculo: EstadoVinculo | null;
}

/**
 * Opciones de reconciliación. `provider`/`writer` son inyectables (mock/espía en tests,
 * MiniMax + RevisionWriter reales en la ola 4); por defecto un no-op seguro: sin provider
 * llamable, los votos con candidatos a revisión/LLM degradan a `no_confirmado` (fail-closed),
 * mientras los deterministas siguen resolviendo (correrPipeline corta antes del LLM).
 */
export interface ReconciliarSenadoOpts {
  /** Id de la votación (FK a `votacion.id`). Por defecto vacío. */
  votacionId?: string;
  /** Provider LLM; no se invoca para los votos que resuelven determinísticamente. */
  provider?: LLMProvider;
  /** Writer del pipeline (cola/vínculo/audit). */
  writer?: PipelineWriter;
}

/** Writer no-op: descarta toda escritura (cuando el caller no inyecta uno). */
const NOOP_WRITER: PipelineWriter = {
  async upsertVinculo() {
    return null;
  },
  async appendAudit() {
    /* descarta */
  },
  async enqueueRevision() {
    /* descarta */
  },
};

/**
 * Provider que LANZA si se invoca: fuerza fail-closed cuando no se inyectó uno real y un
 * voto llegaría al LLM (homónimo). Los votos deterministas NUNCA lo tocan (0 llamadas).
 */
const PROVIDER_AUSENTE: LLMProvider = {
  id: "sin-provider",
  trainsOnInputs: false,
  async complete() {
    throw new Error(
      "reconciliarVotosSenado: se requiere un provider LLM para resolver un voto ambiguo (homónimo)",
    );
  },
};

/**
 * Reconcilia el voto-a-voto del Senado (por nombre) contra la maestra vía `correrPipeline`.
 *
 * Firma compatible con el slice E2E (`reconciliarVotosSenado(votos, maestra)`): `opts` (con
 * `votacionId`/`provider`/`writer`) es opcional.
 *
 * @param votosCrudos  Votos crudos `{ mencionNombre, seleccion }` (ola 2, `parseSenadoVotacion`).
 * @param maestra      Tabla maestra de parlamentarios ya cargada.
 * @param opts         `votacionId` + `provider`/`writer` inyectables (defaults seguros).
 * @returns            `Voto[]` listos para persistir; SOLO determinista lleva parlamentario_id.
 */
export async function reconciliarVotosSenado(
  votosCrudos: VotoSenadoCrudo[],
  maestra: Parlamentario[],
  opts: ReconciliarSenadoOpts = {},
): Promise<Voto[]> {
  const votacionId = opts.votacionId ?? "";
  const provider = opts.provider ?? PROVIDER_AUSENTE;
  const writer = opts.writer ?? NOOP_WRITER;
  const out: Voto[] = [];

  for (const crudo of votosCrudos) {
    // Pitfall 3: trim ANTES; el campo `libre` está diseñado para "Apellido P., Nombre".
    const mencionNombre = crudo.mencionNombre.trim();
    const { nombre_normalizado, tokens } = normalizarNombre({ libre: mencionNombre });

    const mencion: MencionForanea = {
      nombreOriginal: mencionNombre,
      nombreNormalizado: nombre_normalizado,
      tokens,
      camara: "senado",
      periodo: PERIODO_SENADO,
      region: null,
    };

    const res = await correrPipeline(mencion, maestra, provider, writer);

    // GUARDA LOCKED: solo `determinista` puebla parlamentario_id en el voto público.
    let v: Vinculo;
    switch (res.tipo) {
      case "determinista":
        v = {
          parlamentario_id: res.parlamentarioId,
          metodo: "determinista",
          estado_vinculo: "confirmado",
        };
        break;
      case "probable":
        // Auto-aceptar del LLM: NUNCA vincula a la ficha pública (parlamentario_id null).
        v = { parlamentario_id: null, metodo: "llm", estado_vinculo: "probable" };
        break;
      case "revision":
      case "no_confirmado":
      default:
        v = { parlamentario_id: null, metodo: null, estado_vinculo: "no_confirmado" };
        break;
    }

    const voto: Voto = VotoSchema.parse({
      votacion_id: votacionId,
      // CR-02: el Senado solo trae nombre → el discriminador NO colisionante es el índice
      // posicional del voto en la fuente (`seq:<n>`). Dos homónimos/menciones vacías ya no
      // colapsan en la misma clave `(votacion_id, fuente_voter_id)`.
      fuente_voter_id: `seq:${crudo.votoSeq}`,
      mencion_nombre: mencionNombre,
      parlamentario_id: v.parlamentario_id,
      seleccion: crudo.seleccion,
      metodo: v.metodo,
      estado_vinculo: v.estado_vinculo,
    }) as Voto;

    out.push(voto);
  }

  return out;
}
