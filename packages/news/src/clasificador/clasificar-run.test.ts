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

  it("(d) INFRAESTRUCTURA rota (401/red) ⇒ la corrida ABORTA, nada se descarta, el ledger registra el intento (H2)", async () => {
    const explosivo: LLMProvider = {
      id: "mock",
      trainsOnInputs: false,
      async complete<T>(): Promise<T> {
        throw new Error("401 status code (no body)");
      },
    };
    const { deps, estado } = depsCon(N(2), explosivo);
    await expect(clasificarRun(deps, "run-4")).rejects.toThrow(/401/);
    // NADA se descartó ni fue a dead-letter: las noticias siguen pendientes y re-evaluables.
    expect(estado.descartadas).toEqual([]);
    expect(estado.deadLetters).toEqual([]);
    expect(estado.clasificaciones).toEqual([]);
    // El ledger registró el intento consumido AUNQUE la corrida abortara.
    expect(estado.ledger).toEqual([{ run_id: "run-4", llamadas: 1 }]);
  });

  it("(d2) el ledger también sobrevive a un fallo POST-loop (dead-letter caído)", async () => {
    const { deps, estado } = depsCon(
      N(1),
      providerSecuencia([{ etiqueta: "deportes", confianza: 0.9 }]), // fuera de lista ⇒ rechazo
    );
    deps.deadLetter = {
      escribir: async () => {
        throw new Error("dead-letter caído");
      },
    };
    await expect(clasificarRun(deps, "run-4b")).rejects.toThrow(/dead-letter caído/);
    expect(estado.ledger).toEqual([{ run_id: "run-4b", llamadas: 1 }]);
    expect(estado.descartadas).toEqual([]); // marcarDescartadas jamás corrió: el rechazo NO se perdió en silencio
  });

  it("(e) re-corrida NO reprocesa: la segunda corrida sobre el estado resultante es [skip] con 0 llamadas (H8)", async () => {
    // Estado compartido: leerPendientes devuelve solo lo que sigue 'pendiente' tras la
    // primera corrida (2 clasificadas + 1 descartada ⇒ 0 pendientes en la segunda).
    let pendientes = N(3);
    const { deps, estado } = depsCon([], providerSecuencia([
      { etiqueta: "no_legislativa", confianza: 0.9 },
      { etiqueta: "politica_no_legislativa", confianza: 0.9 },
      { etiqueta: "deportes", confianza: 0.9 }, // rechazo ⇒ descartada
    ]));
    deps.leerPendientes = async () => pendientes;
    const clasificadasODescartadas = new Set<string>();
    const escribirOriginal = deps.escribirClasificaciones;
    deps.escribirClasificaciones = async (filas) => {
      for (const f of filas) clasificadasODescartadas.add(f.url_hash);
      pendientes = pendientes.filter((p) => !clasificadasODescartadas.has(p.url_hash));
      await escribirOriginal(filas);
    };
    const marcarOriginal = deps.marcarDescartadas;
    deps.marcarDescartadas = async (hashes) => {
      for (const h of hashes) clasificadasODescartadas.add(h);
      pendientes = pendientes.filter((p) => !clasificadasODescartadas.has(p.url_hash));
      await marcarOriginal(hashes);
    };
    const r1 = await clasificarRun(deps, "run-5a");
    expect(r1.procesadas).toBe(3);
    const r2 = await clasificarRun(deps, "run-5b");
    expect(r2.procesadas).toBe(0);
    expect(estado.ledger.map((l) => l.llamadas)).toEqual([3, 0]);
    expect(estado.logs.some((l) => l.includes("[skip]"))).toBe(true);
  });

  it("(f) el CAP es 500, congelado por LITERAL (H1): moverlo exige tocar este test)", () => {
    expect(CAP_LLAMADAS_POR_CORRIDA).toBe(500);
  });
});
