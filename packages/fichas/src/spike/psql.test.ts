import { describe, it, expect } from "vitest";
import { assertReadOnly, parseAtOutput } from "./psql.js";

// ──────────────────────────────────────────────────────────
// parseAtOutput: parser de salida -At (tuples-only unaligned)
// ──────────────────────────────────────────────────────────
describe("parseAtOutput", () => {
  it("parsea una fila de una columna", () => {
    expect(parseAtOutput("Ñuñoa\n")).toEqual([["Ñuñoa"]]);
  });

  it("parsea múltiples filas de múltiples columnas separadas por tab", () => {
    const raw = "14309-04\tProyecto X\n14310-05\tProyecto Y\n";
    expect(parseAtOutput(raw)).toEqual([
      ["14309-04", "Proyecto X"],
      ["14310-05", "Proyecto Y"],
    ]);
  });

  it("descarta líneas vacías (trailing newline de psql)", () => {
    expect(parseAtOutput("abc\n\n")).toEqual([["abc"]]);
  });

  it("devuelve [] para salida vacía", () => {
    expect(parseAtOutput("")).toEqual([]);
    expect(parseAtOutput("\n")).toEqual([]);
  });

  it("maneja CRLF (Windows)", () => {
    expect(parseAtOutput("col1\tcol2\r\ncol3\tcol4\r\n")).toEqual([
      ["col1", "col2"],
      ["col3", "col4"],
    ]);
  });

  it("preserva espacios dentro de una columna", () => {
    expect(parseAtOutput("idea matriz amplia\n")).toEqual([
      ["idea matriz amplia"],
    ]);
  });
});

// ──────────────────────────────────────────────────────────
// assertReadOnly: guarda read-only (SQL injection guard V5)
// ──────────────────────────────────────────────────────────
describe("assertReadOnly — SELECT-only guard", () => {
  // Casos válidos que deben PASAR (no lanzar)
  it("acepta SELECT simple", () => {
    expect(() => assertReadOnly("select 1")).not.toThrow();
  });

  it("acepta SELECT con mayúsculas", () => {
    expect(() => assertReadOnly("SELECT boletin FROM proyecto")).not.toThrow();
  });

  it("acepta WITH ... SELECT (CTE)", () => {
    expect(() =>
      assertReadOnly("with q as (select 1 as n) select * from q"),
    ).not.toThrow();
  });

  it("acepta SELECT con subquery", () => {
    expect(() =>
      assertReadOnly("select * from (select 1) t"),
    ).not.toThrow();
  });

  it("acepta SELECT con función de texto", () => {
    expect(() =>
      assertReadOnly(
        "select to_tsvector('spanish', unaccent(titulo)) from proyecto",
      ),
    ).not.toThrow();
  });

  // Casos de escritura que deben LANZAR
  it("lanza en INSERT", () => {
    expect(() =>
      assertReadOnly("insert into proyecto values ('x')"),
    ).toThrow(/prohibido/i);
  });

  it("lanza en UPDATE", () => {
    expect(() =>
      assertReadOnly("update proyecto set titulo = 'x'"),
    ).toThrow(/prohibido/i);
  });

  it("lanza en DELETE", () => {
    expect(() =>
      assertReadOnly("delete from proyecto where boletin = 'x'"),
    ).toThrow(/prohibido/i);
  });

  it("lanza en DROP", () => {
    expect(() => assertReadOnly("drop table proyecto")).toThrow(/prohibido/i);
  });

  it("lanza en ALTER", () => {
    expect(() =>
      assertReadOnly("alter table proyecto add column x text"),
    ).toThrow(/prohibido/i);
  });

  it("lanza en CREATE", () => {
    expect(() => assertReadOnly("create table hack (x text)")).toThrow(
      /prohibido/i,
    );
  });

  it("lanza en TRUNCATE", () => {
    expect(() => assertReadOnly("truncate proyecto")).toThrow(/prohibido/i);
  });

  it("lanza en GRANT", () => {
    expect(() =>
      assertReadOnly("grant select on proyecto to anon"),
    ).toThrow(/prohibido/i);
  });

  it("lanza en INSERT embebido en CTE (escritura oculta)", () => {
    expect(() =>
      assertReadOnly(
        "with cte as (insert into hack values ('x') returning *) select * from cte",
      ),
    ).toThrow(/prohibido/i);
  });

  it("lanza cuando el primer token no es select ni with", () => {
    expect(() => assertReadOnly("vacuum proyecto")).toThrow(/prohibido/i);
  });
});

// ──────────────────────────────────────────────────────────
// assertReadOnly: segunda pasada — detecta inyeccion en valores interpolados (CR-01)
// ──────────────────────────────────────────────────────────
describe("assertReadOnly — CR-01: injection-shaped param reaches final SQL", () => {
  it("detecta DROP TABLE en SQL final si el escape fuera bypasseado", () => {
    // La segunda pasada de assertReadOnly (sobre sqlWithParams) debe atrapar esto.
    // Representa el SQL final si un atacante inyecta DROP:
    const injectedSql = "select boletin from proyecto where titulo = 'hack'; DROP TABLE proyecto; --";
    expect(() => assertReadOnly(injectedSql)).toThrow(/prohibido/i);
  });

  it("detecta DELETE en SQL final si el escape fuera bypasseado", () => {
    const injectedSql = "select boletin from proyecto where titulo = 'x'; DELETE FROM proyecto WHERE id=1; --";
    expect(() => assertReadOnly(injectedSql)).toThrow(/prohibido/i);
  });

  it("no lanza en params seguros (texto de usuario normal, sin tokens prohibidos)", () => {
    // Query con param de usuario normal correctamente escapado — no debe lanzar
    const safeSql = "select boletin from proyecto where titulo = 'reforma laboral'";
    expect(() => assertReadOnly(safeSql)).not.toThrow();
  });
});
