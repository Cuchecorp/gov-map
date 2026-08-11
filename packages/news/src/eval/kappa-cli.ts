// kappa-cli.ts — computa y congela las métricas de acuerdo del golden 133-b (plan 133-b-06):
// κ(máquina↔máquina) sobre los 154, κ(fable↔A) y κ(fable↔B) sobre los 20 de calibración,
// regla de interpretabilidad C2.1.3 (con la limitación intra-familia de la enmienda proxy),
// n por clase provisional y tasas de `ambiguo`. Cero red, cero DB.
//
// NOMBRE HONESTO: κ(fable↔máquina), JAMÁS κ(humano↔máquina) — ese quedó NO MEDIDO
// (133-b-ENMIENDA-PROXY.md). Toda cifra viaja con su n y su IC95 (regla de intervalos
// D-133-D2: jamás pelada).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cohenKappa, ic95Proporcion, reglaInterpretabilidad, nPorClase } from "./kappa.js";
import type { FilaRegistro } from "./registro.js";
import { canonicalizar, sha256 } from "./canonicalizar-json.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const KAPPAS_PATH = join(AQUI, "kappas-133b.json");

export function computarYCongelar(): { sha: string; resumen: string } {
  const registro = JSON.parse(readFileSync(join(AQUI, "registro-anotacion.json"), "utf8")) as {
    filas: FilaRegistro[];
  };
  const calibracion = JSON.parse(
    readFileSync(join(AQUI, "etiquetas-calibracion-fable.json"), "utf8"),
  ) as { etiquetas: Array<{ id: string; etiqueta: string }> };

  const filas = registro.filas;
  if (filas.length === 0) throw new Error("kappa-cli: registro vacío (cero vacuo)");

  // κ(m↔m) sobre TODOS los casos, con `ambiguo` como etiqueta más (C2.5: se conserva).
  const kappaMM = cohenKappa(filas.map((f) => ({ a: f.etiqueta_a, b: f.etiqueta_b })));

  // κ(fable↔A/B) sobre los 20 de calibración — join estricto, 20/20 o abortar.
  const fablePorId = new Map(calibracion.etiquetas.map((e) => [e.id, e.etiqueta]));
  const filasCalib = filas.filter((f) => f.en_calibracion);
  if (filasCalib.length !== 20 || fablePorId.size !== 20) {
    throw new Error(
      `kappa-cli: calibración incompleta (filas=${filasCalib.length}, fable=${fablePorId.size}) — se exigen 20/20`,
    );
  }
  const paresFA = filasCalib.map((f) => {
    const fable = fablePorId.get(f.caso_id);
    if (!fable) throw new Error(`kappa-cli: caso de calibración "${f.caso_id}" sin etiqueta Fable`);
    return { a: fable, b: f.etiqueta_a };
  });
  const paresFB = filasCalib.map((f) => ({ a: fablePorId.get(f.caso_id)!, b: f.etiqueta_b }));
  const kappaFA = cohenKappa(paresFA);
  const kappaFB = cohenKappa(paresFB);

  const veredicto = reglaInterpretabilidad(kappaMM.kappa, kappaFA.kappa, kappaFB.kappa);

  const acuerdos = filas.filter((f) => f.acuerdo).length;
  const icAcuerdo = ic95Proporcion(acuerdos, filas.length);

  // n por clase PROVISIONAL: solo los 136 acordados (los 18 pendientes entran tras b-07).
  const acordadas = filas.filter((f) => f.etiqueta !== null).map((f) => f.etiqueta as string);
  const nProvisional = nPorClase(acordadas);

  const tasaAmbiguoA = filas.filter((f) => f.etiqueta_a === "ambiguo").length / filas.length;
  const tasaAmbiguoB = filas.filter((f) => f.etiqueta_b === "ambiguo").length / filas.length;
  const tasaAmbiguoFable = calibracion.etiquetas.filter((e) => e.etiqueta === "ambiguo").length / 20;

  const artefacto = {
    fecha: "2026-08-10",
    nota_honesta:
      "k(fable-maquina) por 133-b-ENMIENDA-PROXY.md -- k(humano-maquina) NO MEDIDO en este milestone",
    kappa_maquina_maquina: {
      kappa: kappaMM.kappa,
      acuerdo_bruto: kappaMM.acuerdoBruto,
      n: kappaMM.n,
      ic95: kappaMM.ic95,
      ic95_acuerdo_bruto: icAcuerdo,
    },
    kappa_fable_anotador_a: { kappa: kappaFA.kappa, acuerdo_bruto: kappaFA.acuerdoBruto, n: 20, ic95: kappaFA.ic95 },
    kappa_fable_anotador_b: { kappa: kappaFB.kappa, acuerdo_bruto: kappaFB.acuerdoBruto, n: 20, ic95: kappaFB.ic95 },
    regla_interpretabilidad: veredicto,
    puertas_c23: {
      acuerdo_bruto_minimo: 0.8,
      kappa_minimo: 0.65,
      acuerdo_bruto_pasa: kappaMM.acuerdoBruto >= 0.8,
      kappa_pasa: kappaMM.kappa >= 0.65,
    },
    n_por_clase_provisional_136_acordados: nProvisional,
    desacuerdos_pendientes_arbitraje: filas.length - acuerdos,
    tasa_ambiguo: { anotador_a: tasaAmbiguoA, anotador_b: tasaAmbiguoB, fable_calibracion: tasaAmbiguoFable },
  };

  const raw = canonicalizar(artefacto);
  writeFileSync(KAPPAS_PATH, raw, "utf8");

  const resumen =
    `kappas: k_mm=${kappaMM.kappa.toFixed(4)} [${kappaMM.ic95.inf.toFixed(3)},${kappaMM.ic95.sup.toFixed(3)}] n=154 ` +
    `acuerdo=${kappaMM.acuerdoBruto.toFixed(4)} | k_fable_A=${kappaFA.kappa.toFixed(4)} k_fable_B=${kappaFB.kappa.toFixed(4)} n=20 ` +
    `| delta=${veredicto.delta.toFixed(4)} gatillada=${veredicto.gatillada} | puertas: acuerdo>=0.80 ${
      artefacto.puertas_c23.acuerdo_bruto_pasa ? "PASA" : "FALLA"
    }, kappa>=0.65 ${artefacto.puertas_c23.kappa_pasa ? "PASA" : "FALLA"}`;
  return { sha: sha256(raw), resumen };
}

const ESTE_ARCHIVO = fileURLToPath(import.meta.url);
const ARCHIVO_INVOCADO = process.argv[1] ?? "";
if (ESTE_ARCHIVO === ARCHIVO_INVOCADO) {
  try {
    const { sha, resumen } = computarYCongelar();
    console.log(resumen);
    console.log(`kappa-cli: sha256=${sha} (NO es el hash del golden-set.json)`);
  } catch (err) {
    console.error("kappa-cli FALLÓ:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
