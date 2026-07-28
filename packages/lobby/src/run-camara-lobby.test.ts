// run-camara-lobby.test — runner de la ingesta del lobby de la Cámara con adjudicación de
// identidad. SIN red, SIN DB, SIN R2: conector mock (sirve el fixture real), InMemoryLobbyWriter,
// maestra mínima en memoria.
//
// Invariantes verificadas (Phase 25):
//  - el sujeto pasivo de la fila-2 es un ASESOR; el diputado real ("Cristian Mella Andaur") está
//    en el paréntesis H.D. → con la maestra adecuada resuelve DETERMINISTA y puebla el FK.
//  - el `mencionSujeto` ALMACENADO de esa fila sigue siendo el RAW del asesor (trazabilidad).
//  - las filas sin match en la maestra quedan no_confirmado y NUNCA fabrican un FK.
//  - sin r2Store, no hay r2Path (Etapa 1 omitida — no fatal).

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Parlamentario } from "@obs/core";
import { runCamaraLobby } from "./run-camara-lobby";
import { CamaraLobbyConnector } from "./connector-camara-lobby";
import { InMemoryLobbyWriter } from "./writer";

const FIXTURE = readFileSync(
  fileURLToPath(new URL("./__fixtures__/camara-listadodeaudiencias.sample.html", import.meta.url)),
  "utf8",
);

/** Conector mock: `fetchListado` devuelve el fixture (sin red). */
function mockConector(html: string): CamaraLobbyConnector {
  return { fetchListado: async () => html } as unknown as CamaraLobbyConnector;
}

/** Construye un Parlamentario con defaults razonables. */
function maestro(p: Partial<Parlamentario> & { id: string }): Parlamentario {
  return {
    id: p.id,
    nombre_normalizado: p.nombre_normalizado ?? "",
    nombres: p.nombres ?? "",
    apellido_paterno: p.apellido_paterno ?? "",
    apellido_materno: p.apellido_materno ?? "",
    camara: p.camara ?? "diputados",
    periodo: p.periodo ?? "2026-2030",
    region: p.region ?? null,
    distrito: p.distrito ?? null,
    circunscripcion: p.circunscripcion ?? null,
    partido: p.partido ?? null,
    rut: p.rut ?? null,
    parlid_senado: p.parlid_senado ?? null,
    id_diputado_camara: p.id_diputado_camara ?? null,
    estado: p.estado ?? "confirmado",
    email: p.email ?? null,
    origen: p.origen ?? "camara",
    fecha_captura: p.fecha_captura ?? "2026-01-01T00:00:00Z",
    enlace: p.enlace ?? "https://example.cl",
  };
}

// El nombre de cruce de la fila-2 ("Cristian Mella Andaur", sin coma) normaliza a tokens
// ordenados → "andaur cristian mella". El diputado de la maestra debe exponer EXACTAMENTE ese
// `nombre_normalizado`, camara "diputados", periodo "2026-2030" para resolver DETERMINISTA.
const DIP_MELLA = maestro({
  id: "PDIP-MELLA",
  nombre_normalizado: "andaur cristian mella",
  nombres: "Cristian",
  apellido_paterno: "Mella",
  apellido_materno: "Andaur",
  camara: "diputados",
  periodo: "2026-2030",
});

describe("runCamaraLobby — ingesta de la Cámara con adjudicación", () => {
  it("resuelve la fila-2 (asesor → H.D. real) DETERMINISTA poblando el FK, RAW preservado", async () => {
    const writer = new InMemoryLobbyWriter();
    const res = await runCamaraLobby({
      conector: mockConector(FIXTURE),
      writer,
      maestra: [DIP_MELLA],
      fechaCaptura: "2026-06-22T00:00:00Z",
    });

    // El fixture tiene 6 filas de datos.
    expect(res.audiencias).toBe(6);

    // Al menos una audiencia quedó confirmada con el FK al diputado real.
    const confirmadas = [...writer.audiencias.values()].filter(
      (a) => a.estado_vinculo === "confirmado",
    );
    expect(confirmadas.length).toBeGreaterThanOrEqual(1);
    expect(confirmadas.every((a) => a.parlamentario_id === "PDIP-MELLA")).toBe(true);
    expect(res.confirmados).toBe(1);
    expect(res.parlamentariosMarcados).toBe(1);

    // La confirmada vino de la fila del ASESOR (la extracción del honorable funcionó): el
    // `mencion_sujeto` ALMACENADO sigue siendo el RAW del asesor, no el del diputado.
    const fila2 = confirmadas[0]!;
    expect(fila2.parlamentario_id).toBe("PDIP-MELLA");
    expect(fila2.mencion_sujeto).toBe(
      "María José Castañeda Marambio (Asesor(a) H.D. Cristian Mella Andaur)",
    );

    // El marcador de ingesta apunta al diputado confirmado.
    expect(writer.ingestaEstado.has("PDIP-MELLA")).toBe(true);
    expect(writer.ingestaEstado.get("PDIP-MELLA")!.ingestado_hasta).toBe("2026-06-22");
  });

  it("las filas sin match en la maestra quedan no_confirmado y NUNCA fabrican un FK", async () => {
    const writer = new InMemoryLobbyWriter();
    await runCamaraLobby({
      conector: mockConector(FIXTURE),
      writer,
      maestra: [DIP_MELLA],
      fechaCaptura: "2026-06-22T00:00:00Z",
    });

    const noConfirmadas = [...writer.audiencias.values()].filter(
      (a) => a.estado_vinculo === "no_confirmado",
    );
    // Las otras 5 filas no tienen un diputado en la maestra → no_confirmado.
    expect(noConfirmadas.length).toBe(5);
    expect(noConfirmadas.every((a) => a.parlamentario_id === null)).toBe(true);
  });

  it("sin r2Store: no hay r2Path (Etapa 1 omitida, no fatal)", async () => {
    const writer = new InMemoryLobbyWriter();
    const res = await runCamaraLobby({
      conector: mockConector(FIXTURE),
      writer,
      maestra: [DIP_MELLA],
      fechaCaptura: "2026-06-22T00:00:00Z",
    });
    expect(res.r2Path).toBeNull();
  });

  it("escribe contrapartes (lobbistas) crudas sin enlace a persona (Pitfall 4)", async () => {
    const writer = new InMemoryLobbyWriter();
    const res = await runCamaraLobby({
      conector: mockConector(FIXTURE),
      writer,
      maestra: [DIP_MELLA],
      fechaCaptura: "2026-06-22T00:00:00Z",
    });
    expect(res.contrapartes).toBeGreaterThan(0);
    expect([...writer.contrapartes.values()].every((c) => c.contraparte_id === null)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G7 / W-9 (119-05): el crudo del curl (`--html-file`) entra a R2 ANTES de parsear y
// el parseo re-procesable sale de R2. Regla LOCKED 1-2 de CLAUDE.md.
// ─────────────────────────────────────────────────────────────────────────────
describe("runCamaraLobby — W-9: Etapa 1 del crudo local + replay idempotente", () => {
  it("con r2Store: putImmutable se invoca UNA vez y ANTES de escribir el derivado", async () => {
    const writer = new InMemoryLobbyWriter();
    const orden: string[] = [];
    const putImmutable = vi.fn(async () => {
      orden.push("put");
      return { r2Path: "camara-lobby/listadodeaudiencias/2026-06-22/abc.html", existed: false };
    });
    const upsert = vi.spyOn(writer, "upsertAudiencias").mockImplementation(async () => {
      orden.push("upsert");
    });

    const res = await runCamaraLobby({
      conector: mockConector(FIXTURE),
      writer,
      maestra: [DIP_MELLA],
      fechaCaptura: "2026-06-22T00:00:00Z",
      r2Store: { putImmutable } as never,
    });

    expect(putImmutable).toHaveBeenCalledTimes(1);
    expect(orden).toEqual(["put", "upsert"]);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(res.r2Path).toBe("camara-lobby/listadodeaudiencias/2026-06-22/abc.html");
    // El put lleva el source/resource/ext de la partición content-addressed del conector.
    const args = putImmutable.mock.calls[0] as unknown as string[];
    expect(args[0]).toBe("camara-lobby");
    expect(args[1]).toBe("listadodeaudiencias");
    expect(args[4]).toBe("html");
  });

  it("sin r2Store: parsea igual y loguea el [WARN] de Etapa 1 omitida (degradación honesta)", async () => {
    const writer = new InMemoryLobbyWriter();
    const logs: string[] = [];
    const res = await runCamaraLobby({
      conector: mockConector(FIXTURE),
      writer,
      maestra: [DIP_MELLA],
      fechaCaptura: "2026-06-22T00:00:00Z",
      log: (m) => logs.push(m),
    });

    expect(res.audiencias).toBe(6);
    expect(res.r2Path).toBeNull();
    expect(logs.some((l) => l.includes("[WARN] R2 no configurado — Etapa 1 omitida"))).toBe(true);
  });

  it("replay: `omitirEtapa1` (crudo ya en R2) NO loguea el [WARN] y parsea igual", async () => {
    const writer = new InMemoryLobbyWriter();
    const logs: string[] = [];
    const res = await runCamaraLobby({
      conector: mockConector(FIXTURE),
      writer,
      maestra: [DIP_MELLA],
      fechaCaptura: "2026-06-22T00:00:00Z",
      omitirEtapa1: true,
      log: (m) => logs.push(m),
    });

    expect(res.audiencias).toBe(6);
    expect(logs.some((l) => l.includes("[WARN] R2 no configurado"))).toBe(false);
    expect(logs.some((l) => l.includes("Etapa 1 ya cumplida"))).toBe(true);
  });

  it("idempotencia: parsear DOS veces el MISMO crudo deja los mismos conteos (clave natural)", async () => {
    const writer = new InMemoryLobbyWriter();
    const a = await runCamaraLobby({
      conector: mockConector(FIXTURE),
      writer,
      maestra: [DIP_MELLA],
      fechaCaptura: "2026-06-22T00:00:00Z",
      omitirEtapa1: true,
    });
    const nAud = writer.audiencias.size;
    const nContra = writer.contrapartes.size;

    const b = await runCamaraLobby({
      conector: mockConector(FIXTURE),
      writer,
      maestra: [DIP_MELLA],
      fechaCaptura: "2026-06-22T00:00:00Z",
      omitirEtapa1: true,
    });

    expect(b.audiencias).toBe(a.audiencias);
    expect(b.contrapartes).toBe(a.contrapartes);
    expect(writer.audiencias.size).toBe(nAud);
    expect(writer.contrapartes.size).toBe(nContra);
  });
});
