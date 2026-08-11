// bench-135-cli.ts — benchmark LIVE del clasificador sobre el golden congelado (135-03).
// CORRE LOCAL, JAMÁS EN CI (regla del proyecto: CI sin red ni secrets).
//
// Candidatos: los providers de la capa enchufable con credenciales en env — DeepSeek
// (incumbente), Granite (re-validación de dominio: su APPROVED de v11.0 NO se transfiere,
// D-133-D2/B10) y MiniMax. JAMÁS Sonnet/Opus (D-133b-4: anotadores vetados como evaluados).
//
// El gate (`evaluarClasificador`) computa el veredicto por candidato; la ELECCIÓN es
// computada, nunca por silencio: aprueban ⇒ gana el mejor macro; empate por solapamiento de
// IC ⇒ incumbente (DeepSeek). El artefacto `veredicto-135.json` se canonicaliza y su sha
// entra a CONGELADO.md. La etiqueta que se evalúa es LA EMITIDA (el umbral de confianza es
// seguridad de producción, se reporta como tasa informativa — no altera T1/T3).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DeepSeekProvider, GraniteProvider, MiniMaxProvider, type LLMProvider } from "@obs/llm";
import { clasificarNoticia } from "../clasificador/clasificar.js";
import { evaluarClasificador, type ResultadoCaso, type VeredictoClasificador } from "./gate-clasificador.js";
import { canonicalizar, sha256 } from "./canonicalizar-json.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = join(AQUI, "golden-set.json");
const VEREDICTO_PATH = join(AQUI, "veredicto-135.json");
const DELAY_MS = 300;

interface CasoGoldenMin {
  caso_id: string;
  entrada_llm: { titulo: string; descripcion: string };
  etiqueta: string;
}

interface ResultadoCandidato {
  provider: string;
  modelo: string;
  veredicto: VeredictoClasificador;
  tasa_bajo_umbral: number;
  parse_fallidos: number;
  duracion_s: number;
  nota_infra?: string;
}

function dormir(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function candidatos(env: NodeJS.ProcessEnv): Array<{ nombre: string; provider: LLMProvider }> {
  const lista: Array<{ nombre: string; provider: LLMProvider }> = [];
  if (env.DEEPSEEK_API_KEY) {
    lista.push({ nombre: "deepseek", provider: new DeepSeekProvider({ apiKey: env.DEEPSEEK_API_KEY }) });
  }
  if (env.WORKERS_AI_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID) {
    const baseURL = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`;
    lista.push({ nombre: "granite", provider: new GraniteProvider({ apiKey: env.WORKERS_AI_API_TOKEN, baseURL }) });
  }
  if (env.MINIMAX_API_KEY) {
    lista.push({ nombre: "minimax", provider: new MiniMaxProvider({ apiKey: env.MINIMAX_API_KEY }) });
  }
  return lista;
}

export async function correrBench(): Promise<void> {
  const golden = (JSON.parse(readFileSync(GOLDEN_PATH, "utf8")) as { casos: CasoGoldenMin[] }).casos;
  if (golden.length !== 159) throw new Error(`bench-135: golden con ${golden.length} casos (esperaba 159)`);

  const lista = candidatos(process.env);
  if (lista.length === 0) throw new Error("bench-135: cero candidatos con credenciales — nada que medir (LOUD)");
  console.log(`bench-135: candidatos=${lista.map((c) => c.nombre).join(",")} casos=${golden.length}`);

  const resultados: ResultadoCandidato[] = [];
  for (const { nombre, provider } of lista) {
    const t0 = Date.now();
    const porCaso: ResultadoCaso[] = [];
    let bajoUmbral = 0;
    let parseFallidos = 0;
    for (const [i, caso] of golden.entries()) {
      const r = await clasificarNoticia(provider, caso.entrada_llm);
      if (r.etiqueta === null) parseFallidos += 1;
      if (r.bajo_umbral) bajoUmbral += 1;
      porCaso.push({ caso_id: caso.caso_id, etiqueta: r.etiqueta });
      if ((i + 1) % 25 === 0) console.log(`  ${nombre}: ${i + 1}/159`);
      await dormir(DELAY_MS);
    }
    const veredicto = evaluarClasificador(porCaso, golden.map((c) => ({ caso_id: c.caso_id, etiqueta: c.etiqueta })));
    const duracion = (Date.now() - t0) / 1000;
    resultados.push({
      provider: nombre,
      modelo: provider.id,
      veredicto,
      tasa_bajo_umbral: bajoUmbral / golden.length,
      parse_fallidos: parseFallidos,
      duracion_s: Math.round(duracion),
      ...(parseFallidos === golden.length
        ? {
            nota_infra:
              "100% parse_fallido: casi con certeza fallo de INFRAESTRUCTURA (credencial/endpoint), no calidad — verificar con sonda antes de citar estas metricas (H3, verificacion 135)",
          }
        : {}),
    });
    const macro = veredicto.metricas.find((m) => m.id === "T3")!;
    console.log(
      `bench-135: ${nombre} aprueba=${veredicto.aprueba} T3=${macro.valor?.toFixed(4)} [${macro.ic95?.inf.toFixed(3)},${macro.ic95?.sup.toFixed(3)}] bajoUmbral=${(bajoUmbral / 159).toFixed(3)} parseFallidos=${parseFallidos} dur=${Math.round(duracion)}s`,
    );
  }

  // Elección COMPUTADA: aprobados por mejor macro; empate por solapamiento de IC ⇒ incumbente.
  const aprobados = resultados.filter((r) => r.veredicto.aprueba);
  let eleccion: string | null = null;
  let razon: string;
  if (aprobados.length === 0) {
    razon = "ningún candidato aprueba la vara — NEWS-05 no entra a producción (refutación parcial/total según T-vetos)";
  } else {
    const conMacro = aprobados
      .map((r) => ({ r, t3: r.veredicto.metricas.find((m) => m.id === "T3")! }))
      .sort((a, b) => (b.t3.valor ?? 0) - (a.t3.valor ?? 0));
    const mejor = conMacro[0]!;
    const empatados = conMacro.filter(
      (c) => c.t3.ic95 && mejor.t3.ic95 && c.t3.ic95.sup >= mejor.t3.ic95.inf,
    );
    const incumbente = empatados.find((c) => c.r.provider === "deepseek");
    const elegido = incumbente ?? mejor;
    eleccion = elegido.r.provider;
    razon =
      empatados.length > 1
        ? `empate por solapamiento de IC entre ${empatados.map((c) => c.r.provider).join(",")} ⇒ incumbente`
        : "mejor exactitud macro sin empate";
  }

  const artefacto = {
    fecha: "2026-08-10",
    golden_sha256: "47ace935f85ae921c5ca8e2c11133b3a82278b371ba21ba516f498cada33c03c",
    nota: "etiqueta evaluada = la emitida; el umbral de confianza es seguridad de produccion (tasa informativa). T4/T9 no-medidos fail-closed: ninguna clase enruta a fichas.",
    candidatos: resultados,
    eleccion,
    razon,
  };
  const raw = canonicalizar(artefacto);
  writeFileSync(VEREDICTO_PATH, raw, "utf8");
  console.log(`bench-135: eleccion=${eleccion ?? "NINGUNA"} (${razon})`);
  console.log(`bench-135: sha256=${sha256(raw)}`);
}

const ESTE_ARCHIVO = fileURLToPath(import.meta.url);
if (ESTE_ARCHIVO === (process.argv[1] ?? "")) {
  correrBench().catch((err) => {
    console.error("bench-135 FALLÓ:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
