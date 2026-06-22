// parse-infoprobidad — parser zod del SPARQL-JSON de InfoProbidad → `Declaracion[]` VERSIONADAS.
//
// LITERAL, SIN modelo de lenguaje: el contenido es RDF estructurado; cada campo se copia VERBATIM
// como string. Ningún paquete de modelos se importa aquí (assertion en el test: el árbol de
// imports del parser/sparql/model no contiene un import del paquete de modelos de lenguaje).
//
// Estructura del SPARQL-JSON (verificada LIVE 2026-06-19 contra datos.cplt.cl/sparql): un
// documento `{ head, results: { bindings: [...] } }` donde cada binding lleva las columnas de la
// declaración (`decl`=URI del nodo, `fecha`, `declaranteLabel`, `tipoLabel`, `cargo`, `organismo`)
// y, en la proyección ancha del conector, las columnas OPCIONALES de UN bien/familiar de esa
// versión. El parser AGRUPA por (`fuenteId`=decl URI, `fechaPresentacion`) → una `Declaracion` por
// versión; acumula los bienes/familiares distintos de las filas del grupo. Un grupo cuya fila no
// valida con `DeclaracionSchema` (p.ej. sin fecha) se descarta y se registra (drift) — NUNCA fabrica.
//
// CLAVE DE VERSIÓN (Pitfall 1, INT-04): dos fechas distintas del mismo declarante → dos versiones.

import {
  DeclaracionSchema,
  ORIGEN_PROBIDAD,
  LICENCIA_PROBIDAD,
  type Declaracion,
  type Bienes,
  type BienInmueble,
  type BienMueble,
  type Actividad,
  type Pasivo,
  type AccionDerecho,
  type Valor,
  type DeclaracionFamiliar,
} from "./model";
import { bindingsToRows, fechaPresentacionDe, type FilaSparql } from "./sparql";

/** Acumulador mutable de una versión de declaración en construcción (un grupo de bindings). */
interface VersionEnConstruccion {
  fuenteId: string;
  fechaPresentacion: string;
  tipo: string | null;
  cargo: string | null;
  organismo: string | null;
  declaranteNombre: string;
  inmuebles: Map<string, BienInmueble>;
  muebles: Map<string, BienMueble>;
  actividades: Map<string, Actividad>;
  pasivos: Map<string, Pasivo>;
  accionesDerechos: Map<string, AccionDerecho>;
  valores: Map<string, Valor>;
  familiares: Map<string, DeclaracionFamiliar>;
}

const orNull = (v: string | undefined): string | null => (v != null && v !== "" ? v : null);

/** ¿Alguna columna de la fila tiene un valor de bien inmueble? */
function inmuebleDe(f: FilaSparql): BienInmueble | null {
  const props = [f.binmUbicadoEn, f.binmRolAvaluo, f.binmNumInscripcion, f.binmFojas, f.binmAnio, f.binmEsSuDomicilio];
  if (props.every((p) => p == null || p === "")) return null;
  return {
    ubicadoEn: orNull(f.binmUbicadoEn),
    rolAvaluo: orNull(f.binmRolAvaluo),
    numInscripcion: orNull(f.binmNumInscripcion),
    fojas: orNull(f.binmFojas),
    anio: orNull(f.binmAnio),
    esSuDomicilio: orNull(f.binmEsSuDomicilio),
  };
}

function muebleDe(f: FilaSparql): BienMueble | null {
  const props = [f.bmueNombre, f.bmueDescripcion, f.bmueModelo, f.bmueAnioFabricacion, f.bmueMatricula, f.bmueNumeroInscripcion, f.bmueAnioInscripcion, f.bmueTonelaje];
  if (props.every((p) => p == null || p === "")) return null;
  return {
    nombre: orNull(f.bmueNombre),
    descripcion: orNull(f.bmueDescripcion),
    modelo: orNull(f.bmueModelo),
    anioFabricacion: orNull(f.bmueAnioFabricacion),
    matricula: orNull(f.bmueMatricula),
    numeroInscripcion: orNull(f.bmueNumeroInscripcion),
    anioInscripcion: orNull(f.bmueAnioInscripcion),
    tonelaje: orNull(f.bmueTonelaje),
  };
}

function actividadDe(f: FilaSparql): Actividad | null {
  const props = [f.actObjeto, f.actVinculo, f.actRemunerado, f.actHaceDoceMeses];
  if (props.every((p) => p == null || p === "")) return null;
  return {
    objeto: orNull(f.actObjeto),
    vinculo: orNull(f.actVinculo),
    remunerado: orNull(f.actRemunerado),
    haceDoceMeses: orNull(f.actHaceDoceMeses),
  };
}

function pasivoDe(f: FilaSparql): Pasivo | null {
  const props = [f.pasTipoObligacion, f.pasAcreedor, f.pasMontoDeuda];
  if (props.every((p) => p == null || p === "")) return null;
  return {
    tipoObligacion: orNull(f.pasTipoObligacion),
    acreedor: orNull(f.pasAcreedor),
    montoDeuda: orNull(f.pasMontoDeuda),
  };
}

function accionDerechoDe(f: FilaSparql): AccionDerecho | null {
  const props = [f.accRutJuridica, f.accCantidadAcciones, f.accFechaAdquisicion, f.accEsControlador, f.accGravamenes];
  if (props.every((p) => p == null || p === "")) return null;
  return {
    rutJuridica: orNull(f.accRutJuridica),
    cantidadAcciones: orNull(f.accCantidadAcciones),
    fechaAdquisicion: orNull(f.accFechaAdquisicion),
    esControlador: orNull(f.accEsControlador),
    gravamenes: orNull(f.accGravamenes),
  };
}

function valorDe(f: FilaSparql): Valor | null {
  const props = [f.valEntidadEmisora, f.valTipoAccionDerecho, f.valCantidadRepresenta, f.valValorPlaza, f.valPaisQueEmite, f.valFechaAdquisicion, f.valTipoGravamen];
  if (props.every((p) => p == null || p === "")) return null;
  return {
    entidadEmisora: orNull(f.valEntidadEmisora),
    tipoAccionDerecho: orNull(f.valTipoAccionDerecho),
    cantidadRepresenta: orNull(f.valCantidadRepresenta),
    valorPlaza: orNull(f.valValorPlaza),
    paisQueEmite: orNull(f.valPaisQueEmite),
    fechaAdquisicion: orNull(f.valFechaAdquisicion),
    tipoGravamen: orNull(f.valTipoGravamen),
  };
}

function familiarDe(f: FilaSparql): DeclaracionFamiliar | null {
  const rel = orNull(f.famRelacion);
  const nombre = orNull(f.famNombre);
  if (rel == null && nombre == null) return null;
  return { relacion: rel, nombre };
}

/** Clave de dedupe estable de un objeto literal (orden de propiedades fijo por construcción). */
function claveDe(obj: Record<string, string | null>): string {
  return Object.values(obj)
    .map((v) => v ?? "∅")
    .join("∣");
}

function bienesDe(v: VersionEnConstruccion): Bienes {
  return {
    inmuebles: [...v.inmuebles.values()],
    muebles: [...v.muebles.values()],
    actividades: [...v.actividades.values()],
    pasivos: [...v.pasivos.values()],
    accionesDerechos: [...v.accionesDerechos.values()],
    valores: [...v.valores.values()],
  };
}

export interface ParseDeclaracionesOpts {
  /** Enlace base de la fuente (fallback de procedencia); si falta, la URI del nodo declaración. */
  enlace?: string;
  /** Momento de captura ISO (procedencia determinista en tests). */
  fechaCaptura?: string;
}

/**
 * Parsea un documento SPARQL-JSON de InfoProbidad → `Declaracion[]` VERSIONADAS keyed por
 * (`fuenteId`, `fechaPresentacion`). LITERAL (zod, sin LLM). Descarta+registra el grupo que no
 * valida (drift); NUNCA fabrica.
 */
export function parseDeclaraciones(json: unknown, opts: ParseDeclaracionesOpts = {}): Declaracion[] {
  const fechaCaptura = opts.fechaCaptura ?? new Date().toISOString();
  const filas = bindingsToRows(json);

  const grupos = new Map<string, VersionEnConstruccion>();
  for (const f of filas) {
    const fuenteId = f.decl;
    const fechaPresentacion = fechaPresentacionDe(f.fecha);
    // Sin URI de nodo o sin fecha parseable → no es una versión válida: se omite (drift).
    if (!fuenteId || !fechaPresentacion) {
      console.warn(
        `[parse-infoprobidad] fila descartada (drift: decl="${f.decl ?? ""}" fecha="${f.fecha ?? ""}")`,
      );
      continue;
    }
    const clave = `${fuenteId}∥${fechaPresentacion}`;
    let g = grupos.get(clave);
    if (!g) {
      g = {
        fuenteId,
        fechaPresentacion,
        tipo: orNull(f.tipoLabel) ?? orNull(f.tipo) ?? null,
        // Prefiere el rdfs:label legible (p.ej. "DIPUTADO/DA", "CONTRALORÍA GENERAL…") sobre la URI
        // cruda del nodo — sin esto la ficha mostraba `http://datos.cplt.cl/.../cargo_4134` al ciudadano.
        cargo: orNull(f.cargoLabel) ?? orNull(f.cargo),
        organismo: orNull(f.organismoLabel) ?? orNull(f.organismo),
        declaranteNombre: f.declaranteLabel ?? "",
        inmuebles: new Map(),
        muebles: new Map(),
        actividades: new Map(),
        pasivos: new Map(),
        accionesDerechos: new Map(),
        valores: new Map(),
        familiares: new Map(),
      };
      grupos.set(clave, g);
    }
    // Acumula los hijos distintos de esta fila (proyección ancha → un hijo por fila típicamente).
    const inm = inmuebleDe(f);
    if (inm) g.inmuebles.set(claveDe(inm), inm);
    const mue = muebleDe(f);
    if (mue) g.muebles.set(claveDe(mue), mue);
    const act = actividadDe(f);
    if (act) g.actividades.set(claveDe(act), act);
    const pas = pasivoDe(f);
    if (pas) g.pasivos.set(claveDe(pas), pas);
    const acc = accionDerechoDe(f);
    if (acc) g.accionesDerechos.set(claveDe(acc), acc);
    const val = valorDe(f);
    if (val) g.valores.set(claveDe(val), val);
    const fam = familiarDe(f);
    if (fam) g.familiares.set(claveDe(fam as unknown as Record<string, string | null>), fam);
  }

  const out: Declaracion[] = [];
  for (const g of grupos.values()) {
    const candidata: Declaracion = {
      fuenteId: g.fuenteId,
      fechaPresentacion: g.fechaPresentacion,
      tipo: g.tipo,
      cargo: g.cargo,
      organismo: g.organismo,
      declaranteNombre: g.declaranteNombre,
      bienes: bienesDe(g),
      familiares: [...g.familiares.values()],
      origen: ORIGEN_PROBIDAD,
      fecha_captura: fechaCaptura,
      enlace: opts.enlace ?? g.fuenteId,
      licencia: LICENCIA_PROBIDAD,
    };
    const parsed = DeclaracionSchema.safeParse(candidata);
    if (!parsed.success) {
      console.warn(
        `[parse-infoprobidad] declaración descartada (drift): "${g.fuenteId}"`,
        parsed.error.issues,
      );
      continue;
    }
    out.push(parsed.data as Declaracion);
  }
  // Orden estable por fecha DESC (la más reciente primero), luego por URI.
  out.sort((a, b) =>
    a.fechaPresentacion === b.fechaPresentacion
      ? a.fuenteId.localeCompare(b.fuenteId)
      : b.fechaPresentacion.localeCompare(a.fechaPresentacion),
  );
  return out;
}
