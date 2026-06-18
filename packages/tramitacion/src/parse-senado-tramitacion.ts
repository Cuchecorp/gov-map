// parse-senado-tramitacion — XML de `wspublico/tramitacion.php` → Proyecto + TramitacionEvento[].
//
// `<proyectos><proyecto>`: del `<descripcion>` se deriva el Proyecto (TRAM-04); las 4 secciones
// del timeline (tramitacion/tramite, urgencias/urgencia, informes/informe, oficios/oficio) se
// materializan a TramitacionEvento[] (TRAM-05). Fechas dd/mm/yyyy → ISO (Pitfall 3). Listas
// opcionales forzadas a array con [].concat (fast-xml-parser colapsa nodo único a objeto).
// Cada entidad lleva provenance inline (TRAM-09) y se valida con su zod schema.

import { XMLParser } from "fast-xml-parser";
import { makeProvenance } from "@obs/core";
import {
  type Proyecto,
  type TramitacionEvento,
  type Iniciativa,
  ProyectoSchema,
  TramitacionEventoSchema,
} from "./model";
import { parseFechaCL, toIso } from "./fecha";

const ORIGEN = "senado-wspublico";
const URL_TRAMITACION =
  "https://tramitacion.senado.cl/wspublico/tramitacion.php";

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

function txt(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") {
    const t = (v as Record<string, unknown>)["#text"];
    if (t == null) return null;
    const s = String(t).trim();
    return s.length === 0 ? null : s;
  }
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return ([] as T[]).concat(v as T | T[]);
}

/** Fecha de evento: ISO si parsea, si no el texto crudo, si no "" (timeline la manda al final). */
function fechaEvento(v: unknown): string {
  const d = parseFechaCL(txt(v));
  if (d) return toIso(d);
  return txt(v) ?? "";
}

function iniciativaDe(s: string | null): Iniciativa | null {
  if (s == null) return null;
  if (/mensaje/i.test(s)) return "Mensaje";
  if (/moci/i.test(s)) return "Moción";
  return null;
}

export function parseSenadoTramitacion(
  xml: string,
  enlace?: string,
): { proyecto: Proyecto; eventos: TramitacionEvento[] } {
  const doc = parser.parse(xml);
  const proyectoRaw = (doc?.proyectos?.proyecto ??
    doc?.proyecto ??
    {}) as Record<string, unknown>;
  const desc = (proyectoRaw.descripcion ?? {}) as Record<string, unknown>;

  const boletin = txt(desc.boletin) ?? "";
  const boletinNum = boletin.replace(/-\d+$/, ""); // base sin sufijo de comisión (Pitfall 1)

  const link = enlace ?? URL_TRAMITACION;
  const p = makeProvenance(ORIGEN, link);
  const provCols = {
    origen: p.source,
    fecha_captura: p.fetchedAt,
    enlace: p.sourceUrl,
  };

  // autores: <autores><autor>...</autor></autores> (puede venir vacío u objeto único).
  const autoresRaw = (desc.autores ?? proyectoRaw.autores ?? {}) as Record<
    string,
    unknown
  >;
  const autores = asArray<unknown>(autoresRaw?.autor)
    .map((a) => txt(a))
    .filter((a): a is string => a != null);

  const proyecto: Proyecto = ProyectoSchema.parse({
    boletin,
    boletin_num: boletinNum,
    titulo: txt(desc.titulo) ?? "",
    iniciativa: iniciativaDe(txt(desc.iniciativa)),
    camara_origen: txt(desc.camara_origen),
    autores,
    materia: txt(desc.materia),
    estado: txt(desc.estado),
    etapa: txt(desc.etapa),
    subetapa: txt(desc.subetapa),
    ...provCols,
  }) as Proyecto;

  const eventos: TramitacionEvento[] = [];
  const eventoProvCols = {
    origen: p.source,
    fecha_captura: p.fetchedAt,
  };

  const pushEvento = (e: {
    fecha: string;
    camara: string | null;
    tipo: TramitacionEvento["tipo"];
    descripcion: string;
    enlace: string | null;
  }) => {
    eventos.push(
      TramitacionEventoSchema.parse({
        boletin,
        fecha: e.fecha,
        camara: e.camara ?? "",
        tipo: e.tipo,
        descripcion: e.descripcion,
        enlace: e.enlace,
        ...eventoProvCols,
      }) as TramitacionEvento,
    );
  };

  // 1. tramitacion/tramite
  const tramitacion = (proyectoRaw.tramitacion ?? {}) as Record<string, unknown>;
  for (const t of asArray<Record<string, unknown>>(
    tramitacion.tramite as Record<string, unknown> | Record<string, unknown>[],
  )) {
    pushEvento({
      fecha: fechaEvento(t.FECHA),
      camara: txt(t.CAMARATRAMITE),
      tipo: "tramite",
      descripcion: txt(t.DESCRIPCIONTRAMITE) ?? "",
      enlace: null,
    });
  }

  // 2. urgencias/urgencia
  const urgencias = (proyectoRaw.urgencias ?? {}) as Record<string, unknown>;
  for (const u of asArray<Record<string, unknown>>(
    urgencias.urgencia as Record<string, unknown> | Record<string, unknown>[],
  )) {
    pushEvento({
      fecha: fechaEvento(u.FECHAINGRESO ?? u.FECHA),
      camara: txt(u.CAMARAINGRESO ?? u.CAMARA),
      tipo: "urgencia",
      descripcion: txt(u.TIPO) ?? "Urgencia",
      enlace: null,
    });
  }

  // 3. informes/informe (LINK_INFORME)
  const informes = (proyectoRaw.informes ?? {}) as Record<string, unknown>;
  for (const inf of asArray<Record<string, unknown>>(
    informes.informe as Record<string, unknown> | Record<string, unknown>[],
  )) {
    pushEvento({
      fecha: fechaEvento(inf.FECHAINFORME),
      camara: null,
      tipo: "informe",
      descripcion: txt(inf.TRAMITE) ?? "Informe",
      enlace: txt(inf.LINK_INFORME),
    });
  }

  // 4. oficios/oficio (LINK_OFICIO)
  const oficios = (proyectoRaw.oficios ?? {}) as Record<string, unknown>;
  for (const of of asArray<Record<string, unknown>>(
    oficios.oficio as Record<string, unknown> | Record<string, unknown>[],
  )) {
    pushEvento({
      fecha: fechaEvento(of.FECHA),
      camara: txt(of.CAMARA),
      tipo: "oficio",
      descripcion: txt(of.TRAMITE) ?? "Oficio",
      enlace: txt(of.LINK_OFICIO),
    });
  }

  return { proyecto, eventos };
}
