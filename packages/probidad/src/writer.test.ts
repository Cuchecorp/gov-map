// writer.test — el ProbidadWriter es IDEMPOTENTE Y VERSIONADO por (fuente_id, fecha_presentacion),
// tanto el fake in-memory como el SupabaseProbidadWriter (mock del cliente PostgREST que verifica el
// onConflict de versión y la guarda: la service key nunca aparece en mensajes de error).

import { describe, it, expect } from "vitest";
import { confirmar } from "@obs/identity";
import { InMemoryProbidadWriter, versionKey } from "./writer";
import { SupabaseProbidadWriter } from "./writer-supabase";
import type { DeclaracionParaEscribir } from "./reconciliar-declarante";
import type { Bienes } from "./model";

const bienesVacios: Bienes = {
  inmuebles: [],
  muebles: [],
  actividades: [],
  pasivos: [],
  accionesDerechos: [],
  valores: [],
};

function fila(
  over: Partial<DeclaracionParaEscribir> & { fuenteId: string; fechaPresentacion: string },
): DeclaracionParaEscribir {
  return {
    fuenteId: over.fuenteId,
    fechaPresentacion: over.fechaPresentacion,
    enlace: over.enlace ?? null,
    mencionDeclarante: over.mencionDeclarante ?? "CARLOS BIANCHI CHELECH",
    estadoVinculo: over.estadoVinculo ?? "no_confirmado",
    tipo: over.tipo ?? "ACTUALIZACIÓN PERIÓDICA (MARZO)",
    cargo: over.cargo ?? null,
    organismo: over.organismo ?? null,
    bienes: over.bienes ?? {
      ...bienesVacios,
      inmuebles: [
        { ubicadoEn: "HUERTO FAMILIAR 120 LOTE D 3", rolAvaluo: "1011-99", numInscripcion: null, fojas: null, anio: "2025", esSuDomicilio: "0" },
      ],
    },
    familiares: over.familiares ?? [],
    origen: "infoprobidad-sparql",
    fecha_captura: "2026-06-19T00:00:00Z",
    enlace_url: "https://datos.cplt.cl/sparql",
    licencia: "CC BY 4.0",
  };
}

describe("InMemoryProbidadWriter — idempotente + VERSIONADO por (fuente_id, fecha_presentacion)", () => {
  it("(a) upsert 2× con el mismo input NO duplica (declaraciones + bienes)", async () => {
    const w = new InMemoryProbidadWriter();
    await w.upsertDeclaraciones([fila({ fuenteId: "decl_1", fechaPresentacion: "2026-03-30" })]);
    await w.upsertDeclaraciones([fila({ fuenteId: "decl_1", fechaPresentacion: "2026-03-30" })]);

    expect(w.declaraciones.size).toBe(1);
    expect(w.bienesInmuebles.size).toBe(1);
  });

  it("(b) versioning INT-04: dos fechas del MISMO declarante → DOS filas; re-run NO sobreescribe", async () => {
    const w = new InMemoryProbidadWriter();
    // Misma URI base de declarante, dos versiones (dos URIs de nodo + dos fechas distintas).
    await w.upsertDeclaraciones([
      fila({ fuenteId: "decl_v1", fechaPresentacion: "2021-08-19", tipo: "PRIMERA DECLARACIÓN" }),
      fila({ fuenteId: "decl_v2", fechaPresentacion: "2026-03-30", tipo: "ACTUALIZACIÓN PERIÓDICA (MARZO)" }),
    ]);
    expect(w.declaraciones.size).toBe(2); // dos versiones, no colapsan

    // Re-run de la versión vieja con el MISMO input → NO crea duplicado NI sobreescribe la nueva.
    await w.upsertDeclaraciones([fila({ fuenteId: "decl_v1", fechaPresentacion: "2021-08-19", tipo: "PRIMERA DECLARACIÓN" })]);
    expect(w.declaraciones.size).toBe(2);
    // La versión vieja conserva su tipo; la nueva sigue presente (no se borró).
    expect(w.declaraciones.get(versionKey("decl_v1", "2021-08-19"))!.tipo).toBe("PRIMERA DECLARACIÓN");
    expect(w.declaraciones.get(versionKey("decl_v2", "2026-03-30"))!.tipo).toBe("ACTUALIZACIÓN PERIÓDICA (MARZO)");
  });

  it("(c) dedupe-before-batch: dos bienes idénticos de la misma versión colapsan a uno", async () => {
    const w = new InMemoryProbidadWriter();
    await w.upsertDeclaraciones([
      fila({
        fuenteId: "decl_dup",
        fechaPresentacion: "2026-03-30",
        bienes: {
          ...bienesVacios,
          inmuebles: [
            { ubicadoEn: "X 1", rolAvaluo: "1-1", numInscripcion: null, fojas: null, anio: "2025", esSuDomicilio: "0" },
            { ubicadoEn: "X 1", rolAvaluo: "1-1", numInscripcion: null, fojas: null, anio: "2025", esSuDomicilio: "0" },
          ],
        },
      }),
    ]);
    expect(w.bienesInmuebles.size).toBe(1);
  });

  it("storage plano: el FK branded se aplana a parlamentario_id; familiares sin enlace", async () => {
    const w = new InMemoryProbidadWriter();
    await w.upsertDeclaraciones([
      fila({
        fuenteId: "decl-ok",
        fechaPresentacion: "2026-03-30",
        enlace: confirmar("P00500", "determinista"),
        estadoVinculo: "confirmado",
        familiares: [{ relacion: "esConyugeDe", nombre: "Tercero" }],
      }),
    ]);
    expect(w.declaraciones.get(versionKey("decl-ok", "2026-03-30"))!.parlamentario_id).toBe("P00500");
    // El familiar NO lleva un FK a persona.
    expect([...w.familiares.values()].every((f) => !("parlamentario_id" in f))).toBe(true);
  });

  it("marcarIngestado upserta un row por parlamentario (idempotente)", async () => {
    const w = new InMemoryProbidadWriter();
    await w.marcarIngestado(["P1", "P2"], "2026-03-30");
    await w.marcarIngestado(["P1", "P2"], "2026-03-30");
    expect(w.ingestaEstado.size).toBe(2);
    expect(w.ingestaEstado.get("P1")!.ingestado_hasta).toBe("2026-03-30");
  });
});

/** Mock mínimo del cliente Supabase: registra los upsert/insert/delete por tabla. */
function makeFakeClient() {
  const upserts: Array<{ tabla: string; rows: unknown[]; onConflict?: string }> = [];
  const inserts: Array<{ tabla: string; rows: unknown[] }> = [];
  const deletes: Array<{ tabla: string }> = [];
  const client = {
    from(tabla: string) {
      return {
        upsert(rows: unknown[], opts?: { onConflict?: string }) {
          upserts.push({ tabla, rows: Array.isArray(rows) ? rows : [rows], onConflict: opts?.onConflict });
          return Promise.resolve({ error: null });
        },
        insert(rows: unknown[]) {
          inserts.push({ tabla, rows: Array.isArray(rows) ? rows : [rows] });
          return Promise.resolve({ error: null });
        },
        delete() {
          deletes.push({ tabla });
          const chain = {
            eq(_col: string, _val: unknown) {
              return chain;
            },
            then(resolve: (v: { error: null }) => void) {
              return Promise.resolve({ error: null }).then(resolve);
            },
          };
          return chain;
        },
      };
    },
  };
  return { client, upserts, inserts, deletes };
}

describe("SupabaseProbidadWriter — upsert VERSIONADO por onConflict (clave de versión)", () => {
  it("(b crítico) la raíz upserta declaracion con onConflict que INCLUYE fecha_presentacion", async () => {
    const { client, upserts } = makeFakeClient();
    const w = new SupabaseProbidadWriter({ url: "x", serviceKey: "k", client: client as never });

    await w.upsertDeclaraciones([fila({ fuenteId: "decl_1", fechaPresentacion: "2026-03-30" })]);

    const decl = upserts.find((u) => u.tabla === "declaracion")!;
    // CRÍTICO (Pitfall 1): la clave de conflicto incluye fecha_presentacion → versiones acumulan.
    expect(decl.onConflict).toBe("fuente_id,fecha_presentacion");
    const inm = upserts.find((u) => u.tabla === "declaracion_bien_inmueble")!;
    expect(inm.onConflict).toContain("fecha_presentacion");
    // La raíz NO lleva los hijos anidados.
    const raiz = decl.rows[0] as Record<string, unknown>;
    expect(raiz).not.toHaveProperty("bienes");
    expect(raiz).not.toHaveProperty("familiares");
    expect(raiz).toHaveProperty("parlamentario_id");
    expect(raiz).toHaveProperty("licencia", "CC BY 4.0");
    // Orden: declaracion (raíz) antes que sus hijos.
    expect(upserts[0]!.tabla).toBe("declaracion");
  });

  it("familiares se INSERTAN tras borrar la versión (deny-by-default, sin clave única)", async () => {
    const { client, upserts, inserts, deletes } = makeFakeClient();
    const w = new SupabaseProbidadWriter({ url: "x", serviceKey: "k", client: client as never });
    await w.upsertDeclaraciones([
      fila({ fuenteId: "decl_f", fechaPresentacion: "2026-03-30", familiares: [{ relacion: "esHijoDe", nombre: "Tercero" }] }),
    ]);
    expect(deletes.some((d) => d.tabla === "declaracion_familiar")).toBe(true);
    expect(inserts.some((i) => i.tabla === "declaracion_familiar")).toBe(true);
    // Los familiares NUNCA van por upsert (no hay clave única natural).
    expect(upserts.some((u) => u.tabla === "declaracion_familiar")).toBe(false);
  });

  it("marcarIngestado upserta probidad_ingesta_estado por parlamentario_id", async () => {
    const { client, upserts } = makeFakeClient();
    const w = new SupabaseProbidadWriter({ url: "x", serviceKey: "k", client: client as never });
    await w.marcarIngestado(["P1"], "2026-03-30");
    const m = upserts.find((u) => u.tabla === "probidad_ingesta_estado")!;
    expect(m.onConflict).toBe("parlamentario_id");
  });

  it("propaga el error de PostgREST SIN interpolar la service key", async () => {
    const SERVICE_KEY = "super-secret-service-role-key-xyz";
    const client = {
      from(_t: string) {
        return {
          upsert(_rows: unknown[], _opts?: unknown) {
            return Promise.resolve({ error: { message: "permission denied" } });
          },
        };
      },
    };
    const w = new SupabaseProbidadWriter({ url: "x", serviceKey: SERVICE_KEY, client: client as never });

    await expect(
      w.upsertDeclaraciones([fila({ fuenteId: "decl_e", fechaPresentacion: "2026-03-30" })]),
    ).rejects.toThrow(/permission denied/);
    await w
      .upsertDeclaraciones([fila({ fuenteId: "decl_e2", fechaPresentacion: "2026-03-30" })])
      .catch((e: Error) => expect(e.message).not.toContain(SERVICE_KEY));
  });
});
