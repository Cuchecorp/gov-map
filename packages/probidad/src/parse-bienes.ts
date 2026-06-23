// parse-bienes — parsers zod del SPARQL-JSON de las queries BATCH de bienes → Map<fuenteId, T[]>.
//
// LITERAL, SIN modelo de lenguaje: el contenido es RDF estructurado; cada campo se copia VERBATIM
// como string. Cada query BATCH (sparql.ts) proyecta `?d` (URI de la declaración) + `?x` (nodo del
// bien) + los predicados de OQ2. El parser:
//   1. `bindingsToRows(json)` → filas planas.
//   2. agrupa las filas por `?x` (un bien físico puede aparecer en varias filas si un predicado es
//      multivaluado) → toma el PRIMER valor no-vacío por campo (orNull) → ensambla UN bien.
//   3. colecciona cada bien ensamblado bajo su `?d` (fuenteId de la declaración).
//   4. valida cada bien con su schema zod (safeParse); en fallo → warn + skip (drift, nunca fabrica).
//
// Devuelve `Map<fuenteId, T[]>`. Una fila sin `?d` o sin `?x` se descarta (no es un bien atado a una
// declaración). El orden de los biens dentro de cada lista sigue el primer avistamiento de su `?x`.

import {
  BienInmuebleSchema,
  BienMuebleSchema,
  ActividadSchema,
  PasivoSchema,
  AccionDerechoSchema,
  ValorSchema,
  type BienInmueble,
  type BienMueble,
  type Actividad,
  type Pasivo,
  type AccionDerecho,
  type Valor,
} from "./model";
import { bindingsToRows, type FilaSparql } from "./sparql";
import { orNull } from "./parse-infoprobidad";

import type { ZodType } from "zod";

/**
 * Núcleo genérico: agrupa las filas por (`?d`, `?x`), ensambla un objeto por cada `?x` tomando el
 * primer valor no-vacío de cada campo, lo valida con `schema` (safeParse; fallo → warn+skip) y lo
 * colecciona bajo su `?d`. `assemble(fila, acc)` rellena `acc` con orNull para cada campo presente.
 */
function parseBienesGenerico<T>(
  json: unknown,
  etiqueta: string,
  schema: ZodType<T>,
  campos: Array<keyof T & string>,
  mapaFila: (f: FilaSparql) => Partial<Record<keyof T & string, string | null>>,
): Map<string, T[]> {
  const filas = bindingsToRows(json);

  // (fuenteId, nodoBien) → acumulador de campos (primer valor no-vacío gana).
  const grupos = new Map<string, { d: string; x: string; acc: Partial<Record<string, string | null>> }>();
  // Mantiene el orden de aparición de cada `?x` por `?d`.
  const ordenPorD = new Map<string, string[]>();

  for (const f of filas) {
    const d = orNull(f.d);
    const x = orNull(f.x);
    // Sin URI de declaración o sin nodo de bien → no es un bien atado a una declaración (drift).
    if (d == null || x == null) continue;
    const clave = `${d}∥${x}`;
    let g = grupos.get(clave);
    if (!g) {
      g = { d, x, acc: {} };
      grupos.set(clave, g);
      const lista = ordenPorD.get(d) ?? [];
      lista.push(clave);
      ordenPorD.set(d, lista);
    }
    const parcial = mapaFila(f);
    for (const campo of campos) {
      // Primer valor no-vacío gana: no sobreescribe un valor ya fijado.
      if (g.acc[campo] == null) {
        const v = parcial[campo];
        if (v != null) g.acc[campo] = v;
      }
    }
  }

  const out = new Map<string, T[]>();
  for (const [d, claves] of ordenPorD) {
    const lista: T[] = [];
    for (const clave of claves) {
      const g = grupos.get(clave)!;
      const candidato: Record<string, string | null> = {};
      for (const campo of campos) candidato[campo] = g.acc[campo] ?? null;
      const parsed = schema.safeParse(candidato);
      if (!parsed.success) {
        console.warn(`[parse-bienes:${etiqueta}] bien descartado (drift) decl="${d}" nodo="${g.x}"`, parsed.error.issues);
        continue;
      }
      lista.push(parsed.data);
    }
    out.set(d, lista);
  }
  return out;
}

/** Parsea el SPARQL-JSON de `queryBienesInmueblesBatch` → Map<fuenteId, BienInmueble[]>. */
export function parseBienInmueble(json: unknown): Map<string, BienInmueble[]> {
  return parseBienesGenerico<BienInmueble>(
    json,
    "inmueble",
    BienInmuebleSchema,
    ["ubicadoEn", "rolAvaluo", "numInscripcion", "fojas", "anio", "esSuDomicilio"],
    (f) => ({
      ubicadoEn: orNull(f.ubicadoEn),
      rolAvaluo: orNull(f.rolAvaluo),
      numInscripcion: orNull(f.numInscripcion),
      fojas: orNull(f.fojasInmueble),
      anio: orNull(f.anioInmueble),
      esSuDomicilio: orNull(f.esSuDomicilio),
    }),
  );
}

/** Parsea el SPARQL-JSON de `queryBienesMueblesBatch` → Map<fuenteId, BienMueble[]>. */
export function parseBienMueble(json: unknown): Map<string, BienMueble[]> {
  return parseBienesGenerico<BienMueble>(
    json,
    "mueble",
    BienMuebleSchema,
    ["nombre", "descripcion", "modelo", "anioFabricacion", "matricula", "numeroInscripcion", "anioInscripcion", "tonelaje"],
    (f) => ({
      nombre: orNull(f.nombreMueble),
      descripcion: orNull(f.descripcion),
      modelo: orNull(f.modelo),
      anioFabricacion: orNull(f.anioFabricacion),
      matricula: orNull(f.matricula),
      numeroInscripcion: orNull(f.numeroInscripcion),
      anioInscripcion: orNull(f.anioInscripcion),
      tonelaje: orNull(f.tonelaje),
    }),
  );
}

/** Parsea el SPARQL-JSON de `queryActividadesBatch` → Map<fuenteId, Actividad[]>. */
export function parseActividad(json: unknown): Map<string, Actividad[]> {
  return parseBienesGenerico<Actividad>(
    json,
    "actividad",
    ActividadSchema,
    ["objeto", "vinculo", "remunerado", "haceDoceMeses"],
    (f) => ({
      objeto: orNull(f.objeto),
      vinculo: orNull(f.vinculo),
      remunerado: orNull(f.remunerado),
      haceDoceMeses: orNull(f.haceDoceMeses),
    }),
  );
}

/** Parsea el SPARQL-JSON de `queryPasivosBatch` → Map<fuenteId, Pasivo[]>. */
export function parsePasivo(json: unknown): Map<string, Pasivo[]> {
  return parseBienesGenerico<Pasivo>(
    json,
    "pasivo",
    PasivoSchema,
    ["tipoObligacion", "acreedor", "montoDeuda"],
    (f) => ({
      tipoObligacion: orNull(f.tipoObligacion),
      acreedor: orNull(f.acreedor),
      montoDeuda: orNull(f.montoDeuda),
    }),
  );
}

/** Parsea el SPARQL-JSON de `queryAccionesDerechosBatch` → Map<fuenteId, AccionDerecho[]>. */
export function parseAccionDerecho(json: unknown): Map<string, AccionDerecho[]> {
  return parseBienesGenerico<AccionDerecho>(
    json,
    "accionDerecho",
    AccionDerechoSchema,
    ["rutJuridica", "cantidadAcciones", "fechaAdquisicion", "esControlador", "gravamenes"],
    (f) => ({
      rutJuridica: orNull(f.rutJuridica),
      cantidadAcciones: orNull(f.cantidadAcciones),
      fechaAdquisicion: orNull(f.fechaAdquisicion),
      esControlador: orNull(f.esControlador),
      gravamenes: orNull(f.gravamenes),
    }),
  );
}

/** Parsea el SPARQL-JSON de `queryValoresBatch` → Map<fuenteId, Valor[]>. */
export function parseValor(json: unknown): Map<string, Valor[]> {
  return parseBienesGenerico<Valor>(
    json,
    "valor",
    ValorSchema,
    ["entidadEmisora", "tipoAccionDerecho", "cantidadRepresenta", "valorPlaza", "paisQueEmite", "fechaAdquisicion", "tipoGravamen"],
    (f) => ({
      entidadEmisora: orNull(f.entidadEmisora),
      tipoAccionDerecho: orNull(f.tipoAccionDerecho),
      cantidadRepresenta: orNull(f.cantidadRepresenta),
      valorPlaza: orNull(f.valorPlaza),
      paisQueEmite: orNull(f.paisQueEmite),
      fechaAdquisicion: orNull(f.fechaAdquisicion),
      tipoGravamen: orNull(f.tipoGravamen),
    }),
  );
}
