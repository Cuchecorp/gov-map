// run-bio — orquestador dos-etapas de la ingesta de bio (diputados + senadores + comisiones),
// FAIL-CLOSED en el enlace de identidad.
//
// Flujo (ORDEN LOCKED de dos etapas, CLAUDE.md):
//   1. Conector → crudos (XML diputados / sparql-results senadores / HTML comisiones).
//   2. Etapa 1 (R2): persiste un ENVELOPE JSON content-addressed (bio/envelope/<fecha>/<sha>.json)
//      ANTES de parsear. `existed` (412) → short-circuit "sin novedades". `--from-r2` reconstruye
//      el envelope desde R2 y usa un conector-fake que lo sirve SIN red.
//   3. Parse (allowlist — la PII jamás llega al modelo).
//   4. MATCH FAIL-CLOSED:
//        - Diputados: `id_diputado_camara === dipid`, confirma SOLO si length === 1 (NUNCA
//          name-match de diputados — hay DIPID exacto, research Pitfall 4). Sin match → skip.
//        - Senadores: matchDeterminista por nombre único (BCN no expone parlid, research A3).
//        - Comisiones: membresía SOLO por DIPID confirmado (mismo criterio que diputados).
//      Sin match único → skip + sinMatch (nombres/DIPIDs SOLO en log local, NO persistidos).
//   5. Writer idempotente: upsert bio/militancias/comisiones/membresías + UPDATE parlamentario.partido
//      desde la militancia ACTUAL.

import { R2Store, sha256Hex } from "@obs/ingest";
import { type Parlamentario } from "@obs/core";
import { confirmar } from "@obs/identity";
import type { MaestraRow } from "@obs/identity";
import { parseDiputadosBio, DIPUTADOS_BIO_URL } from "./parse-diputados";
import {
  parseBcnSenadores,
  enlazarSenadoresPorParlid,
  BCN_SPARQL_URL,
  type SparqlResults,
} from "./parse-bcn-senadores";
import {
  parseComisionesCatalogo,
  parseIntegrantes,
  COMISIONES_CATALOGO_URL,
} from "./parse-comisiones";
import type { Militancia, Comision, ComisionMembresia } from "./model";
import type { BioWriter, PartidoUpdate } from "./writer";
import { comisionKey } from "./writer";

/** Envelope crudo persistido en R2 (Etapa 1) y replayado por --from-r2 (SIN red). */
export interface BioEnvelope {
  /** XML crudo de `retornarDiputadosPeriodoActual`, o null si no se ingiere diputados. */
  diputadosXml: string | null;
  /** sparql-results JSON crudo de BCN (string), o null. */
  senadoresSparql: string | null;
  /** HTML crudo del catálogo de comisiones, o null. */
  comisionesCatalogoHtml: string | null;
  /** HTML crudo de integrantes por prmID de comisión: { prmId: html }. */
  integrantesPorComision: Record<string, string>;
}

/** Conector que trae los crudos de las fuentes (inyectable; fake en tests / --from-r2). */
export interface BioConector {
  fetchEnvelope(): Promise<BioEnvelope>;
}

export interface RunBioOpts {
  /** Conector de fuentes (un fetch por corrida). Inyectable en tests. */
  conector: BioConector;
  /** Writer idempotente (InMemory en tests/dry-run, Supabase en LIVE). */
  writer: BioWriter;
  /** Maestra de parlamentarios (cruce por DIPID diputados / nombre senadores). */
  maestra: MaestraRow[];
  /** Store R2 para la Etapa 1 (crudo). Si se omite, no se persiste crudo (r2Path=null). */
  r2Store?: R2Store;
  /** ISO 8601 de captura (procedencia determinista en tests). Default: now. */
  fechaCaptura?: string;
  /** Periodo del blocking de senadores (nombre único). */
  periodoSenado?: string;
  /** Modo replay: lee el envelope crudo desde esta key de R2 (SIN red). */
  fromR2?: string;
  /** Sink de logs (inyectable en tests). Default: noop. */
  log?: (m: string) => void;
}

export interface RunBioResult {
  /** Key del crudo en R2, o null (Etapa 1 omitida/fallida). */
  r2Path: string | null;
  /** Filas de bio + militancias escritas. */
  bios: number;
  militancias: number;
  /** Comisiones + membresías escritas. */
  comisiones: number;
  membresias: number;
  /** Parlamentarios cuyo `partido` se actualizó desde la militancia actual. */
  actualizados: number;
  /** Menciones sin match único (fail-closed): DIPIDs/nombres sin enlazar (log local). */
  sinMatch: string[];
}

/** Conector-fake que sirve un envelope ya materializado (para --from-r2, SIN red). */
function conectorDeEnvelope(env: BioEnvelope): BioConector {
  return {
    async fetchEnvelope() {
      return env;
    },
  };
}

/**
 * Corre la ingesta de bio dos-etapas, fail-closed. Idempotente; provenance por fila. Un diputado
 * fuera de la maestra o un senador homónimo quedan sin enlazar (NUNCA fabrica FK).
 */
export async function runBio(opts: RunBioOpts): Promise<RunBioResult> {
  const log = opts.log ?? (() => {});
  const fechaCaptura = opts.fechaCaptura ?? new Date().toISOString();
  const date = fechaCaptura.slice(0, 10);
  // periodoSenado sigue en RunBioOpts por compat, pero el join de senadores ahora es por
  // parlid_senado determinista (no por nombre+periodo) → ya no se usa aquí.
  void opts.periodoSenado;

  let r2Path: string | null = null;
  let envelope: BioEnvelope;

  // Modo --from-r2: reconstruye el envelope desde R2 y usa un conector-fake (CERO red).
  if (opts.fromR2 != null) {
    if (opts.r2Store == null) {
      throw new Error("--from-r2 requiere `r2Store` configurado");
    }
    log(`bio: modo --from-r2 → leyendo crudo desde R2 (${opts.fromR2})`);
    const bytes = await opts.r2Store.getObject(opts.fromR2);
    envelope = JSON.parse(new TextDecoder().decode(bytes)) as BioEnvelope;
    r2Path = opts.fromR2;
  } else {
    // Etapa 0: fetch de crudos.
    envelope = await opts.conector.fetchEnvelope();

    // Etapa 1 (R2): persiste el envelope content-addressed ANTES de parsear.
    if (opts.r2Store) {
      const bytes = new TextEncoder().encode(JSON.stringify(envelope));
      const sha = await sha256Hex(bytes);
      const { r2Path: newPath, existed } = await opts.r2Store.putImmutable(
        "bio",
        "envelope",
        date,
        sha,
        "json",
        bytes,
      );
      r2Path = newPath;
      if (existed) {
        log("[skip] sin novedades — bio envelope");
        return {
          r2Path,
          bios: 0,
          militancias: 0,
          comisiones: 0,
          membresias: 0,
          actualizados: 0,
          sinMatch: [],
        };
      }
      log(`bio: crudo en R2 → ${r2Path}`);
    }
  }

  // ── Etapa 2: parse (allowlist) + match fail-closed + write ────────────────────
  const militanciasOut: Militancia[] = [];
  const partidoUpdates: PartidoUpdate[] = [];
  const sinMatch = new Set<string>();

  // Índice DIPID → id de la maestra (diputados). Cámara "diputados" en @obs/core.
  const porDipid = new Map<string, string>();
  for (const p of opts.maestra) {
    if (p.id_diputado_camara != null) {
      // Si dos filas comparten DIPID (no debería), lo marcamos ambiguo (no confirma).
      porDipid.set(p.id_diputado_camara, porDipid.has(p.id_diputado_camara) ? "__AMBIGUO__" : p.id);
    }
  }

  // (A) Diputados: match por DIPID exacto (NUNCA name-match — research Pitfall 4).
  if (envelope.diputadosXml != null) {
    const diputados = parseDiputadosBio(envelope.diputadosXml, { fechaCaptura, log });
    for (const d of diputados) {
      const matches = opts.maestra.filter((p) => p.id_diputado_camara === d.dipid);
      if (matches.length !== 1) {
        sinMatch.add(`DIP:${d.dipid}`); // 0 o 2+ → fail-closed, no fabrica FK
        continue;
      }
      const enlace = confirmar(matches[0]!.id);
      for (const m of d.militancias) {
        militanciasOut.push({
          parlamentarioId: enlace.parlamentarioId,
          partido: m.partido,
          partidoAlias: m.partidoAlias,
          desde: m.desde,
          hasta: m.hasta,
          esActual: m.esActual,
          origen: "camara-bio-diputados",
          fechaCaptura,
          enlace: DIPUTADOS_BIO_URL,
        });
      }
      // parlamentario.partido ← militancia ACTUAL (fail-loud si no hay actual clara → no actualiza).
      const actuales = d.militancias.filter((m) => m.esActual);
      if (actuales.length === 1) {
        partidoUpdates.push({
          parlamentarioId: enlace.parlamentarioId,
          partido: actuales[0]!.partido,
          fechaCaptura,
        });
      } else if (actuales.length > 1) {
        log(`bio: DIP:${d.dipid} con ${actuales.length} militancias actuales → NO actualiza partido (ambiguo, A1)`);
      }
    }
  }

  // (B) Senadores: match por parlid_senado DETERMINISTA (corrección LIVE 90-03: BCN SÍ expone
  // bio:idSenado en la query → join exacto, más fuerte que el name-match del research A3, que
  // queda como fallback documentado). Sin parlid o sin match único → skip + sinMatch (declarado).
  if (envelope.senadoresSparql != null) {
    const json = JSON.parse(envelope.senadoresSparql) as SparqlResults;
    const senMil = parseBcnSenadores(json);
    const res = enlazarSenadoresPorParlid(senMil, opts.maestra, {
      origen: "bcn-senadores",
      fechaCaptura,
      enlace: BCN_SPARQL_URL,
    });
    for (const m of res.militancias) militanciasOut.push(m);
    // `enlazarSenadoresPorParlid` ya prefija sus entradas (`SEN:<parlid>` o el nombre crudo si BCN
    // no trajo idSenado) → NO re-prefijar aquí (evita el doble `SEN:SEN:` cosmético).
    for (const n of res.sinMatch) sinMatch.add(n);
    // parlamentario.partido de senadores ← militancia vigente (esActual = sin fin).
    // WR-01 (espejo del guard A1 de diputados): para senadores `esActual` = `hasta == null`, así que
    // BCN stale/renombres modelados como dos rangos abiertos pueden dar DOS militancias esActual para
    // el mismo parlamentario. Elegir la primera arbitraria escribiría un partido posiblemente errado.
    // Solo se actualiza cuando hay EXACTAMENTE una militancia vigente; si no, se loguea y NO actualiza.
    for (const enlace of res.confirmados) {
      const vigentes = res.militancias.filter(
        (m) => m.parlamentarioId === enlace.parlamentarioId && m.esActual,
      );
      if (vigentes.length === 1) {
        partidoUpdates.push({
          parlamentarioId: enlace.parlamentarioId,
          partido: vigentes[0]!.partido,
          fechaCaptura,
        });
      } else if (vigentes.length > 1) {
        log(
          `bio: SEN:${enlace.parlamentarioId} con ${vigentes.length} militancias actuales → NO actualiza partido (ambiguo, A1)`,
        );
      }
    }
  }

  // (C) Comisiones: catálogo + membresía FAIL-CLOSED por DIPID (mismo criterio que diputados).
  let comisionesCount = 0;
  let membresiasCount = 0;
  if (envelope.comisionesCatalogoHtml != null) {
    const catalogo = parseComisionesCatalogo(envelope.comisionesCatalogoHtml);
    const comisiones: Comision[] = catalogo.map((c) => ({
      nombre: c.nombre,
      camara: c.camara,
      tipo: c.tipo,
      origen: "camara-comisiones",
      fechaCaptura,
      enlace: COMISIONES_CATALOGO_URL,
    }));
    const idPorClave = await opts.writer.upsertComisiones(comisiones);
    comisionesCount = comisiones.length;

    const membresias: ComisionMembresia[] = [];
    for (const c of catalogo) {
      const html = envelope.integrantesPorComision[c.prmId];
      if (html == null) continue; // sin fuente de integrantes → catálogo sin membresía (honesto)
      const clave = comisionKey(c.nombre, c.camara);
      const comisionId = idPorClave.get(clave);
      if (comisionId == null) continue;
      const integrantes = parseIntegrantes(html);
      for (const it of integrantes) {
        const matches = opts.maestra.filter((p) => p.id_diputado_camara === it.dipid);
        if (matches.length !== 1) {
          sinMatch.add(`COM:${it.dipid}`); // fail-closed: sin match → no membresía
          continue;
        }
        const enlace = confirmar(matches[0]!.id);
        membresias.push({
          comisionId,
          parlamentarioId: enlace.parlamentarioId,
          cargo: it.cargo,
          origen: "camara-comisiones",
          fechaCaptura,
          enlace: COMISIONES_CATALOGO_URL,
        });
      }
    }
    await opts.writer.upsertMembresias(membresias);
    membresiasCount = membresias.length;
  }

  // Writer: militancias + partido. (bio 1:1 se puebla con profesion null en 90; poblable después.)
  await opts.writer.upsertMilitancias(militanciasOut);
  await opts.writer.actualizarPartidoParlamentario(partidoUpdates);

  log(
    `bio: OK → ${militanciasOut.length} militancias / ${comisionesCount} comisiones / ` +
      `${membresiasCount} membresías / ${partidoUpdates.length} partidos actualizados / ` +
      `${sinMatch.size} sin match (r2Path=${r2Path ?? "none"})`,
  );

  return {
    r2Path,
    bios: 0,
    militancias: militanciasOut.length,
    comisiones: comisionesCount,
    membresias: membresiasCount,
    actualizados: partidoUpdates.length,
    sinMatch: [...sinMatch],
  };
}

/** Reexport util para el CLI (90-03): construir un conector-fake desde un envelope. */
export { conectorDeEnvelope };

/** Tipo de conveniencia para el CLI. */
export type { Parlamentario };
