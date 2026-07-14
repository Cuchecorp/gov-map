// ingest-run — orquestacion de la corrida de dinero: barrido SERIAL por RUT de la maestra,
// respetando el delay 2-3s LOCKED (el rate-limiter serializa por host; NO se paraleliza contra
// api.mercadopublico.cl). Por cada RUT: valida DV modulo-11, resuelve CodigoEmpresa (paso 1), pide
// ordenes por dia (paso 2), parsea LITERAL, reconcilia RUT-exacto y persiste VERSIONADO — tolerante
// a bloqueos (degradacion honesta) y SIN fabricar filas.
//
// Flujo por RUT:
//   1. isRutValido(rut) — invalido -> CUARENTENA (0 filas, marca de degradacion), nunca fabrica.
//   2. buscarProveedor -> CodigoEmpresa. Bloqueada -> degrada y continua. Sin proveedor -> 0 filas
//      ("consultado sin contratos"). Drift de forma del paso 1 -> cuarentena.
//   3. por cada ventana de dia: ordenesDeCompra -> parseContratos. Drift de forma -> cuarentena.
//   4. reconciliarContrato -> upsertContratistas + upsertContratos.
//   5. al final: marcarIngestado([...marcados], hasta). R2 BLOQUEADO -> sin snapshot crudo, marca.

import type { ChileCompraConnector } from "./connector-chilecompra";
import { ChileCompraBloqueadaError } from "./connector-chilecompra";
import type { DineroWriter } from "./writer";
import { parseContratos, tipoPersona } from "./parse-chilecompra";
import { BuscarProveedorResponseSchema, ORIGEN_DINERO, LICENCIA_DINERO, type Contratista } from "./model";
import { reconciliarContrato, type ReconciliarContratoOpts } from "./reconciliar-contrato";
import { redactarTicket } from "./query";
import { isRutValido, normRut, matchDeterminista } from "@obs/identity";
import type { Parlamentario } from "@obs/core";
import { sha256Hex, type R2Store, type SnapshotWriter } from "@obs/ingest";

/** Defaults del blocking determinista — DEBEN coincidir con los de reconciliar-contrato.ts. */
const PERIODO_DINERO_DEFAULT = "senado-vigente-2026";
const CAMARA_DINERO_DEFAULT: Parlamentario["camara"] = "senado";

const ORIGEN_DRIFT = ORIGEN_DINERO;

/** Una tarea acotada: un RUT de proveedor a consultar (barrido serial por RUT). */
export interface TareaRut {
  /** RUT del proveedor (con puntos+guion+DV o normalizado). */
  rut: string;
  /** Dias `ddmmaaaa` a barrer para este RUT (paso 2 itera dia a dia). */
  dias: string[];
}

/** Marcador de degradacion de una fuente (no es un error de datos: es honestidad). */
export interface DegradacionDinero {
  fuente: string;
  motivo: string;
  /** true si la causa fue cuarentena (RUT invalido o drift estructural). */
  cuarentena?: boolean;
}

export interface RunIngestDineroOpts {
  conector: ChileCompraConnector;
  writer: DineroWriter;
  /** Ticket de ChileCompra (secreto de operador). Sin el, el CLI no llega aca (degrada a dry-run). */
  ticket: string;
  /** Maestra de parlamentarios para el cruce RUT-exacto. */
  maestra: Parlamentario[];
  /** Tareas acotadas (un RUT + dias por tarea). */
  tareas: TareaRut[];
  /** Opciones de reconciliacion (camara/periodo) — defaults seguros. */
  reconciliar?: ReconciliarContratoOpts;
  /** Fecha de corte para el marcador de ingesta (`ingestado_hasta`). Default: hoy (ISO date). */
  ingestadoHasta?: string;
  log?: (msg: string) => void;
  /**
   * Store de crudo R2 (Etapa 1, DEBT-01). Si se configura, cada RUT persiste su envelope
   * content-addressed en R2 ANTES del upsert a Supabase; un put fallido GATEA la Etapa 2 (nunca hay
   * derivado sin crudo reconstruible). Sin el, el runner corre como antes (fuente->Supabase directo).
   */
  r2Store?: R2Store;
  /** Registro de provenance (`source_snapshot`) best-effort tras un put exitoso (no fatal). */
  snapshotWriter?: SnapshotWriter;
  /**
   * Modo replay: r2Path de un envelope guardado. Reconstruye los contratos DESDE R2 con un conector
   * fake (0 fetch a la fuente). Requiere `r2Store`; si falta, lanza. El envelope es por-RUT.
   */
  fromR2?: string;
}

export interface RunIngestDineroResult {
  /** Contratos (ordenes) escritos (suma sobre las tareas no en cuarentena). */
  contratos: number;
  /** Contratistas (sub-maestra) escritos. */
  contratistas: number;
  /** Parlamentarios marcados como ingestados (confirmados en esta corrida). */
  parlamentariosMarcados: number;
  /** RUTs cuarentenados (DV invalido o drift estructural). */
  cuarentenados: string[];
  /** Errores por RUT — tolerados, no abortan la corrida. */
  errores: { fuente: string; clave: string; mensaje: string }[];
  /** Degradaciones honestas (RUT inalcanzable y/o cuarentena). */
  degradaciones: DegradacionDinero[];
}

/**
 * Corre la ingesta de dinero. Idempotente y VERSIONADA. Tolerante: un RUT bloqueado degrada
 * honestamente sin abortar; un RUT invalido o un drift estructural CUARENTENA esa tarea (0 filas),
 * NUNCA fabrica.
 */
export async function runIngestDinero(opts: RunIngestDineroOpts): Promise<RunIngestDineroResult> {
  const log = opts.log ?? (() => {});
  const hasta = opts.ingestadoHasta ?? new Date().toISOString().slice(0, 10);

  // Modo --from-r2 (DEBT-01): reconstruye los contratos DESDE R2, con un conector fake que sirve el
  // envelope por-RUT (0 fetch a la fuente). Espeja tramitacion/ingest-cli.ts:219-266 (adaptado al
  // envelope por-RUT de dinero — Pitfall 2). Reusa el resto del flujo NORMAL (reconcilia+upsert) con
  // el conector fake + el mismo writer YA resuelto (W-1 de Phase 66: NO re-derivar el writer).
  let conector = opts.conector;
  let r2Store = opts.r2Store;
  if (opts.fromR2 != null && opts.fromR2 !== "") {
    if (!opts.r2Store) {
      // Guard de args: el replay EXIGE R2 (de otro modo no hay de donde leer el crudo).
      throw new Error("runIngestDinero: --from-r2 requiere un r2Store configurado");
    }
    log(`ingest-dinero: modo --from-r2 -> leyendo crudo desde R2 (${opts.fromR2})`);
    const bytes = await opts.r2Store.getObject(opts.fromR2);
    const envelope = JSON.parse(new TextDecoder().decode(bytes)) as {
      rut: string;
      buscarProveedor: unknown;
      ordenes: Record<string, unknown>;
    };
    // Conector fake que sirve SOLO el envelope; NUNCA toca api.mercadopublico.cl.
    conector = {
      async buscarProveedor() {
        return envelope.buscarProveedor;
      },
      async ordenesDeCompra(_codigo: string, dia: string) {
        return envelope.ordenes[dia] ?? { Cantidad: 0, Listado: [] };
      },
    } as unknown as ChileCompraConnector;
    // En replay NO se re-persiste el crudo (ya esta en R2): desactivar la Etapa 1 para esta pasada.
    r2Store = undefined;
  }

  const errores: RunIngestDineroResult["errores"] = [];
  const degradaciones: DegradacionDinero[] = [];
  const marcados = new Set<string>();
  const cuarentenados: string[] = [];
  let contratos = 0;
  let contratistas = 0;

  for (const tarea of opts.tareas) {
    const clave = `rut:${tarea.rut}`;

    // 1. DV modulo-11: RUT invalido -> CUARENTENA (0 filas, marca), nunca fabrica.
    if (!isRutValido(tarea.rut)) {
      cuarentenados.push(tarea.rut);
      log(`ingest-dinero: ${clave} RUT INVALIDO (DV) -> CUARENTENA (0 filas)`);
      degradaciones.push({
        fuente: clave,
        motivo: "RUT invalido (DV modulo-11); cuarentena (0 filas), nunca fila silenciosa",
        cuarentena: true,
      });
      continue;
    }

    // 2. Paso 1: RUT -> CodigoEmpresa. Bloqueada -> degrada y continua. Drift -> cuarentena.
    let codigoEmpresa: string;
    let nombreProveedor: string | null;
    // Crudo del paso 1 (para el envelope R2): la RESPUESTA JSON, NUNCA la URL con `&ticket=`.
    let buscarJsonCrudo: unknown = null;
    try {
      const json = await conector.buscarProveedor(tarea.rut, opts.ticket);
      buscarJsonCrudo = json;
      const parsed = BuscarProveedorResponseSchema.safeParse(json);
      if (!parsed.success) {
        cuarentenados.push(tarea.rut);
        log(`ingest-dinero: ${clave} DRIFT (BuscarProveedor forma inesperada) -> CUARENTENA`);
        degradaciones.push({
          fuente: clave,
          motivo: `drift estructural en BuscarProveedor; cuarentena (0 filas)`,
          cuarentena: true,
        });
        continue;
      }
      codigoEmpresa = String(parsed.data.CodigoEmpresa);
      nombreProveedor = parsed.data.NombreEmpresa ?? null;
      // Sin CodigoEmpresa -> "consultado sin contratos" (marca, 0 filas).
      if (!codigoEmpresa || codigoEmpresa === "") {
        marcarSinContratos(marcados, tarea, opts.maestra, opts.reconciliar);
        log(`ingest-dinero: ${clave} sin proveedor -> consultado sin contratos (0 filas)`);
        continue;
      }
    } catch (err) {
      if (err instanceof ChileCompraBloqueadaError) {
        log(`ingest-dinero: ${clave} BLOQUEADA (HTTP ${err.status}) -> degradacion honesta`);
        degradaciones.push({
          fuente: clave,
          motivo: `ChileCompra bloqueo el fetch (HTTP ${err.status}); sin filas para este RUT`,
        });
      } else {
        // CR-01 defensa-en-profundidad: el mensaje capturado NUNCA debe llevar el ticket.
        errores.push({ fuente: ORIGEN_DRIFT, clave, mensaje: redactarTicket(err instanceof Error ? err.message : String(err)) });
      }
      continue;
    }

    // 3. Paso 2: por cada dia, ordenes. Acumula los contratos de todos los dias del RUT.
    const contratosTarea = [];
    // Crudo del paso 2 por dia (para el envelope R2): la RESPUESTA JSON por dia, sin la URL/ticket.
    const ordenesPorDia: Record<string, unknown> = {};
    let bloqueado = false;
    for (const dia of tarea.dias) {
      let json: unknown;
      try {
        json = await conector.ordenesDeCompra(codigoEmpresa, dia, opts.ticket);
        ordenesPorDia[dia] = json;
      } catch (err) {
        if (err instanceof ChileCompraBloqueadaError) {
          bloqueado = true;
          log(`ingest-dinero: ${clave} dia ${dia} BLOQUEADA (HTTP ${err.status}) -> degradacion`);
          degradaciones.push({
            fuente: `${clave}#${dia}`,
            motivo: `ChileCompra bloqueo el fetch (HTTP ${err.status}); dia omitido`,
          });
          break;
        }
        errores.push({ fuente: ORIGEN_DRIFT, clave: `${clave}#${dia}`, mensaje: redactarTicket(err instanceof Error ? err.message : String(err)) });
        continue;
      }
      try {
        const filas = parseContratos(json, {
          rutProveedor: tarea.rut,
          proveedorNombre: nombreProveedor,
          fechaCorte: hasta,
          enlace: "https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json",
        });
        contratosTarea.push(...filas);
      } catch (err) {
        // Forma inesperada del paso 2 -> cuarentena de ESE dia (no fabrica), no aborta el RUT.
        cuarentenados.push(`${tarea.rut}#${dia}`);
        log(`ingest-dinero: ${clave} dia ${dia} DRIFT ESTRUCTURAL -> CUARENTENA (0 filas)`);
        degradaciones.push({
          fuente: `${clave}#${dia}`,
          motivo: `drift estructural: ${err instanceof Error ? err.message : String(err)}; cuarentena (0 filas)`,
          cuarentena: true,
        });
      }
    }
    if (bloqueado && contratosTarea.length === 0) continue;

    // Etapa 1 R2 (LOCKED — "crudo PRIMERO en R2"): persiste el envelope POR-RUT content-addressed
    // ANTES del upsert a Supabase. Espeja tramitacion/ingest-run.ts:293-357 (adaptado al envelope
    // por-RUT de dinero — Pitfall 2). CR-01/T-70-02: si el `putImmutable` FALLA (no-412) NO se
    // escribe el derivado — un crudo que no quedo en R2 daria 404 en `--from-r2` y el derivado seria
    // IRRECONSTRUIBLE (viola la regla LOCKED de CLAUDE.md). El RUT se registra en `errores`
    // (mensaje redactado) y se OMITE la Etapa 2; re-correr lo recupera (upserts idempotentes). El
    // envelope guarda SOLO respuestas JSON crudas (Pitfall 3): NUNCA la URL con `&ticket=`.
    if (r2Store) {
      const envelope = { rut: tarea.rut, buscarProveedor: buscarJsonCrudo, ordenes: ordenesPorDia };
      const bytes = new TextEncoder().encode(JSON.stringify(envelope));
      const sha = await sha256Hex(bytes);
      const today = new Date().toISOString().slice(0, 10);
      let r2Path: string;
      let existed: boolean;
      try {
        ({ r2Path, existed } = await r2Store.putImmutable("dinero", tarea.rut, today, sha, "json", bytes));
      } catch (err) {
        // Etapa-1-primero es LOCKED: sin crudo en R2, NO escribimos el derivado. Redactar SIEMPRE.
        errores.push({
          fuente: ORIGEN_DRIFT,
          clave: `${clave}#r2-etapa1`,
          mensaje: redactarTicket(err instanceof Error ? err.message : String(err)),
        });
        log(
          redactarTicket(
            `ingest-dinero: ERROR Etapa 1 R2 ${clave} -> se OMITE la escritura a Supabase ` +
              `(idempotente al re-correr): ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        continue;
      }
      if (existed) {
        // 412 = el crudo ya existia = exito idempotente. Sin novedades -> skip Etapa 2.
        log(`[skip] sin novedades — dinero ${clave}`);
        continue;
      }
      log(`ingest-dinero: crudo en R2 -> ${r2Path}`);
      // Registro source_snapshot (FND-08/CRON-02): best-effort, no fatal.
      if (opts.snapshotWriter) {
        try {
          await opts.snapshotWriter.write({
            source: "chilecompra",
            resource: tarea.rut,
            cacheKey: sha,
            r2Path,
            contentHash: sha,
            fingerprint: sha.slice(0, 8),
            dateBucket: today,
            provenance: {
              source: "chilecompra",
              sourceUrl: "https://api.mercadopublico.cl/servicios/v1",
              fetchedAt: new Date().toISOString(),
            },
          });
        } catch (snErr) {
          log(`ingest-dinero: source_snapshot fallo (no fatal): ${redactarTicket((snErr as Error).message)}`);
        }
      }
    }

    // 4. Reconcilia RUT-exacto + escribe (sub-maestra + contratos) + acumula marcados.
    try {
      const { contratos: filas, parlamentariosConfirmados } = await reconciliarContrato(
        contratosTarea,
        opts.maestra,
        opts.reconciliar ?? {},
      );
      // Sub-maestra: una fila de contratista por RUT consultado (el sujeto). Solo si hubo ordenes.
      if (filas.length > 0) {
        // Δ3: el FK a entidad_tercero resuelto para ESTE proveedor (uniforme en sus ordenes — mismo
        // RUT/nombre/tipo → misma resolucion). Se aplana el branded a string|null para el storage.
        const entidadResuelta = filas.find((f) => f.entidadId != null)?.entidadId ?? null;
        const sub: Contratista = {
          rutProveedor: normRut(tarea.rut),
          nombre: nombreProveedor,
          codigoEmpresa,
          tipoPersona: tipoPersona(tarea.rut),
          entidadId: entidadResuelta?.entidadTerceroId ?? null,
          origen: ORIGEN_DINERO,
          fecha_captura: new Date().toISOString(),
          enlace: "https://api.mercadopublico.cl/servicios/v1/Publico/Empresas/BuscarProveedor",
          licencia: LICENCIA_DINERO,
        };
        await opts.writer.upsertContratistas([sub]);
        contratistas += 1;
      }
      await opts.writer.upsertContratos(filas);
      contratos += filas.length;
      for (const id of parlamentariosConfirmados) marcados.add(id);
      // Aunque haya 0 contratos, marcar a los parlamentarios de este RUT como "consultados".
      marcarSinContratos(marcados, tarea, opts.maestra, opts.reconciliar);
      log(`ingest-dinero: ${clave} -> ${filas.length} contratos`);
    } catch (err) {
      errores.push({ fuente: ORIGEN_DRIFT, clave, mensaje: redactarTicket(err instanceof Error ? err.message : String(err)) });
    }
  }

  // Marca a los parlamentarios tocados (un row por id) para el marcador de "no consultado".
  if (marcados.size > 0) {
    await opts.writer.marcarIngestado([...marcados], hasta);
  }

  return {
    contratos,
    contratistas,
    parlamentariosMarcados: marcados.size,
    cuarentenados,
    errores,
    degradaciones,
  };
}

/**
 * Marca a los parlamentarios cuyo RUT interno coincide con el RUT consultado como "consultados"
 * (estado honesto: "consultado sin contratos" si no hubo filas). Solo agrega si hay match RUT-exacto
 * unico — sin RUT interno (IDENT-10) no marca a nadie (el parlamentario queda "no consultado").
 *
 * WR-04: REUSA el primitivo canonico `matchDeterminista` (rama RUT) en vez de re-implementar la
 * comparacion de RUT inline. Asi la guarda de match es SINGLE-SOURCED con `reconciliarContrato`:
 * si la regla de match se endurece (p.ej. gating extra por camara/periodo), este sitio NO drifta.
 * `nombreNormalizado: ""` impide cualquier rama por nombre; solo `confirmado+rut` cuenta. Honra
 * `opts` (camara/periodo del blocking) para alinearse EXACTAMENTE con el reconciliador.
 */
function marcarSinContratos(
  marcados: Set<string>,
  tarea: TareaRut,
  maestra: Parlamentario[],
  opts: ReconciliarContratoOpts | undefined,
): void {
  if (!isRutValido(tarea.rut)) return;
  const res = matchDeterminista(
    {
      rut: normRut(tarea.rut),
      nombreNormalizado: "", // NUNCA por nombre: solo la rama RUT puede confirmar (Pitfall 4).
      camara: opts?.camara ?? CAMARA_DINERO_DEFAULT,
      periodo: opts?.periodo ?? PERIODO_DINERO_DEFAULT,
    },
    maestra,
  );
  if (res.estado === "confirmado" && res.metodo === "rut") marcados.add(res.id);
}
