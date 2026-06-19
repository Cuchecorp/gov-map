// spike.ts — SPIKE DESECHABLE (Phase 8, VOTE-01). NO es codigo de produccion.
//
// Objetivo: validar EN VIVO, detras del WAF gubernamental, que
// `opendata.camara.cl/wscamaradiputados.asmx` (`getVotaciones_Boletin` ->
// `getVotacion_Detalle`) entrega el voto individual por diputado utilizable para
// enlace determinista (DIPID -> id_diputado_camara), y registrar la decision binaria
// CONFIRMAR / REPLANIFICAR.
//
// RE-USA VERBATIM los simbolos v1.0 de @obs/tramitacion (CamaraConnector,
// parseCamaraVotacion, parseCamaraVotoDetalle, reconciliarVotosCamara) y la politica
// de red LOCKED de @obs/ingest (Fetcher + HostRateLimiter 2-3s + RobotsGuard +
// assertAllowedUrl SSRF). NO reimplementa fetch/parse/cruce, NO usa BaseConnector.run
// (su cache diaria saltaria la re-corrida LIVE del mismo dia), NO toca Supabase ni R2.
//
// Este paquete es THROWAWAY: el conector @obs/votos de produccion, el modelo de voto y
// la ficha son Phase 10. Aqui solo vive el spike + su gate vitest.

import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import {
  CamaraConnector,
  parseCamaraVotacion,
  parseCamaraVotoDetalle,
  reconciliarVotosCamara,
  type Votacion,
} from "@obs/tramitacion";
import { cargarMaestra, findWorkspaceRoot } from "@obs/tramitacion";
import type { Parlamentario } from "@obs/core";

/** Resultado de reconciliar UNA votacion contra los totales + la maestra. */
export interface SpikeVotacionResult {
  /** Id de la votacion en modelo comun (p.ej. "camara:88813"). */
  votacionId: string;
  /** Boletin base consultado. */
  boletin: string;
  /** Total afirmativos segun el header de la votacion (parseCamaraVotacion). */
  totalSi: number;
  /** Total negativos segun el header de la votacion. */
  totalNo: number;
  /** Votos nominales 'si' contados en el detalle voto-a-voto. */
  countSi: number;
  /** Votos nominales 'no' contados en el detalle voto-a-voto. */
  countNo: number;
  /** Total de votos nominales (si+no) en el detalle. */
  nominales: number;
  /** Votos con estado_vinculo='confirmado' (DIPID mapeo a id_diputado_camara). */
  confirmados: number;
  /** Ratio confirmados/nominales (0..1). */
  ratioMapeo: number;
  /** True si count(si)===totalSi && count(no)===totalNo (Pitfall 3). */
  totalesReconcilian: boolean;
  /** True si todo voto nominal trae diputadoId no vacio y opcion in {si,no}. */
  camposPoblados: boolean;
}

/** Telemetria de UNA peticion HTTP (comportamiento de rate). */
export interface SpikeRequest {
  url: string;
  status: "ok" | "error";
  /** Latencia observada en ms (incluye el delay 2-3s LOCKED del HostRateLimiter). */
  latenciaMs: number;
  /** Mensaje de error si status==='error'. */
  error?: string;
}

/** Resultado agregado del spike (alimenta el FINDINGS + la decision binaria). */
export interface SpikeResult {
  porVotacion: SpikeVotacionResult[];
  requests: SpikeRequest[];
  /** Cobertura: boletines de la muestra que devolvieron >=1 votacion con detalle. */
  boletinesConDetalle: number;
  /** Boletines de la muestra consultados. */
  boletinesConsultados: number;
}

export interface RunSpikeOpts {
  /** Boletines base de la muestra (sin sufijo), p.ej. ["14309", "18296"]. */
  boletines: string[];
  /** Maestra ya cargada; si se omite, se carga del seed autoritativo. */
  maestra?: Parlamentario[];
  /** Logger (por defecto console.log). */
  log?: (msg: string) => void;
  /** Limite de votaciones por boletin (acota requests contra el WAF). Default: 3. */
  maxVotacionesPorBoletin?: number;
}

/** Construye el CamaraConnector con la politica LOCKED de @obs/ingest (orden LOCKED). */
export function buildCamaraConnector(): CamaraConnector {
  // allowlist={} -> el default ya cubre el sufijo "camara.cl" (opendata.camara.cl pasa).
  // NO se edita el allowlist (eso es Phase 10 per Deferred).
  const allowlist = {};
  return new CamaraConnector({
    fetcher: new Fetcher({ allowlist }),
    rateLimiter: new HostRateLimiter(), // 2-3s serial por host (LOCKED default)
    robots: new RobotsGuard({ allowlist }),
    allowlist,
  });
}

/** Reconcilia el detalle de UNA votacion contra sus totales + la maestra. */
export function evaluarVotacion(
  v: Votacion,
  detalleXml: string,
  maestra: Parlamentario[],
): SpikeVotacionResult {
  const crudos = parseCamaraVotoDetalle(detalleXml);
  const countSi = crudos.filter((c) => c.opcion === "si").length;
  const countNo = crudos.filter((c) => c.opcion === "no").length;
  const camposPoblados =
    crudos.length >= 1 &&
    crudos.every(
      (c) => c.diputadoId.length > 0 && (c.opcion === "si" || c.opcion === "no"),
    );

  const votos = reconciliarVotosCamara(crudos, v.id, maestra);
  const confirmados = votos.filter(
    (x) => x.estado_vinculo === "confirmado" && x.metodo === "determinista",
  ).length;
  const nominales = crudos.length;

  return {
    votacionId: v.id,
    boletin: v.boletin,
    totalSi: v.total_si,
    totalNo: v.total_no,
    countSi,
    countNo,
    nominales,
    confirmados,
    ratioMapeo: nominales > 0 ? confirmados / nominales : 0,
    totalesReconcilian: countSi === v.total_si && countNo === v.total_no,
    camposPoblados,
  };
}

/**
 * Corre el spike LIVE sobre la muestra de boletines. Por cada boletin:
 * fetchVotacionesBoletin -> parseCamaraVotacion -> por cada votacion (acotada),
 * fetchVotacionDetalle -> evaluarVotacion. Acumula telemetria de rate.
 *
 * Hace red REAL (gov WAF) con el delay 2-3s LOCKED. Solo se invoca desde el bloque
 * LIVE-gated del test (VOTE_SPIKE_LIVE=1) o una corrida deliberada del operador.
 */
export async function runSpike(opts: RunSpikeOpts): Promise<SpikeResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const maxVot = opts.maxVotacionesPorBoletin ?? 3;
  const maestra =
    opts.maestra ?? cargarMaestra(findWorkspaceRoot(process.cwd()), log);

  const camara = buildCamaraConnector();
  const requests: SpikeRequest[] = [];
  const porVotacion: SpikeVotacionResult[] = [];
  let boletinesConDetalle = 0;

  const timed = async <T>(url: string, fn: () => Promise<T>): Promise<T> => {
    const t0 = Date.now();
    try {
      const out = await fn();
      requests.push({ url, status: "ok", latenciaMs: Date.now() - t0 });
      return out;
    } catch (e) {
      requests.push({
        url,
        status: "error",
        latenciaMs: Date.now() - t0,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  };

  for (const boletin of opts.boletines) {
    let votaciones: Votacion[] = [];
    try {
      const xml = await timed(`getVotaciones_Boletin?prmBoletin=${boletin}`, () =>
        camara.fetchVotacionesBoletin(boletin),
      );
      votaciones = parseCamaraVotacion(xml);
      log(`[spike] boletin ${boletin}: ${votaciones.length} votaciones`);
    } catch (e) {
      log(
        `[spike] boletin ${boletin}: ERROR lista -> ${e instanceof Error ? e.message : e}`,
      );
      continue;
    }

    let tuvoDetalle = false;
    for (const v of votaciones.slice(0, maxVot)) {
      const wsId = v.id.replace(/^camara:/, "");
      try {
        const detXml = await timed(
          `getVotacion_Detalle?prmVotacionId=${wsId}`,
          () => camara.fetchVotacionDetalle(wsId),
        );
        const res = evaluarVotacion(v, detXml, maestra);
        porVotacion.push(res);
        if (res.nominales >= 1) tuvoDetalle = true;
        log(
          `[spike]   ${v.id} bol=${v.boletin} si=${res.countSi}/${res.totalSi} ` +
            `no=${res.countNo}/${res.totalNo} reconcilia=${res.totalesReconcilian} ` +
            `mapeo=${res.confirmados}/${res.nominales} (${(res.ratioMapeo * 100).toFixed(1)}%)`,
        );
      } catch (e) {
        log(
          `[spike]   ${v.id}: ERROR detalle -> ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    if (tuvoDetalle) boletinesConDetalle++;
  }

  return {
    porVotacion,
    requests,
    boletinesConDetalle,
    boletinesConsultados: opts.boletines.length,
  };
}

/** Imprime el bloque FINDINGS legible que Task 2 transcribe al SUMMARY. */
export function imprimirFindings(
  r: SpikeResult,
  log: (msg: string) => void = (m) => console.log(m),
): void {
  const lat = r.requests.map((x) => x.latenciaMs).filter((x) => x > 0);
  const latMin = lat.length ? Math.min(...lat) : 0;
  const latMax = lat.length ? Math.max(...lat) : 0;
  const errores = r.requests.filter((x) => x.status === "error").length;
  const reconcilian = r.porVotacion.filter((v) => v.totalesReconcilian).length;
  const poblados = r.porVotacion.filter((v) => v.camposPoblados).length;
  const ratios = r.porVotacion.map((v) => v.ratioMapeo);
  const ratioMin = ratios.length ? Math.min(...ratios) : 0;

  log("================ FINDINGS (Phase 8 VOTE spike) ================");
  log(
    `Cobertura: ${r.boletinesConDetalle}/${r.boletinesConsultados} boletines con detalle; ` +
      `${r.porVotacion.length} votaciones evaluadas.`,
  );
  log(`Campos poblados (DIPID+Opcion no null): ${poblados}/${r.porVotacion.length} votaciones.`);
  log(`Totales reconcilian (count(si)===total_si & count(no)===total_no): ${reconcilian}/${r.porVotacion.length}.`);
  log(`Ratio mapeo DIPID->id_diputado_camara minimo en la muestra: ${(ratioMin * 100).toFixed(1)}%.`);
  log(
    `Rate: ${r.requests.length} requests, ${errores} errores; latencia ${latMin}-${latMax}ms ` +
      `(incluye delay 2-3s LOCKED del HostRateLimiter).`,
  );
  for (const v of r.porVotacion) {
    log(
      `  - ${v.votacionId} bol=${v.boletin}: si=${v.countSi}/${v.totalSi} no=${v.countNo}/${v.totalNo} ` +
        `reconcilia=${v.totalesReconcilian} mapeo=${v.confirmados}/${v.nominales} ` +
        `(${(v.ratioMapeo * 100).toFixed(1)}%) poblado=${v.camposPoblados}`,
    );
  }
  log("==============================================================");
}
