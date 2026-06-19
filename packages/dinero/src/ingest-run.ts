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
import { isRutValido, normRut } from "@obs/identity";
import type { Parlamentario } from "@obs/core";

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
    try {
      const json = await opts.conector.buscarProveedor(tarea.rut, opts.ticket);
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
        errores.push({ fuente: ORIGEN_DRIFT, clave, mensaje: err instanceof Error ? err.message : String(err) });
      }
      continue;
    }

    // 3. Paso 2: por cada dia, ordenes. Acumula los contratos de todos los dias del RUT.
    const contratosTarea = [];
    let bloqueado = false;
    for (const dia of tarea.dias) {
      let json: unknown;
      try {
        json = await opts.conector.ordenesDeCompra(codigoEmpresa, dia, opts.ticket);
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
        errores.push({ fuente: ORIGEN_DRIFT, clave: `${clave}#${dia}`, mensaje: err instanceof Error ? err.message : String(err) });
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

    // 4. Reconcilia RUT-exacto + escribe (sub-maestra + contratos) + acumula marcados.
    try {
      const { contratos: filas, parlamentariosConfirmados } = reconciliarContrato(
        contratosTarea,
        opts.maestra,
        opts.reconciliar ?? {},
      );
      // Sub-maestra: una fila de contratista por RUT consultado (el sujeto). Solo si hubo ordenes.
      if (filas.length > 0) {
        const sub: Contratista = {
          rutProveedor: normRut(tarea.rut),
          nombre: nombreProveedor,
          codigoEmpresa,
          tipoPersona: tipoPersona(tarea.rut),
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
      errores.push({ fuente: ORIGEN_DRIFT, clave, mensaje: err instanceof Error ? err.message : String(err) });
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
 */
function marcarSinContratos(
  marcados: Set<string>,
  tarea: TareaRut,
  maestra: Parlamentario[],
  _opts: ReconciliarContratoOpts | undefined,
): void {
  if (!isRutValido(tarea.rut)) return;
  const objetivo = normRut(tarea.rut);
  const porRut = maestra.filter((p) => p.rut != null && normRut(p.rut) === objetivo);
  if (porRut.length === 1) marcados.add(porRut[0]!.id);
}
