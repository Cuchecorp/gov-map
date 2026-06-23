// writer-supabase — impl REAL del `ProbidadWriter` contra Supabase (remoto/local).
//
// Espeja `SupabaseLobbyWriter`: `createClient` con la SERVICE key (bypassa RLS; server-side) y
// `upsert(filas, { onConflict })` idempotente por la clave natural de la migración 0022. PERO el
// `onConflict` de `declaracion` INCLUYE `fecha_presentacion` → las versiones ACUMULAN (Pitfall 1):
//   * declaracion              → onConflict 'fuente_id,fecha_presentacion'  (CLAVE DE VERSIÓN)
//   * declaracion_bien_inmueble → onConflict 'fuente_id,fecha_presentacion,ubicado_en,rol_avaluo,num_inscripcion'
//   * declaracion_bien_mueble   → onConflict 'fuente_id,fecha_presentacion,nombre,modelo,matricula,numero_inscripcion'
//   * declaracion_actividad     → onConflict 'fuente_id,fecha_presentacion,objeto,vinculo'
//   * declaracion_pasivo        → onConflict 'fuente_id,fecha_presentacion,tipo_obligacion,acreedor,monto_deuda'
//   * declaracion_accion_derecho→ onConflict 'fuente_id,fecha_presentacion,rut_juridica,fecha_adquisicion,cantidad_acciones'
//   * declaracion_valor         → onConflict 'fuente_id,fecha_presentacion,entidad_emisora,tipo_accion_derecho,fecha_adquisicion'
//   * probidad_ingesta_estado   → onConflict 'parlamentario_id'
//
// `declaracion_familiar` NO tiene clave única natural (surrogate id) → se INSERTA (no upsert) tras
// borrar las filas de esa versión, para que un re-run no acumule duplicados de tercero PII.
//
// CRÍTICO: NUNCA keyear `declaracion` por el declarante solo (colapsa versiones, muestra una vieja
// como actual). La clave de conflicto SIEMPRE incluye `fecha_presentacion`.
//
// La service key NUNCA se interpola en mensajes de error (solo se propaga `error.message` de
// PostgREST, que no la contiene). STORAGE PLANO: el FK del declarante entra branded
// (`EnlaceConfirmado | null`) y se persiste como `parlamentario_id: string | null`.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ProbidadWriter, BienesParaEscribir } from "./writer";
import type { DeclaracionParaEscribir } from "./reconciliar-declarante";

export interface SupabaseProbidadWriterOptions {
  /** URL de Supabase (remoto sa-east-1 o local). */
  url: string;
  /** SERVICE role key (bypassa RLS; nunca la anon). */
  serviceKey: string;
  /** Cliente pre-construido (tests). Si se pasa, ignora url/serviceKey. */
  client?: SupabaseClient;
}

const CHUNK = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** De-duplica por clave (last-write-wins), preservando el orden de la última aparición. */
function dedupePorClave<T>(arr: T[], key: (v: T) => string): T[] {
  const m = new Map<string, T>();
  for (const v of arr) m.set(key(v), v);
  return [...m.values()];
}

/** Fila raíz de declaracion (plana, sin los hijos anidados). */
function declaracionRoot(f: DeclaracionParaEscribir): Record<string, unknown> {
  return {
    fuente_id: f.fuenteId,
    fecha_presentacion: f.fechaPresentacion,
    // Storage PLANO: el FK branded se aplana a string|null.
    parlamentario_id: f.enlace?.parlamentarioId ?? null,
    mencion_declarante: f.mencionDeclarante,
    estado_vinculo: f.estadoVinculo,
    tipo: f.tipo,
    cargo: f.cargo,
    organismo: f.organismo,
    origen: f.origen,
    fecha_captura: f.fecha_captura,
    enlace: f.enlace_url,
    licencia: f.licencia,
  };
}

const k = (v: unknown): string => (v == null ? "∅" : String(v));

export class SupabaseProbidadWriter implements ProbidadWriter {
  private readonly client: SupabaseClient;

  constructor(opts: SupabaseProbidadWriterOptions) {
    this.client =
      opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }

  async upsertDeclaraciones(filas: DeclaracionParaEscribir[]): Promise<void> {
    if (filas.length === 0) return;

    // 1. Raíces (VERSIÓN = fuente_id,fecha_presentacion). De-dup por la clave de versión.
    const raices = dedupePorClave(filas, (f) => `${f.fuenteId}∥${f.fechaPresentacion}`);
    for (const lote of chunk(raices.map(declaracionRoot), CHUNK)) {
      const { error } = await this.client
        .from("declaracion")
        .upsert(lote, { onConflict: "fuente_id,fecha_presentacion", ignoreDuplicates: false });
      if (error) throw new Error(`upsert declaracion falló: ${error.message}`);
    }

    const prov = (f: DeclaracionParaEscribir) => ({
      fuente_id: f.fuenteId,
      fecha_presentacion: f.fechaPresentacion,
      origen: f.origen,
      fecha_captura: f.fecha_captura,
      enlace: f.enlace_url,
      licencia: f.licencia,
    });

    // 2. Bienes inmuebles.
    const inmuebles = raices.flatMap((f) =>
      f.bienes.inmuebles.map((b) => ({
        ...prov(f),
        ubicado_en: b.ubicadoEn,
        rol_avaluo: b.rolAvaluo,
        num_inscripcion: b.numInscripcion,
        fojas: b.fojas,
        anio: b.anio,
        es_su_domicilio: b.esSuDomicilio,
      })),
    );
    await this.upsertHijos(
      "declaracion_bien_inmueble",
      "fuente_id,fecha_presentacion,ubicado_en,rol_avaluo,num_inscripcion",
      dedupePorClave(inmuebles, (r) =>
        [r.fuente_id, r.fecha_presentacion, k(r.ubicado_en), k(r.rol_avaluo), k(r.num_inscripcion)].join("∣"),
      ),
    );

    // 3. Bienes muebles.
    const muebles = raices.flatMap((f) =>
      f.bienes.muebles.map((b) => ({
        ...prov(f),
        nombre: b.nombre,
        descripcion: b.descripcion,
        modelo: b.modelo,
        anio_fabricacion: b.anioFabricacion,
        matricula: b.matricula,
        numero_inscripcion: b.numeroInscripcion,
        anio_inscripcion: b.anioInscripcion,
        tonelaje: b.tonelaje,
      })),
    );
    await this.upsertHijos(
      "declaracion_bien_mueble",
      "fuente_id,fecha_presentacion,nombre,modelo,matricula,numero_inscripcion",
      dedupePorClave(muebles, (r) =>
        [r.fuente_id, r.fecha_presentacion, k(r.nombre), k(r.modelo), k(r.matricula), k(r.numero_inscripcion)].join("∣"),
      ),
    );

    // 4. Actividades.
    const actividades = raices.flatMap((f) =>
      f.bienes.actividades.map((a) => ({
        ...prov(f),
        objeto: a.objeto,
        vinculo: a.vinculo,
        remunerado: a.remunerado,
        hace_doce_meses: a.haceDoceMeses,
      })),
    );
    await this.upsertHijos(
      "declaracion_actividad",
      "fuente_id,fecha_presentacion,objeto,vinculo",
      dedupePorClave(actividades, (r) =>
        [r.fuente_id, r.fecha_presentacion, k(r.objeto), k(r.vinculo)].join("∣"),
      ),
    );

    // 5. Pasivos.
    const pasivos = raices.flatMap((f) =>
      f.bienes.pasivos.map((p) => ({
        ...prov(f),
        tipo_obligacion: p.tipoObligacion,
        acreedor: p.acreedor,
        monto_deuda: p.montoDeuda,
      })),
    );
    await this.upsertHijos(
      "declaracion_pasivo",
      "fuente_id,fecha_presentacion,tipo_obligacion,acreedor,monto_deuda",
      dedupePorClave(pasivos, (r) =>
        [r.fuente_id, r.fecha_presentacion, k(r.tipo_obligacion), k(r.acreedor), k(r.monto_deuda)].join("∣"),
      ),
    );

    // 6. Acciones/derechos.
    const acciones = raices.flatMap((f) =>
      f.bienes.accionesDerechos.map((a) => ({
        ...prov(f),
        rut_juridica: a.rutJuridica,
        cantidad_acciones: a.cantidadAcciones,
        fecha_adquisicion: a.fechaAdquisicion,
        es_controlador: a.esControlador,
        gravamenes: a.gravamenes,
      })),
    );
    await this.upsertHijos(
      "declaracion_accion_derecho",
      "fuente_id,fecha_presentacion,rut_juridica,fecha_adquisicion,cantidad_acciones",
      dedupePorClave(acciones, (r) =>
        [r.fuente_id, r.fecha_presentacion, k(r.rut_juridica), k(r.fecha_adquisicion), k(r.cantidad_acciones)].join("∣"),
      ),
    );

    // 7. Valores.
    const valores = raices.flatMap((f) =>
      f.bienes.valores.map((v) => ({
        ...prov(f),
        entidad_emisora: v.entidadEmisora,
        tipo_accion_derecho: v.tipoAccionDerecho,
        cantidad_representa: v.cantidadRepresenta,
        valor_plaza: v.valorPlaza,
        pais_que_emite: v.paisQueEmite,
        fecha_adquisicion: v.fechaAdquisicion,
        tipo_gravamen: v.tipoGravamen,
      })),
    );
    await this.upsertHijos(
      "declaracion_valor",
      "fuente_id,fecha_presentacion,entidad_emisora,tipo_accion_derecho,fecha_adquisicion",
      dedupePorClave(valores, (r) =>
        [r.fuente_id, r.fecha_presentacion, k(r.entidad_emisora), k(r.tipo_accion_derecho), k(r.fecha_adquisicion)].join("∣"),
      ),
    );

    // 8. Familiares (deny-by-default, surrogate PK): borra las filas de cada versión tocada y
    //    re-inserta (idempotente sin clave única, sin acumular duplicados de tercero PII).
    const familiares = raices.flatMap((f) =>
      f.familiares.map((fam) => ({
        fuente_id: f.fuenteId,
        fecha_presentacion: f.fechaPresentacion,
        relacion: fam.relacion,
        nombre: fam.nombre,
        origen: f.origen,
        fecha_captura: f.fecha_captura,
        enlace: f.enlace_url,
      })),
    );
    if (familiares.length > 0) {
      for (const f of raices) {
        const { error: delErr } = await this.client
          .from("declaracion_familiar")
          .delete()
          .eq("fuente_id", f.fuenteId)
          .eq("fecha_presentacion", f.fechaPresentacion);
        if (delErr) throw new Error(`delete declaracion_familiar falló: ${delErr.message}`);
      }
      for (const lote of chunk(familiares, CHUNK)) {
        const { error } = await this.client.from("declaracion_familiar").insert(lote);
        if (error) throw new Error(`insert declaracion_familiar falló: ${error.message}`);
      }
    }
  }

  /**
   * Upserta SOLO los bienes (las 6 sub-tablas) de N versiones, idempotente por la clave UNIQUE
   * natural de cada sub-tabla. NO toca la raíz `declaracion` ni los familiares. Mirror de las
   * secciones 2-7 de `upsertDeclaraciones`, pero alimentado por `BienesParaEscribir` (la raíz ya
   * existe). Los `onConflict` usan EXACTAMENTE las columnas de los UNIQUE de la migración de bienes.
   */
  async upsertBienes(items: BienesParaEscribir[]): Promise<void> {
    if (items.length === 0) return;

    const prov = (it: BienesParaEscribir) => ({
      fuente_id: it.fuenteId,
      fecha_presentacion: it.fechaPresentacion,
      origen: it.origen,
      fecha_captura: it.fecha_captura,
      enlace: it.enlace,
      licencia: it.licencia,
    });

    // 1. Bienes inmuebles. UNIQUE: fuente_id,num_inscripcion,rol_avaluo,ubicado_en,fecha_presentacion
    const inmuebles = items.flatMap((it) =>
      it.bienes.inmuebles.map((b) => ({
        ...prov(it),
        ubicado_en: b.ubicadoEn,
        rol_avaluo: b.rolAvaluo,
        num_inscripcion: b.numInscripcion,
        fojas: b.fojas,
        anio: b.anio,
        es_su_domicilio: b.esSuDomicilio,
      })),
    );
    await this.upsertHijos(
      "declaracion_bien_inmueble",
      "fuente_id,num_inscripcion,rol_avaluo,ubicado_en,fecha_presentacion",
      dedupePorClave(inmuebles, (r) =>
        [r.fuente_id, k(r.num_inscripcion), k(r.rol_avaluo), k(r.ubicado_en), r.fecha_presentacion].join("∣"),
      ),
    );

    // 2. Bienes muebles. UNIQUE: fecha_presentacion,nombre,modelo,matricula,numero_inscripcion,fuente_id
    const muebles = items.flatMap((it) =>
      it.bienes.muebles.map((b) => ({
        ...prov(it),
        nombre: b.nombre,
        descripcion: b.descripcion,
        modelo: b.modelo,
        anio_fabricacion: b.anioFabricacion,
        matricula: b.matricula,
        numero_inscripcion: b.numeroInscripcion,
        anio_inscripcion: b.anioInscripcion,
        tonelaje: b.tonelaje,
      })),
    );
    await this.upsertHijos(
      "declaracion_bien_mueble",
      "fecha_presentacion,nombre,modelo,matricula,numero_inscripcion,fuente_id",
      dedupePorClave(muebles, (r) =>
        [r.fecha_presentacion, k(r.nombre), k(r.modelo), k(r.matricula), k(r.numero_inscripcion), r.fuente_id].join("∣"),
      ),
    );

    // 3. Actividades. UNIQUE: fuente_id,vinculo,objeto,fecha_presentacion
    const actividades = items.flatMap((it) =>
      it.bienes.actividades.map((a) => ({
        ...prov(it),
        objeto: a.objeto,
        vinculo: a.vinculo,
        remunerado: a.remunerado,
        hace_doce_meses: a.haceDoceMeses,
      })),
    );
    await this.upsertHijos(
      "declaracion_actividad",
      "fuente_id,vinculo,objeto,fecha_presentacion",
      dedupePorClave(actividades, (r) =>
        [r.fuente_id, k(r.vinculo), k(r.objeto), r.fecha_presentacion].join("∣"),
      ),
    );

    // 4. Pasivos. UNIQUE: monto_deuda,acreedor,tipo_obligacion,fecha_presentacion,fuente_id
    const pasivos = items.flatMap((it) =>
      it.bienes.pasivos.map((p) => ({
        ...prov(it),
        tipo_obligacion: p.tipoObligacion,
        acreedor: p.acreedor,
        monto_deuda: p.montoDeuda,
      })),
    );
    await this.upsertHijos(
      "declaracion_pasivo",
      "monto_deuda,acreedor,tipo_obligacion,fecha_presentacion,fuente_id",
      dedupePorClave(pasivos, (r) =>
        [k(r.monto_deuda), k(r.acreedor), k(r.tipo_obligacion), r.fecha_presentacion, r.fuente_id].join("∣"),
      ),
    );

    // 5. Acciones/derechos. UNIQUE: fuente_id,cantidad_acciones,fecha_adquisicion,rut_juridica,fecha_presentacion
    const acciones = items.flatMap((it) =>
      it.bienes.accionesDerechos.map((a) => ({
        ...prov(it),
        rut_juridica: a.rutJuridica,
        cantidad_acciones: a.cantidadAcciones,
        fecha_adquisicion: a.fechaAdquisicion,
        es_controlador: a.esControlador,
        gravamenes: a.gravamenes,
      })),
    );
    await this.upsertHijos(
      "declaracion_accion_derecho",
      "fuente_id,cantidad_acciones,fecha_adquisicion,rut_juridica,fecha_presentacion",
      dedupePorClave(acciones, (r) =>
        [r.fuente_id, k(r.cantidad_acciones), k(r.fecha_adquisicion), k(r.rut_juridica), r.fecha_presentacion].join("∣"),
      ),
    );

    // 6. Valores. UNIQUE: fecha_presentacion,entidad_emisora,tipo_accion_derecho,fecha_adquisicion,fuente_id
    const valores = items.flatMap((it) =>
      it.bienes.valores.map((v) => ({
        ...prov(it),
        entidad_emisora: v.entidadEmisora,
        tipo_accion_derecho: v.tipoAccionDerecho,
        cantidad_representa: v.cantidadRepresenta,
        valor_plaza: v.valorPlaza,
        pais_que_emite: v.paisQueEmite,
        fecha_adquisicion: v.fechaAdquisicion,
        tipo_gravamen: v.tipoGravamen,
      })),
    );
    await this.upsertHijos(
      "declaracion_valor",
      "fecha_presentacion,entidad_emisora,tipo_accion_derecho,fecha_adquisicion,fuente_id",
      dedupePorClave(valores, (r) =>
        [r.fecha_presentacion, k(r.entidad_emisora), k(r.tipo_accion_derecho), k(r.fecha_adquisicion), r.fuente_id].join("∣"),
      ),
    );
  }

  /** Upsert genérico de una sub-tabla de bien por su clave de versión natural. */
  private async upsertHijos(tabla: string, onConflict: string, filas: Record<string, unknown>[]): Promise<void> {
    if (filas.length === 0) return;
    for (const lote of chunk(filas, CHUNK)) {
      const { error } = await this.client.from(tabla).upsert(lote, { onConflict, ignoreDuplicates: false });
      if (error) throw new Error(`upsert ${tabla} falló: ${error.message}`);
    }
  }

  async marcarIngestado(parlamentarioIds: string[], hasta: string): Promise<void> {
    if (parlamentarioIds.length === 0) return;
    const ids = [...new Set(parlamentarioIds)];
    const filas = ids.map((id) => ({ parlamentario_id: id, ingestado_hasta: hasta }));
    for (const lote of chunk(filas, CHUNK)) {
      const { error } = await this.client
        .from("probidad_ingesta_estado")
        .upsert(lote, { onConflict: "parlamentario_id", ignoreDuplicates: false });
      if (error) throw new Error(`upsert probidad_ingesta_estado falló: ${error.message}`);
    }
  }
}
