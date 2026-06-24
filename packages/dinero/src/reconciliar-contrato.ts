// reconciliar-contrato — cruce del PROVEEDOR de cada contrato contra la maestra de parlamentarios.
// Espeja la FORMA de salida de reconciliar-declarante (filas con FK branded `EnlaceConfirmado | null`
// + mencion cruda + estadoVinculo + set de confirmados); el matcher tiene DOS caminos segun el tipo
// de persona del proveedor (retrofit "finalidad del dato", aprobado por operador).
//
// REGLA (MONEY-02, retrofit FINALIDAD DEL DATO):
//   - PERSONA NATURAL: el enlace contrato->parlamentario es RUT-exacto determinista (el match mas
//     fuerte) O, sin match RUT-exacto, por NOMBRE via `correrPipeline` (@obs/adjudication), igual que
//     reconciliar-aporte.ts / reconciliar-sujeto.ts. SOLO un resultado determinista (nombre unico) o
//     humano-confirmado puebla el FK via `confirmar()` (IDENT-12); ambiguo -> null + cola humana
//     (fail-closed). El enlace es CONFIRMADO-POR-NOMBRE: prueba que el contrato esta asociado a alguien
//     confirmado por nombre como este parlamentario (la feature de fiscalizacion), NO que el RUT del
//     proveedor SEA el RUT del parlamentario.
//   - COSECHA DE RUT (CR-01, IDENT-10) — name-match != RUT-ownership: un determinista por NOMBRE solo
//     prueba que el NOMBRE del proveedor es unico en (camara, periodo); NO prueba que su `rutProveedor`
//     pertenezca a ese parlamentario (`isRutValido` solo prueba modulo-11, no propiedad). Por eso esta
//     ruta JAMAS escribe el `rut` de la maestra desde un match-por-nombre. Solo hay DOS salidas:
//       (a) CORROBORACION: si la maestra YA tiene un `rut` y `== normRut(rutProveedor)`, se emite un
//           `CandidatoCosechaRut` (canal de escritura) — es un no-op de confirmacion del RUT ya presente,
//           el unico caso donde la igualdad RUT-parlamentario esta realmente establecida.
//       (b) CANDIDATO A REVISION HUMANA: si la maestra NO tiene `rut` (o difiere), el RUT derivado del
//           nombre es un CANDIDATO (Track A "fragil": un RUT matcheado por NOMBRE no es un HECHO) que se
//           ENCOLA a revision humana (`enqueueRevision` del mismo writer del pipeline). Un humano debe
//           confirmar "proveedor X con RUT Y ES el parlamentario Z" ANTES de cualquier escritura al
//           master. Hasta esa confirmacion humana, el `rut` de la maestra NUNCA se muta por esta ruta.
//   - PERSONA JURIDICA: SIGUE RUT-exacto-only; una empresa NUNCA se name-linkea a un parlamentario
//     (la empresa no es el parlamentario). Nunca llama `correrPipeline`, nunca emite cosecha ni revision.
//   - DATA-ROUTING: solo el `proveedorNombre` (persona natural) llega a `correrPipeline`/LLM; el
//     `rutProveedor` (ni ningun RUT) JAMAS toca el pipeline/prompt (el gate `assertNoRutInLlmInput`
//     vive DENTRO de `correrPipeline`; aqui basta con no rutear el RUT).
//
// SUPERSEDE EXPLICITO: esto reemplaza la REGLA LOCKED previa ("RUT-exacto, nunca por nombre" en forma
// absoluta) SOLO para PERSONA NATURAL, por decision de operador "finalidad del dato" (enlazar un
// funcionario publico usa el pipeline confirmado/auditado). PERSONA JURIDICA conserva la regla
// original RUT-exacto-only.
//
// Casos de RUT (intactos): RUT invalido (DV modulo-11) -> CUARENTENA (enlace null, nunca confirmado,
// nunca fabrica). RUT valido + match exacto unico -> `confirmar(id,"determinista")`, "confirmado".
//
// La escritura del RUT cosechado (canal CORROBORACION) a la maestra remota es checkpoint de operador
// (ver harvest-rut.ts). Los CANDIDATOS A REVISION (name-only) NUNCA tocan ese writer: van a la cola humana.
// `provider`/`writer` son inyectables (mock/espia en tests, MiniMax + RevisionWriter reales en LIVE)
// con defaults seguros: sin provider, un proveedor persona-natural homonimo degrada a no_confirmado
// (fail-closed); un determinista resuelve igual (correrPipeline corta antes del LLM). Async, idempotente,
// pura (sin red/DB en lo que respecta a la maestra).

import type { Parlamentario } from "@obs/core";
import { normalizarNombre } from "@obs/core";
import { isRutValido, normRut, matchDeterminista } from "@obs/identity";
import { confirmar, type EnlaceConfirmado } from "@obs/identity";
import {
  matchDeterministaEntidad,
  confirmarEntidad,
  type EnlaceEntidadConfirmado,
  type EntidadTerceroRow,
  type TipoEntidad,
} from "@obs/identity";
import {
  correrPipeline,
  type PipelineWriter,
  type MencionForanea,
  type CasoRevision,
} from "@obs/adjudication";

import type { Contrato } from "./model";

// El provider LLM se tipa derivando de la firma de `correrPipeline` (3.er parametro), evitando un
// edge directo a `@obs/llm` (como hacen reconciliar-aporte / reconciliar-sujeto).
type LLMProvider = Parameters<typeof correrPipeline>[2];

/** Periodo del blocking del matcher determinista por defecto. Sobreescribible por opts. */
const PERIODO_DINERO_DEFAULT = "senado-vigente-2026";

/** Camara del blocking del matcher determinista por defecto. */
const CAMARA_DINERO_DEFAULT: Parlamentario["camara"] = "senado";

/** Writer no-op: descarta toda escritura del pipeline (cuando el caller no inyecta uno). */
const NOOP_WRITER: PipelineWriter = {
  async upsertVinculo() {
    return null;
  },
  async appendAudit() {
    /* descarta */
  },
  async enqueueRevision() {
    /* descarta */
  },
};

/**
 * Provider que LANZA si se invoca: fuerza fail-closed cuando no se inyecto uno real y un proveedor
 * persona-natural homonimo llegaria al LLM. Los deterministas NUNCA lo tocan (0 llamadas).
 */
const PROVIDER_AUSENTE: LLMProvider = {
  id: "sin-provider",
  trainsOnInputs: false,
  async complete() {
    throw new Error(
      "reconciliarContrato: se requiere un provider LLM para resolver un proveedor persona-natural ambiguo (homonimo)",
    );
  },
};

/**
 * Estado del vinculo de un contrato:
 *  - "confirmado": RUT-exacto unico O nombre persona-natural determinista contra la maestra (FK poblado).
 *    OJO (CR-01): un confirmado-por-NOMBRE prueba que el contrato esta asociado a alguien confirmado por
 *    NOMBRE como este parlamentario; NO prueba que el `rutProveedor` sea el RUT del parlamentario (esa
 *    adjudicacion RUT<->persona es separada y, name-only, requiere confirmacion humana).
 *  - "no_confirmado": RUT valido sin match exacto unico ni nombre determinista (incluye IDENT-10 / 0 / 2+ / juridica).
 *  - "cuarentena": RUT del proveedor invalido (DV malo) — nunca una fila confirmada.
 */
export type EstadoVinculoContrato = "confirmado" | "no_confirmado" | "cuarentena";

/**
 * Candidato de cosecha de RUT (IDENT-10) — CANAL DE CORROBORACION (CR-01): el unico caso donde la
 * igualdad RUT-proveedor == RUT-parlamentario esta REALMENTE establecida es cuando la maestra YA tiene
 * un `rut` y este coincide con `normRut(rutProveedor)`. Entonces la "cosecha" es un no-op de confirmacion
 * del RUT ya presente (la escritura remota re-escribe el mismo valor + provenance). NUNCA mintea un RUT
 * NUEVO desde un match-por-nombre: un namesake-collision (proveedor privado homonimo) NO llega aqui
 * porque su `rutProveedor` no coincide con el (posiblemente vacio) `rut` de la maestra. La escritura
 * remota es checkpoint de operador.
 */
export interface CandidatoCosechaRut {
  /** Id de la maestra (PK estable) cuyo `rut` se corrobora. */
  parlamentarioId: string;
  /** RUT del proveedor DV-valido + normalizado (== el RUT ya presente en la maestra). */
  rutHarvested: string;
  /** Provenance OBLIGATORIA (backfill-rut exige NOT NULL): de donde salio el RUT corroborado. */
  provenance: { origen: string; fecha_captura: string; enlace: string };
}

/**
 * Candidato a REVISION HUMANA de un RUT derivado por NOMBRE (CR-01) — CANAL DE ADJUDICACION, NO de
 * escritura. Un determinista por NOMBRE confirma el ENLACE contrato->parlamentario, pero el
 * `rutProveedor` derivado es un CANDIDATO (Track A "fragil": name-uniqueness != RUT-ownership), NO un
 * hecho. Se encola para que un humano confirme "proveedor X con RUT Y ES el parlamentario Z" ANTES de
 * cualquier escritura al `rut` de la maestra. ESTRUCTURALMENTE este candidato NO puede escribir el
 * master: viaja por `enqueueRevision` (cola humana), nunca por `runBackfillRut`/`updateRut`.
 *
 * MINIMIZACION: el `rutProveedor` (PII, RUT) NUNCA se incrusta en el texto que va al LLM; aqui viaja
 * en el `motivo`/`salida_modelo` de la cola humana interna (no es un prompt al modelo), coherente con
 * que la adjudicacion del RUT la hace una PERSONA, no el LLM.
 */
export interface CandidatoRevisionRut {
  /** Id de la maestra (PK estable) propuesto por el match-por-nombre (a confirmar por humano). */
  parlamentarioId: string;
  /** RUT del proveedor DV-valido + normalizado, propuesto como candidato (NO escrito al master). */
  rutCandidato: string;
  /** Nombre del proveedor que motivo el match (para que el humano juzgue el binding nombre<->RUT). */
  proveedorNombre: string;
  /** Provenance del candidato (de donde salio el RUT propuesto). */
  provenance: { origen: string; fecha_captura: string; enlace: string };
}

/**
 * Contrato listo para el writer: la raiz con el FK branded `EnlaceConfirmado | null` + la mencion
 * cruda del proveedor + el estadoVinculo. El writer aplana al storage plano
 * (`parlamentario_id: string | null`).
 */
export interface ContratoParaEscribir {
  /** Clave de version: el codigo de la orden de compra. */
  fuenteId: string;
  /** Clave de version: la fecha de corte de la ingesta. */
  fechaCorte: string;
  codigoOrden: string;
  /** FK branded del proveedor->parlamentario: minteado SOLO en determinista (string crudo no compila). */
  enlace: EnlaceConfirmado | null;
  /**
   * FK branded del proveedor->entidad_tercero (Δ3, ENT-03): minteado SOLO con un match confirmado
   * contra la maestra de TERCEROS (juridica por RUT exacto; natural por RUT o nombre). null si no
   * confirma o sin maestra inyectada. SEPARADO del `enlace` a parlamentario (fiscalizacion). Un string
   * crudo NO compila. Storage plano (string|null) lo aplana el writer.
   */
  entidadId: EnlaceEntidadConfirmado | null;
  /** RUT del proveedor consultado (keyea la sub-maestra). */
  rutProveedor: string;
  /** Mencion cruda del proveedor (nombre), preservada incluso sin enlace. */
  mencionProveedor: string | null;
  estadoVinculo: EstadoVinculoContrato;
  tipoPersona: Contrato["tipoPersona"];
  organismo: string | null;
  /** Nombre/descripcion crudo de la orden (texto libre), o null. NUNCA un monto (CR-02). */
  nombreOrden: string | null;
  monto: string | null;
  fechaOc: string | null;
  origen: string;
  fecha_captura: string;
  enlace_url: string;
  licencia: string;
}

/** Opciones de reconciliacion (provider/writer/periodo/camara inyectables, defaults seguros). */
export interface ReconciliarContratoOpts {
  /** Provider LLM; no se invoca para los proveedores que resuelven deterministicamente ni para juridica. */
  provider?: LLMProvider;
  /** Writer del pipeline (cola/vinculo/audit). */
  writer?: PipelineWriter;
  /** Periodo del blocking. Default `PERIODO_DINERO_DEFAULT`. */
  periodo?: string;
  /** Camara del blocking. Default `CAMARA_DINERO_DEFAULT`. */
  camara?: Parlamentario["camara"];
  /**
   * Maestra de TERCEROS (`entidad_tercero`) contra la que se resuelve el proveedor para poblar
   * `entidadId` (Δ3). Si se omite, NINGUN proveedor resuelve (`entidadId: null`) — degradacion
   * honesta. SEPARADA de la maestra de parlamentarios (la fiscalizacion no cambia).
   */
  maestraEntidad?: EntidadTerceroRow[];
}

/** Resultado: filas para-escribir + el set de FKs confirmados + cosechas (corroboracion) + revisiones. */
export interface ResultadoReconciliacionDinero {
  contratos: ContratoParaEscribir[];
  /** Ids de parlamentarios con FK confirmado en esta corrida. */
  parlamentariosConfirmados: string[];
  /** Codigos de orden cuyo RUT de proveedor fue invalido (cuarentena). */
  cuarentenados: string[];
  /**
   * Candidatos de cosecha de RUT — CANAL DE CORROBORACION (CR-01): SOLO cuando la maestra ya tenia un
   * `rut` que coincide con el `rutProveedor` (no-op de confirmacion). NUNCA un RUT nuevo derivado por
   * nombre.
   */
  cosechas: CandidatoCosechaRut[];
  /**
   * Candidatos a REVISION HUMANA de RUT (CR-01): RUTs derivados por NOMBRE (sin coincidencia con un
   * `rut` ya presente) que requieren confirmacion humana del binding nombre<->RUT antes de cualquier
   * escritura al master. Tambien se encolaron via `enqueueRevision` del writer del pipeline.
   */
  revisionesRut: CandidatoRevisionRut[];
}

/**
 * Etiqueta de provenance de un RUT por trust-level (WR-02: el trust viaja con el dato, no solo en un
 * comentario). CORROBORADO = el RUT ya estaba en la maestra y coincide (hecho fuerte). El canal de
 * revision usa su propia etiqueta de "name-only" (ver `ORIGEN_REVISION_RUT`).
 */
const ORIGEN_COSECHA = "harvest:chilecompra-persona-natural:rut-corroborado";

/**
 * Etiqueta del candidato a revision humana (WR-02): RUT derivado por NOMBRE, pendiente de confirmacion
 * humana del binding nombre<->RUT. NO es un hecho; NO escribe el master.
 */
const ORIGEN_REVISION_RUT = "harvest:chilecompra-persona-natural:rut-name-only-pendiente-humano";

/**
 * Reconcilia el proveedor de cada contrato contra la maestra. PERSONA NATURAL: RUT-exacto determinista
 * O nombre via `correrPipeline` (solo determinista mintea el FK; ambiguo -> null + cola humana). En un
 * match persona-natural confirmado el `rutProveedor` DV-valido se trata segun CR-01: si la maestra YA
 * tiene un `rut` que coincide -> candidato de COSECHA (corroboracion); si no coincide / esta vacio ->
 * candidato a REVISION HUMANA (encolado, NUNCA escribe el master). PERSONA JURIDICA: RUT-exacto-only
 * (nunca name-linkea). RUT invalido -> cuarentena. El `rutProveedor` NUNCA toca el pipeline/LLM.
 * Async, idempotente y pura (sin escritura a la maestra aqui).
 */
export async function reconciliarContrato(
  contratos: Contrato[],
  maestra: Parlamentario[],
  opts: ReconciliarContratoOpts = {},
): Promise<ResultadoReconciliacionDinero> {
  const provider = opts.provider ?? PROVIDER_AUSENTE;
  const writer = opts.writer ?? NOOP_WRITER;
  const periodo = opts.periodo ?? PERIODO_DINERO_DEFAULT;
  const camara = opts.camara ?? CAMARA_DINERO_DEFAULT;
  // Sin provider real inyectado, un proveedor persona-natural homonimo que llegue al LLM NO debe
  // ABORTAR la corrida: degrada ESE contrato a `no_confirmado` (fail-closed, NUNCA fabrica). Los
  // deterministas resuelven igual (correrPipeline corta antes del LLM, 0 llamadas).
  const proveedorAusente = opts.provider === undefined;

  const out: ContratoParaEscribir[] = [];
  const confirmados = new Set<string>();
  const cuarentenados: string[] = [];
  const cosechas: CandidatoCosechaRut[] = [];
  const revisionesRut: CandidatoRevisionRut[] = [];

  const maestraEntidad = opts.maestraEntidad ?? [];

  for (const c of contratos) {
    let enlace: EnlaceConfirmado | null = null;
    let estadoVinculo: EstadoVinculoContrato;

    // Δ3 (ENT-03): resolver el proveedor contra la maestra de TERCEROS para poblar `entidadId`. Es
    // INDEPENDIENTE de la reconciliacion contra parlamentario (fiscalizacion): se calcula una sola vez
    // por contrato y viaja a la fila en CUALQUIER rama. DATA-ROUTING: el RUT crudo SOLO alimenta el
    // matcher determinista interno (matchDeterministaEntidad); NUNCA cruza al LLM ni al jsonb de revision_*.
    const entidadId = resolverEntidadProveedor(c, maestraEntidad);

    // 1. RUT invalido (DV modulo-11) -> CUARENTENA: enlace null, nunca confirmado, nunca fabrica.
    if (!isRutValido(c.rutProveedor)) {
      estadoVinculo = "cuarentena";
      cuarentenados.push(c.codigoOrden);
      out.push(filaParaEscribir(c, enlace, estadoVinculo, entidadId));
      continue;
    }

    // 2. RUT valido -> matchDeterminista rama RUT (INTACTO). SOLO confirmado+rut mintea el enlace.
    //    Este camino NO emite cosecha (el RUT interno YA estaba poblado; no hay nada que cosechar).
    const res = matchDeterminista(
      { rut: normRut(c.rutProveedor), nombreNormalizado: "", camara, periodo },
      maestra,
    );
    if (res.estado === "confirmado" && res.metodo === "rut") {
      enlace = confirmar(res.id, "determinista");
      estadoVinculo = "confirmado";
      confirmados.add(res.id);
      out.push(filaParaEscribir(c, enlace, estadoVinculo, entidadId));
      continue;
    }

    // 3. Sin match RUT-exacto y RUT valido -> ramificar por tipo de persona.
    const proveedorNombre = c.proveedorNombre?.trim() ?? "";
    if (c.tipoPersona !== "natural" || proveedorNombre.length === 0) {
      // PERSONA JURIDICA (o nombre vacio): NUNCA name-linkea -> enlace null + mencion cruda. Sin pipeline.
      estadoVinculo = "no_confirmado";
      out.push(filaParaEscribir(c, enlace, estadoVinculo, entidadId));
      continue;
    }

    // FALLBACK PERSONA-NATURAL: cruce por NOMBRE via correrPipeline (espejo de reconciliarAporte).
    // DATA-ROUTING: SOLO el proveedorNombre arma la mencion. NINGUN campo de RUT entra.
    const { nombre_normalizado, tokens } = normalizarNombre({ libre: proveedorNombre });
    const mencion: MencionForanea = {
      nombreOriginal: proveedorNombre,
      nombreNormalizado: nombre_normalizado,
      tokens,
      camara,
      periodo,
      region: null,
    };
    let pres: Awaited<ReturnType<typeof correrPipeline>> | null = null;
    try {
      pres = await correrPipeline(mencion, maestra, provider, writer);
    } catch (err) {
      // Sin provider real, un homonimo llega al LLM ausente y lanza. Fail-closed honesto: se degrada
      // ESE contrato a `no_confirmado` (NUNCA se fabrica un enlace) y la corrida sigue.
      if (proveedorAusente) {
        out.push(filaParaEscribir(c, null, "no_confirmado", entidadId));
        continue;
      }
      // Con un provider real inyectado, un error del LLM SI propaga (no se enmascara).
      throw err;
    }

    // GUARDA LOCKED (IDENT-12): SOLO determinista mintea un EnlaceConfirmado y puebla el FK.
    switch (pres.tipo) {
      case "determinista": {
        // El ENLACE confirmado-por-nombre se mintea (feature de fiscalizacion). El RUT NO se cosecha
        // automaticamente desde un match-por-nombre (CR-01: name-uniqueness != RUT-ownership).
        enlace = confirmar(pres.parlamentarioId, "determinista");
        estadoVinculo = "confirmado";
        confirmados.add(pres.parlamentarioId);

        // WR-04: el RUT ya fue DV-validado en el paso 1 (DV-invalido -> `continue`) y no se reasigna,
        // asi que un `if (isRutValido(...))` aqui seria estructuralmente muerto. El guard que importa
        // (CR-01) es la PROPIEDAD del RUT, no su DV. Si un RUT DV-invalido llegara aqui es un bug ruidoso.
        const rutNorm = normRut(c.rutProveedor);
        if (!isRutValido(c.rutProveedor)) {
          throw new Error(
            `reconciliarContrato: invariante rota — RUT DV-invalido en la rama determinista (orden ${c.codigoOrden}); el paso 1 debio cuarentenarlo`,
          );
        }

        const pol = maestra.find((p) => p.id === pres!.parlamentarioId);
        const rutMaestra = pol?.rut != null && pol.rut.trim() !== "" ? normRut(pol.rut) : null;
        // WR-01: name-uniqueness GLOBAL (toda la maestra, ambas camaras / todos los periodos), no solo
        // dentro de la ventana de blocking. Un proveedor unico entre senadores pero homonimo de un
        // diputado NO es realmente unico -> retiene el enlace pero NO propone RUT (ni cosecha ni revision).
        const nombreGlobalUnico =
          maestra.filter((p) => p.nombre_normalizado === nombre_normalizado).length === 1;

        if (rutMaestra != null && rutMaestra === rutNorm) {
          // CANAL CORROBORACION (CR-01): la maestra YA tenia este RUT -> la igualdad RUT<->parlamentario
          // esta establecida. Cosechar es un no-op de confirmacion (re-escribe el mismo valor). Es el
          // UNICO camino que alimenta el writer de escritura (runBackfillRut) y NUNCA mintea un RUT nuevo.
          // Defensivo: en el caso comun de UN solo dueño del RUT, el paso 2 (RUT-exacto) ya confirmo antes
          // de llegar aqui; esta rama solo se activa en el borde donde el RUT-exacto fallo fail-closed
          // (2+ filas con el RUT) pero el nombre resolvio y el master ya contiene exactamente este RUT.
          // WR-03: provenance validada en emision (no se emite con provenance vacia -> no se pierde aguas abajo).
          if (provenanceCompleta(c)) {
            cosechas.push({
              parlamentarioId: pres.parlamentarioId,
              rutHarvested: rutNorm,
              provenance: {
                origen: ORIGEN_COSECHA,
                fecha_captura: c.fecha_captura,
                enlace: c.enlace,
              },
            });
          }
        } else if (nombreGlobalUnico) {
          // CANAL REVISION HUMANA (CR-01): RUT derivado por NOMBRE, sin coincidencia con un `rut` ya
          // presente. NO escribe el master. Se ENCOLA para adjudicacion humana del binding nombre<->RUT
          // y se reporta como candidato (canal estructuralmente separado del writer de escritura).
          // WR-03: solo se emite con provenance completa (un candidato sin provenance no se podria auditar).
          if (provenanceCompleta(c)) {
            const candidato: CandidatoRevisionRut = {
              parlamentarioId: pres.parlamentarioId,
              rutCandidato: rutNorm,
              proveedorNombre,
              provenance: {
                origen: ORIGEN_REVISION_RUT,
                fecha_captura: c.fecha_captura,
                enlace: c.enlace,
              },
            };
            revisionesRut.push(candidato);
            await encolarRevisionRut(writer, mencion, candidato);
          }
        }
        // else (homonimo global): enlace confirmado-por-nombre se mantiene, pero NO se propone RUT.
        break;
      }
      case "probable":
      case "revision":
      case "no_confirmado":
      default:
        // Ambiguo -> enlace null, cola humana (via el writer del pipeline), SIN cosecha (fail-closed).
        enlace = null;
        estadoVinculo = "no_confirmado";
        break;
    }

    out.push(filaParaEscribir(c, enlace, estadoVinculo, entidadId));
  }

  return {
    contratos: out,
    parlamentariosConfirmados: [...confirmados],
    cuarentenados,
    cosechas,
    revisionesRut,
  };
}

/** WR-03: provenance completa (no vacia) en emision, espejando el NOT NULL de `aceptarRutBackfill`. */
function provenanceCompleta(c: Contrato): boolean {
  return (
    typeof c.fecha_captura === "string" && c.fecha_captura.trim() !== "" &&
    typeof c.enlace === "string" && c.enlace.trim() !== ""
  );
}

/**
 * Encola a la COLA HUMANA un candidato a confirmacion de RUT (CR-01). Reusa `enqueueRevision` del
 * writer del pipeline (la misma maquinaria de adjudicacion humana).
 *
 * DATA-ROUTING (LOAD-BEARING): el RUT crudo NO se incrusta en el caso encolado (la tabla
 * `revision_identidad` esta sujeta a minimizacion — sus jsonb `candidatos`/`salida_modelo` jamas
 * llevan RUT). El RUT viaja SOLO en el array `revisionesRut` que devuelve `reconciliarContrato` (canal
 * de auditoria interno de @obs/dinero); el adjudicador humano une por `parlamentarioId` + provenance.
 * Asi el RUT nunca toca un canal LLM-adyacente ni un prompt. Best-effort: un fallo del writer no aborta
 * la corrida (el candidato ya quedo en `revisionesRut` para auditarse).
 */
async function encolarRevisionRut(
  writer: PipelineWriter,
  mencion: MencionForanea,
  candidato: CandidatoRevisionRut,
): Promise<void> {
  const caso: CasoRevision = {
    mencion_nombre: mencion.nombreOriginal,
    mencion_normalizada: mencion.nombreNormalizado,
    camara: mencion.camara,
    periodo: mencion.periodo,
    region: mencion.region,
    candidatos: [{ id: candidato.parlamentarioId, nombre: mencion.nombreOriginal }],
    salida_modelo: { tipo: "rut-name-only-candidato", origen: candidato.provenance.origen },
    modelo_version: "dinero:rut-harvest-cr01",
    estado: "pendiente",
    // SIN el RUT crudo (minimizacion): solo la instruccion de adjudicar el binding nombre<->RUT.
    motivo:
      `RUT candidato por NOMBRE (name-uniqueness != RUT-ownership): confirmar que el proveedor ` +
      `"${candidato.proveedorNombre}" ES el parlamentario ${candidato.parlamentarioId} ANTES de ` +
      `escribir el master rut (el RUT candidato viaja por el canal de auditoria de @obs/dinero, ` +
      `no por esta cola).`,
  };
  try {
    await writer.enqueueRevision(caso);
  } catch {
    /* best-effort: el candidato ya quedo en revisionesRut para auditoria; no abortar la corrida. */
  }
}

/**
 * Resuelve el proveedor contra la maestra de TERCEROS (`entidad_tercero`) para poblar `entidadId`
 * (Δ3, ENT-03). SEPARADO de la reconciliacion contra parlamentario (fiscalizacion). Fail-closed:
 * mintea el FK branded SOLO con un match confirmado. juridica → matchDeterministaEntidad por RUT
 * exacto (Δ2: una empresa NUNCA por nombre); natural → RUT o nombre-unico-por-tipo. Maestra vacia o
 * nombre vacio → null.
 *
 * DATA-ROUTING (LOAD-BEARING): el `rutProveedor` crudo SOLO entra al matcher determinista interno
 * (matchDeterministaEntidad opera sobre la maestra ya en memoria, SIN red/LLM). NUNCA cruza al
 * pipeline LLM ni al jsonb de revision_* — esos canales solo ven el nombre.
 */
function resolverEntidadProveedor(
  c: Contrato,
  maestraEntidad: EntidadTerceroRow[],
): EnlaceEntidadConfirmado | null {
  if (maestraEntidad.length === 0) {
    return null;
  }
  const nombre = c.proveedorNombre?.trim() ?? "";
  const tipoEntidad: TipoEntidad = c.tipoPersona === "natural" ? "natural" : "juridica";
  // Δ2: una juridica sin nombre util igual puede confirmar por RUT exacto; una natural sin nombre y
  // sin RUT en la maestra no resolveria. El matcher ya ramifica por tipo (juridica = solo RUT).
  const rut = c.rutProveedor?.trim() ?? "";
  const res = matchDeterministaEntidad(
    {
      nombreNormalizado: nombre.length > 0 ? normalizarNombre({ libre: nombre }).nombre_normalizado : "",
      tipoEntidad,
      ...(rut !== "" ? { rut } : {}),
    },
    maestraEntidad,
  );
  // GUARDA LOCKED (ENT-03): SOLO un match confirmado mintea el FK branded.
  return res.estado === "confirmado" ? confirmarEntidad(res.id, "determinista") : null;
}

/** Arma la fila para-escribir de un contrato (raiz + mencion cruda del proveedor + FK de tercero). */
function filaParaEscribir(
  c: Contrato,
  enlace: EnlaceConfirmado | null,
  estadoVinculo: EstadoVinculoContrato,
  entidadId: EnlaceEntidadConfirmado | null,
): ContratoParaEscribir {
  return {
    fuenteId: c.fuenteId,
    fechaCorte: c.fechaCorte,
    codigoOrden: c.codigoOrden,
    enlace,
    entidadId,
    rutProveedor: c.rutProveedor,
    mencionProveedor: c.proveedorNombre,
    estadoVinculo,
    tipoPersona: c.tipoPersona,
    organismo: c.organismo,
    nombreOrden: c.nombreOrden,
    monto: c.monto,
    fechaOc: c.fechaOc,
    origen: c.origen,
    fecha_captura: c.fecha_captura,
    enlace_url: c.enlace,
    licencia: c.licencia,
  };
}
