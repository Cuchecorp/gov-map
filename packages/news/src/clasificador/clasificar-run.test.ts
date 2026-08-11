import { describe, it, expect } from "vitest";
import type { CompletionRequest, LLMProvider } from "@obs/llm";
import type { ZodType } from "zod";
import {
  clasificarRun,
  CAP_LLAMADAS_POR_CORRIDA,
  type ClasificarRunDeps,
  type NoticiaPendiente,
} from "./clasificar-run";
import type { DeadLetterRow } from "../resolver/dead-letter";

function providerSecuencia(respuestas: unknown[]): LLMProvider {
  let i = 0;
  return {
    id: "mock",
    trainsOnInputs: false,
    async complete<T>(_req: CompletionRequest, schema: ZodType<T>): Promise<T> {
      const r = respuestas[Math.min(i, respuestas.length - 1)];
      i += 1;
      if (r instanceof Error) throw r;
      return schema.parse(r);
    },
  };
}

interface Estado {
  clasificaciones: unknown[][];
  descartadas: string[][];
  deadLetters: DeadLetterRow[][];
  ledger: Array<{ run_id: string; llamadas: number }>;
  logs: string[];
}

function depsCon(
  pendientes: NoticiaPendiente[],
  provider: LLMProvider,
): { deps: ClasificarRunDeps; estado: Estado } {
  const estado: Estado = { clasificaciones: [], descartadas: [], deadLetters: [], ledger: [], logs: [] };
  const deps: ClasificarRunDeps = {
    leerPendientes: async () => pendientes,
    escribirClasificaciones: async (filas) => {
      estado.clasificaciones.push([...filas]);
    },
    marcarDescartadas: async (hashes) => {
      estado.descartadas.push([...hashes]);
    },
    deadLetter: {
      escribir: async (filas) => {
        estado.deadLetters.push([...filas]);
        return filas.length;
      },
    },
    escribirLedger: async (e) => {
      estado.ledger.push({ run_id: e.run_id, llamadas: e.llamadas });
    },
    provider,
    log: (m) => estado.logs.push(m),
  };
  return { deps, estado };
}

const N = (n: number): NoticiaPendiente[] =>
  Array.from({ length: n }, (_, i) => ({ url_hash: `h${i}`, titular: `T${i}`, descripcion: "d" }));

describe("clasificar-run — pipeline 135-04", () => {
  it("(a) [skip] honesto: cero pendientes ⇒ cero llamadas, ledger con llamadas=0", async () => {
    const { deps, estado } = depsCon([], providerSecuencia([]));
    const r = await clasificarRun(deps, "run-1");
    expect(r.procesadas).toBe(0);
    expect(estado.ledger).toEqual([{ run_id: "run-1", llamadas: 0 }]);
    expect(estado.logs.some((l) => l.includes("[skip]"))).toBe(true);
  });

  it("(b) éxito + rechazos mixtos: clasificadas al gate, rechazos al dead-letter con su stage y descartadas", async () => {
    const { deps, estado } = depsCon(
      N(4),
      providerSecuencia([
        { etiqueta: "no_legislativa", confianza: 0.9 }, // éxito
        { etiqueta: "deportes", confianza: 0.9 }, // fuera de lista
        { etiqueta: "ambiguo", confianza: 0.3 }, // bajo umbral
        { etiqueta: 42 }, // parse fallido
      ]),
    );
    const r = await clasificarRun(deps, "run-2");
    expect(r.clasificadas).toBe(1);
    expect(r.rechazadas).toBe(3);
    const stages = estado.deadLetters.flat().map((d) => d.rejection_stage).sort();
    expect(stages).toEqual(["confianza_bajo_umbral", "emision_fuera_de_lista", "parse_fallido"]);
    expect(estado.descartadas.flat().length).toBe(3);
    expect(estado.clasificaciones.length).toBe(1);
    expect(estado.ledger[0]!.llamadas).toBe(4);
  });

  it("(c) cap duro: procesa exactamente el cap y avisa LOUD del remanente", async () => {
    const { deps, estado } = depsCon(
      N(CAP_LLAMADAS_POR_CORRIDA + 1),
      providerSecuencia([{ etiqueta: "no_legislativa", confianza: 0.9 }]),
    );
    const r = await clasificarRun(deps, "run-3");
    expect(r.procesadas).toBe(CAP_LLAMADAS_POR_CORRIDA);
    expect(r.remanente_por_cap).toBe(true);
    expect(estado.logs.some((l) => l.includes("CAP"))).toBe(true);
    expect(estado.ledger[0]!.llamadas).toBe(CAP_LLAMADAS_POR_CORRIDA);
  });

  it("(d) el ledger registra lo consumido AUNQUE la corrida aborte a mitad", async () => {
    const explosivo: LLMProvider = {
      id: "mock",
      trainsOnInputs: false,
      async complete<T>(): Promise<T> {
        throw Object.assign(new Error("red caída"), { fatal: true });
      },
    };
    // clasificarNoticia atrapa errores del provider como parse_fallido — para simular un
    // aborto de infraestructura, reventamos en marcarDescartadas... no: el ledger va en
    // finally del LOOP. Simulamos aborto haciendo fallar el dead-letter (post-loop): el
    // ledger ya debe estar escrito.
    const { deps, estado } = depsCon(N(2), explosivo);
    deps.deadLetter = {
      escribir: async () => {
        throw new Error("dead-letter caído");
      },
    };
    await expect(clasificarRun(deps, "run-4")).rejects.toThrow(/dead-letter caído/);
    expect(estado.ledger).toEqual([{ run_id: "run-4", llamadas: 2 }]);
  });

  it("(e) re-corrida no reprocesa: solo se leen pendientes (contrato de la query, documentado)", async () => {
    // El contrato vive en leerPendientes (estado='pendiente'); aquí se verifica que el run
    // no toca nada si la query ya filtró. Con 0 pendientes tras una corrida exitosa, la
    // segunda corrida es [skip] con 0 llamadas.
    const { deps, estado } = depsCon([], providerSecuencia([]));
    await clasificarRun(deps, "run-5a");
    await clasificarRun(deps, "run-5b");
    expect(estado.ledger.map((l) => l.llamadas)).toEqual([0, 0]);
  });
});
