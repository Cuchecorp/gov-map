// clasificar-run.ts — orquestación del pipeline de clasificación (135-04). PURA: todas las
// dependencias (lectura de pendientes, escritura, dead-letter, ledger, provider) se
// inyectan — el cableado Supabase vive en el CLI.
//
// CONTRATO (SC de 135 + 134):
// - Solo procesa `noticia.estado = 'pendiente'` ⇒ una re-corrida NO reprocesa clasificadas
//   ni descartadas (idempotencia; el seen-ledger de URLs ya se marcó en la carga, 132-05).
// - CAP DURO de llamadas por corrida: al tope, la corrida PARA con log LOUD del remanente
//   (el remanente sigue `pendiente` y entra en la próxima corrida). El ledger registra lo
//   consumido SIEMPRE, incluso si la corrida aborta después.
// - Rechazos (parse, fuera de lista, bajo umbral) ⇒ dead-letter con su `rejection_stage` +
//   `estado='descartada'` — nada se fabrica, nada se reprocesa en silencio.
// - Éxitos se escriben con el gate all-or-nothing (134): un lote con una fila inválida no
//   toca la DB (`lote_invalido` al dead-letter completo).
// - El enrutamiento a fichas NO existe aquí: T4/T9 no-medidos (fail-closed 133-b). La
//   etiqueta es interna (D-133-G).

import type { LLMProvider } from "@obs/llm";
import { ETIQUETAS } from "../eval/taxonomia.js";
import { clasificarNoticia } from "./clasificar.js";
import { procesarLoteAllOrNothing } from "../resolver/gate.js";
import type { DeadLetterWriter, DeadLetterRow } from "../resolver/dead-letter.js";

/** Cap duro de llamadas LLM por corrida — moverlo es un commit con razón, jamás runtime. */
export const CAP_LLAMADAS_POR_CORRIDA = 500;

export interface NoticiaPendiente {
  url_hash: string;
  titular: string;
  descripcion: string | null;
}

export interface ClasificacionEscrita {
  url_hash: string;
  etiqueta: string;
  etiqueta_confianza: number;
  etiqueta_modelo: string;
}

export interface LedgerEntrada {
  run_id: string;
  task: string;
  modelo: string;
  llamadas: number;
}

export interface ClasificarRunDeps {
  leerPendientes(limite: number): Promise<NoticiaPendiente[]>;
  /** Escribe el lote de éxitos (estado='clasificada') ATÓMICAMENTE (precondición del gate). */
  escribirClasificaciones(filas: readonly ClasificacionEscrita[]): Promise<void>;
  /** Marca estado='descartada' para los rechazados (tras dead-letter exitoso). */
  marcarDescartadas(urlHashes: readonly string[]): Promise<void>;
  deadLetter: DeadLetterWriter;
  escribirLedger(entrada: LedgerEntrada): Promise<void>;
  provider: LLMProvider;
  log(msg: string): void;
}

export interface ClasificarRunResult {
  procesadas: number;
  clasificadas: number;
  rechazadas: number;
  remanente_por_cap: boolean;
}

const LEGALES = new Set<string>(ETIQUETAS);

export async function clasificarRun(
  deps: ClasificarRunDeps,
  runId: string,
): Promise<ClasificarRunResult> {
  const pendientes = await deps.leerPendientes(CAP_LLAMADAS_POR_CORRIDA + 1);
  if (pendientes.length === 0) {
    deps.log(`clasificar[${runId}]: [skip] cero pendientes — salida temprana sin llamadas`);
    await deps.escribirLedger({ run_id: runId, task: "clasificacion-news", modelo: deps.provider.id, llamadas: 0 });
    return { procesadas: 0, clasificadas: 0, rechazadas: 0, remanente_por_cap: false };
  }

  const remanentePorCap = pendientes.length > CAP_LLAMADAS_POR_CORRIDA;
  const lote = pendientes.slice(0, CAP_LLAMADAS_POR_CORRIDA);
  if (remanentePorCap) {
    deps.log(
      `clasificar[${runId}]: CAP ${CAP_LLAMADAS_POR_CORRIDA} alcanzado — quedan pendientes para la próxima corrida (LOUD)`,
    );
  }

  const exitos: ClasificacionEscrita[] = [];
  const rechazos: DeadLetterRow[] = [];
  let llamadas = 0;
  try {
    for (const noticia of lote) {
      llamadas += 1; // ANTES del intento: un 401 a mitad tambien consumio la llamada
      const r = await clasificarNoticia(deps.provider, {
        titulo: noticia.titular,
        descripcion: noticia.descripcion ?? "",
      });
      if (r.etiqueta === null) {
        rechazos.push({
          url_hash: noticia.url_hash,
          rejection_stage: "parse_fallido",
          detalle: "la salida del LLM no valida contra el schema",
          payload: {},
          run_id: runId,
        });
      } else if (r.fuera_de_lista) {
        rechazos.push({
          url_hash: noticia.url_hash,
          rejection_stage: "emision_fuera_de_lista",
          detalle: "etiqueta emitida fuera de la taxonomía",
          payload: { emision: r.etiqueta.slice(0, 200) },
          run_id: runId,
        });
      } else if (r.bajo_umbral) {
        rechazos.push({
          url_hash: noticia.url_hash,
          rejection_stage: "confianza_bajo_umbral",
          detalle: null,
          payload: { etiqueta: r.etiqueta, confianza: r.confianza ?? 0 },
          run_id: runId,
        });
      } else {
        exitos.push({
          url_hash: noticia.url_hash,
          etiqueta: r.etiqueta,
          etiqueta_confianza: r.confianza!,
          etiqueta_modelo: deps.provider.id,
        });
      }
    }
  } finally {
    // El ledger registra SIEMPRE lo consumido — también si el loop abortó a mitad.
    await deps.escribirLedger({ run_id: runId, task: "clasificacion-news", modelo: deps.provider.id, llamadas });
  }

  // Rechazos primero (un rechazo perdido es un dato fabricado por omisión); luego el estado.
  if (rechazos.length > 0) {
    await deps.deadLetter.escribir(rechazos);
    await deps.marcarDescartadas(rechazos.map((r) => r.url_hash));
  }

  if (exitos.length > 0) {
    const gate = await procesarLoteAllOrNothing(
      exitos,
      (f) => (LEGALES.has(f.etiqueta) && f.etiqueta_confianza >= 0 && f.etiqueta_confianza <= 1 ? null : `fila inválida: ${f.url_hash}`),
      async (l) => deps.escribirClasificaciones(l),
    );
    if (!gate.aplicado) {
      await deps.deadLetter.escribir(
        exitos.map((f) => ({
          url_hash: f.url_hash,
          rejection_stage: "lote_invalido" as const,
          detalle: gate.invalidos.map((i) => i.razon).join("; ").slice(0, 500),
          payload: { lote_n: exitos.length },
          run_id: runId,
        })),
      );
      deps.log(`clasificar[${runId}]: LOTE INVÁLIDO — cero escrituras, ${exitos.length} filas a dead-letter`);
      return { procesadas: lote.length, clasificadas: 0, rechazadas: rechazos.length + exitos.length, remanente_por_cap: remanentePorCap };
    }
  }

  deps.log(
    `clasificar[${runId}]: procesadas=${lote.length} clasificadas=${exitos.length} rechazadas=${rechazos.length} cap=${remanentePorCap}`,
  );
  return {
    procesadas: lote.length,
    clasificadas: exitos.length,
    rechazadas: rechazos.length,
    remanente_por_cap: remanentePorCap,
  };
}
