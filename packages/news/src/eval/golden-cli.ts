// golden-cli.ts — construye, valida y CONGELA `golden-set.json` (133-b-07, D-133-E2,
// D-133b-7). Cero red, cero DB: registro C2.5 + arbitraje + muestra + pool + calibración.
//
// EL HASH DE ESTE ARTEFACTO SE EMITE UNA SOLA VEZ. Cualquier cambio posterior de límite,
// semilla o composición obliga a re-etiquetar todo (D-133b-7).
//
// `etiqueta_humana` (nombre LOCKED del esquema) contiene la etiqueta de CALIBRACIÓN PROXY
// FABLE en los 20 casos de calibración — κ(humano↔máquina) NO MEDIDO
// (133-b-ENMIENDA-PROXY.md). La semántica proxy se declara en `nota_calibracion` del
// artefacto; el esquema congelado no se muta.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CasoGoldenSchema, type CasoGolden } from "./caso-golden.js";
import { construirEntradaLlm } from "./entrada-llm.js";
import { despojarHtml, esLegislativo, terminosQueMatchean } from "../prefiltro-lexico.js";
import { SEMILLA, type CasoMuestraCalib } from "./calibracion.js";
import { canonicalizar, sha256 } from "./canonicalizar-json.js";
import { nPorClase } from "./kappa.js";
import type { FilaRegistro } from "./registro.js";
import type { PoolCaso } from "./pool-r2.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = join(AQUI, "golden-set.json");

interface ArbitrajeItem {
  caso_id: string;
  eleccion: "a" | "b";
  justificacion: string;
}

/** n mínimo de D-133-D2 para T4/T9 — bajo esto la clase queda `no-medido` y NO ENRUTA. */
const N_MINIMO_VETO = 25;

export function congelarGolden(): {
  sha: string;
  n: number;
  nPorClaseFinal: Record<string, number>;
  noMedidas: string[];
} {
  const registro = JSON.parse(readFileSync(join(AQUI, "registro-anotacion.json"), "utf8")) as {
    ronda: number;
    sha_prompt: string;
    filas: FilaRegistro[];
  };
  const arbitraje = JSON.parse(readFileSync(join(AQUI, "arbitraje-133b.json"), "utf8")) as {
    arbitro: string;
    items: ArbitrajeItem[];
  };
  const muestra = JSON.parse(readFileSync(join(AQUI, "muestra-133b.json"), "utf8")) as {
    semilla: string;
    casos: CasoMuestraCalib[];
  };
  if (muestra.semilla !== SEMILLA) throw new Error("golden-cli: semilla de muestra no coincide");
  const pool = JSON.parse(readFileSync(join(AQUI, "pool-133b.json"), "utf8")) as PoolCaso[];
  const calibracion = JSON.parse(
    readFileSync(join(AQUI, "etiquetas-calibracion-fable.json"), "utf8"),
  ) as { etiquetas: Array<{ id: string; etiqueta: string }> };

  const poolPorHash = new Map(pool.map((c) => [c.url_hash, c]));
  const muestraPorId = new Map(muestra.casos.map((c) => [c.caso_id, c]));
  const fablePorId = new Map(calibracion.etiquetas.map((e) => [e.id, e.etiqueta]));
  const arbitrajePorId = new Map(arbitraje.items.map((a) => [a.caso_id, a]));

  const casos: CasoGolden[] = registro.filas.map((f) => {
    const casoMuestra = muestraPorId.get(f.caso_id);
    if (!casoMuestra) throw new Error(`golden-cli: "${f.caso_id}" no está en la muestra`);
    const casoPool = poolPorHash.get(casoMuestra.url_hash);
    if (!casoPool) throw new Error(`golden-cli: url_hash de "${f.caso_id}" no está en el pool`);

    let etiqueta: string;
    let resuelto_por: "acuerdo" | "operador" | "no_arbitrado";
    if (f.acuerdo) {
      etiqueta = f.etiqueta_a;
      resuelto_por = "acuerdo";
    } else {
      const arb = arbitrajePorId.get(f.caso_id);
      if (!arb) throw new Error(`golden-cli: desacuerdo "${f.caso_id}" sin arbitraje — prohibido congelar`);
      etiqueta = arb.eleccion === "a" ? f.etiqueta_a : f.etiqueta_b;
      resuelto_por = "operador";
    }

    const tituloCrudo = despojarHtml(casoPool.titulo);
    const descripcionCruda = despojarHtml(casoPool.descripcion ?? "");
    const entradaLlm = construirEntradaLlm({ titulo: casoPool.titulo, descripcion: casoPool.descripcion });

    const caso: CasoGolden = {
      caso_id: f.caso_id,
      procedencia: {
        r2_path: casoPool.r2_path,
        url_hash: casoPool.url_hash,
        url_canonica: casoPool.url_canonica,
        outlet: casoPool.outlet,
        fecha_captura: casoPool.date_bucket,
        fecha_pub: casoPool.fecha_pub,
      },
      entrada: { titulo: tituloCrudo, descripcion: descripcionCruda },
      entrada_llm: entradaLlm,
      estrato: casoMuestra.estrato,
      prefiltro: {
        paso: esLegislativo(casoPool.titulo, casoPool.descripcion),
        terminos: terminosQueMatchean(casoPool.titulo, casoPool.descripcion),
      },
      etiqueta,
      revision: {
        etiqueta_a: f.etiqueta_a,
        etiqueta_b: f.etiqueta_b,
        justificacion_a: f.justificacion_a,
        justificacion_b: f.justificacion_b,
        acuerdo: f.acuerdo,
        resuelto_por,
        modelo_a: f.modelo_a,
        modelo_b: f.modelo_b,
        en_calibracion_humana: f.en_calibracion,
        etiqueta_humana: f.en_calibracion ? (fablePorId.get(f.caso_id) ?? null) : null,
        revisado_en: f.revisado_en,
      },
    };
    return CasoGoldenSchema.parse(caso);
  });

  if (casos.length !== registro.filas.length || casos.length === 0) {
    throw new Error("golden-cli: conteo de casos no coincide con el registro (cero vacuo prohibido)");
  }

  // Estrato P-dirigido (D-133b-3 paso 5): casos de fixtures fuera de la ventana, anotados y
  // arbitrados con el mismo protocolo, ya ensamblados como CasoGolden en
  // `p-dirigido-133b.json`. Se excluyen de toda cifra descriptiva del flujo de prensa
  // (B2.5 punto 6); aquí solo suman n a las clases con veto. Si el archivo no existe, el
  // golden se congela sin el estrato (y las clases bajo 25 quedan no-medidas).
  let nPDirigido = 0;
  try {
    const pDirigido = JSON.parse(readFileSync(join(AQUI, "p-dirigido-133b.json"), "utf8")) as {
      casos: unknown[];
    };
    for (const crudo of pDirigido.casos) {
      const caso = CasoGoldenSchema.parse(crudo);
      if (caso.estrato !== "P-dirigido") {
        throw new Error(`golden-cli: caso "${caso.caso_id}" en p-dirigido-133b.json sin estrato P-dirigido`);
      }
      if (casos.some((c) => c.caso_id === caso.caso_id)) {
        throw new Error(`golden-cli: caso P-dirigido "${caso.caso_id}" duplica un caso de la ventana`);
      }
      casos.push(caso);
      nPDirigido += 1;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  const conteo = nPorClase(casos.map((c) => c.etiqueta));
  const noMedidas = ["tramitacion_legislativa", "actividad_parlamentaria"].filter(
    (clase) => (conteo[clase] ?? 0) < N_MINIMO_VETO,
  );

  const artefacto = {
    semilla: SEMILLA,
    ventana: "2026-08-05..2026-08-07",
    ronda_anotacion: registro.ronda,
    sha_prompt_anotacion: registro.sha_prompt,
    arbitro: arbitraje.arbitro,
    nota_calibracion:
      "etiqueta_humana = calibracion PROXY FABLE (133-b-ENMIENDA-PROXY.md, 2026-08-10); k(humano-maquina) NO MEDIDO en este milestone",
    clases_no_medidas_fail_closed: noMedidas,
    n_por_clase: conteo,
    n_p_dirigido: nPDirigido,
    casos,
  };

  const raw = canonicalizar(artefacto);
  writeFileSync(GOLDEN_PATH, raw, "utf8");
  return { sha: sha256(raw), n: casos.length, nPorClaseFinal: conteo, noMedidas };
}

const ESTE_ARCHIVO = fileURLToPath(import.meta.url);
const ARCHIVO_INVOCADO = process.argv[1] ?? "";
if (ESTE_ARCHIVO === ARCHIVO_INVOCADO) {
  try {
    const r = congelarGolden();
    console.log(
      `golden: casos=${r.n} nPorClase=${JSON.stringify(r.nPorClaseFinal)} noMedidas=${JSON.stringify(r.noMedidas)}`,
    );
    console.log(`golden-cli: sha256=${r.sha} <-- ESTE ES el hash del golden-set.json (se emite UNA vez)`);
  } catch (err) {
    console.error("golden-cli FALLÓ:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
