import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Tests de /comparar (REL-03, 101-03). Verifican por COMPORTAMIENTO (HTML renderizado
 * + fuente):
 *
 *   1. force-dynamic exportado (gotcha Phase 45: gate/notFound jamás antes de
 *      searchParams → sin horneado estático).
 *   2. Sin params → empty state honesto (heading/body LOCKED), NUNCA 404/500.
 *   3. Orden canónico alfabético: A/B se ordenan por id sin importar el orden de la URL.
 *   4. Con a+b válidos → los 4 ejes factuales renderizan A/B + la línea de intersección.
 *   5. Zona de dos diputados (distrito/circ NULL) → "no comparten zona" (ausencia
 *      declarada, jamás implícita).
 *   6. Error de RPC LANZA (#34) — jamás degrada a "sin relaciones".
 *
 * NO toca PROD/DB: `@/lib/supabase` se mockea. El mock del roster trae dos diputados
 * (zona NULL) para ejercitar el vacío honesto de zona.
 */

// ── Mock de Supabase (rpc configurable por test) ─────────────────────────────────
// CR-01: `rpcImpl` recibe también los args ({ p_id }) — los fixtures del par pueden
// variar por dirección (lista de A ≠ lista de B).
type RpcResult = { data: unknown; error: unknown };
const rpcImpl =
  vi.fn<(name: string, args?: Record<string, unknown>) => Promise<RpcResult> | RpcResult>();

// Roster por defecto: dos diputados SIN zona (distrito/circ null) → ejercita el
// "no comparten zona" honesto (audit 101-01: Cámara sin distrito).
const ROSTER_DEFAULT = [
  {
    id: "D1001",
    nombre: "Ana Prueba",
    camara: "diputados",
    region: null,
    distrito: null,
    circunscripcion: null,
    periodo: "2022-2026",
    partido: null,
    partido_fecha_captura: null,
    partido_origen: null,
  },
  {
    id: "D1002",
    nombre: "Beto Prueba",
    camara: "diputados",
    region: null,
    distrito: null,
    circunscripcion: null,
    periodo: "2022-2026",
    partido: null,
    partido_fecha_captura: null,
    partido_origen: null,
  },
];

function setDefaultRpc() {
  rpcImpl.mockImplementation((name: string) => {
    switch (name) {
      case "parlamentarios_publico_v2":
        return { data: ROSTER_DEFAULT, error: null };
      case "militancia_historica_compartida":
        // D1002 comparte militancia histórica con D1001 (intersección presente).
        return {
          data: [{ id: "D1002", nombre: "Beto Prueba", camara: "diputados", total_n: 1 }],
          error: null,
        };
      case "comisiones_de_parlamentario":
        // Ambos comparten "Hacienda" (intersección de comisiones).
        return {
          data: [
            { nombre: "Hacienda", camara: "diputados", tipo: "permanente", cargo: null, origen: "camara", fecha_captura: "2026-01-01", enlace: null },
          ],
          error: null,
        };
      case "coautores_de_parlamentario_v2":
        // D1002 co-firmó 3 proyectos con D1001.
        return {
          data: [{ id: "D1002", nombre: "Beto Prueba", camara: "diputados", n_proyectos: 3, total_n: 1 }],
          error: null,
        };
      default:
        return { data: [], error: null };
    }
  });
}

// El cliente mock: rpc con 0 args (roster) devuelve el resultado directo (awaitable);
// con args ({p_id}) también. Devolvemos un thenable simple.
const rpcMock = vi.fn((name: string, args?: Record<string, unknown>) => {
  const r = rpcImpl(name, args);
  return Promise.resolve(r);
});
const createServerSupabaseMock = vi.fn(() => ({ rpc: rpcMock }));
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: () => createServerSupabaseMock(),
}));

// Importar DESPUÉS de los mocks.
import CompararPage, { CompararEjes } from "./page";
import { renderToStaticMarkup } from "react-dom/server";

const APP_ROOT = path.resolve(import.meta.dirname, "..", "..");

function makeProps(sp: Record<string, string | string[] | undefined>) {
  return { searchParams: Promise.resolve(sp) };
}

/**
 * Renderiza el SHELL de la página (heading + selector + empty-state cuando falta
 * selección). Con a+b válidos, el shell contiene un server child async
 * (`CompararEjes`) que `renderToStaticMarkup` NO resuelve — para el HTML de los ejes
 * se usa `renderEjes` (monta CompararEjes explícitamente, espejo de cómo la ficha
 * monta CarrilesSection a mano).
 */
async function renderPage(sp: Record<string, string | string[] | undefined>): Promise<string> {
  const element = await CompararPage(makeProps(sp));
  return renderToStaticMarkup(element as React.ReactElement);
}

/**
 * Resuelve y renderiza el server child async `CompararEjes` (los 4 ejes). Await-ea la
 * función server (React 19: un server component async es una función que retorna una
 * promesa de elemento) → obtiene el árbol resuelto → renderToStaticMarkup síncrono.
 */
async function renderEjes(a: string, b: string): Promise<string> {
  const element = await CompararEjes({ a, b, roster: ROSTER_DEFAULT as never });
  return renderToStaticMarkup(element as React.ReactElement);
}

beforeEach(() => {
  rpcImpl.mockReset();
  rpcMock.mockClear();
  createServerSupabaseMock.mockClear();
  setDefaultRpc();
});

// VSIM (5º eje gated): el flag se controla por env; limpiar tras cada test para no
// contaminar los demás (el default OFF debe re-establecerse siempre).
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("(1) /comparar force-dynamic", () => {
  it("exporta dynamic='force-dynamic' (gotcha Phase 45)", () => {
    const src = readFileSync(path.join(APP_ROOT, "app", "comparar", "page.tsx"), "utf-8");
    expect(src).toMatch(/export const dynamic\s*=\s*["']force-dynamic["']/);
  });

  it("lee searchParams (await) y NO importa notFound (sin params → empty, jamás 404)", () => {
    const src = readFileSync(path.join(APP_ROOT, "app", "comparar", "page.tsx"), "utf-8");
    // La ruta NO importa notFound de next/navigation → estructuralmente no puede 404.
    expect(src).not.toMatch(/import[\s\S]*?notFound[\s\S]*?from\s+["']next\/navigation["']/);
    expect(src).toMatch(/await searchParams/);
  });

  it("valida contra PARLAMENTARIO_ID_RE antes de cualquier .rpc()", () => {
    const src = readFileSync(path.join(APP_ROOT, "app", "comparar", "page.tsx"), "utf-8");
    expect(src).toMatch(/PARLAMENTARIO_ID_RE\.test/);
  });
});

describe("(2) empty state sin selección", () => {
  it("sin params → empty state con el copy LOCKED (no 404/500)", async () => {
    const html = await renderPage({});
    expect(html).toContain("Elige dos parlamentarios para compararlos.");
    expect(html).toContain("no ordena ni puntúa");
    // El heading de la página siempre está.
    expect(html).toContain("Comparar dos parlamentarios");
  });

  it("un solo parlamentario → sigue en empty state (faltan dos)", async () => {
    const html = await renderPage({ a: "D1001" });
    expect(html).toContain("Elige dos parlamentarios para compararlos.");
  });

  it("id inválido se descarta (no 500) → empty state", async () => {
    const html = await renderPage({ a: "no-es-id", b: "tampoco" });
    expect(html).toContain("Elige dos parlamentarios para compararlos.");
  });
});

describe("(3) orden canónico + (4) ejes factuales", () => {
  it("con a+b válidos → los 4 ejes renderizan con intersección factual", async () => {
    const html = await renderEjes("D1001", "D1002");
    // Los 4 headings de eje.
    expect(html).toContain("Militancia (histórica)");
    expect(html).toContain("Comisiones");
    expect(html).toContain("Co-autoría de proyectos");
    expect(html).toContain("Zona electoral");
    // Intersección de comisiones (Hacienda compartida).
    expect(html).toContain("Comparten 1");
    expect(html).toContain("Hacienda");
    // Intersección de co-autoría (3 proyectos).
    expect(html).toContain("Comparten 3");
  });

  it("los ejes montados NO muestran el empty state", async () => {
    const html = await renderEjes("D1001", "D1002");
    expect(html).not.toContain("Elige dos parlamentarios para compararlos.");
  });

  it("orden canónico: page.tsx ordena a/b alfabéticamente (.sort) antes de leer", () => {
    const src = readFileSync(path.join(APP_ROOT, "app", "comparar", "page.tsx"), "utf-8");
    // El orden canónico se aplica con .sort() sobre [sp.a, sp.b] filtrados.
    expect(src).toMatch(/\.filter\([\s\S]*?\)\s*\.sort\(\)/);
  });
});

describe("(5) zona de dos diputados → no comparten zona", () => {
  it("distrito/circ NULL → ausencia declarada 'no comparten zona'", async () => {
    const html = await renderEjes("D1001", "D1002");
    expect(html).toContain("no comparten zona");
  });
});

describe("(6) error de RPC LANZA (#34, jamás 'sin relaciones')", () => {
  it("un error de comisiones_de_parlamentario LANZA", async () => {
    rpcImpl.mockImplementation((name: string) => {
      if (name === "parlamentarios_publico_v2") return { data: ROSTER_DEFAULT, error: null };
      if (name === "comisiones_de_parlamentario") {
        return { data: null, error: { message: "boom" } };
      }
      if (name === "militancia_historica_compartida") return { data: [], error: null };
      if (name === "coautores_de_parlamentario_v2") return { data: [], error: null };
      return { data: [], error: null };
    });
    await expect(renderEjes("D1001", "D1002")).rejects.toThrow(/comisiones_de_parlamentario/);
  });

  it("un error del roster LANZA (no degrada a lista vacía)", async () => {
    rpcImpl.mockImplementation((name: string) => {
      if (name === "parlamentarios_publico_v2") return { data: null, error: { message: "db down" } };
      return { data: [], error: null };
    });
    await expect(renderPage({})).rejects.toThrow(/parlamentarios_publico_v2/);
  });
});

// ── CR-01: el par NO se decide desde listas truncadas (limit 20) ────────────────
describe("(8) CR-01 — intersección de par honesta ante truncamiento", () => {
  const filasTruncadas = (extra: Record<string, unknown> = {}) =>
    Array.from({ length: 20 }, (_, i) => ({
      id: `X${String(i + 1).padStart(4, "0")}`,
      nombre: `Relleno ${String(i + 1).padStart(2, "0")}`,
      camara: "diputados",
      total_n: 25,
      ...extra,
    }));

  it("ambas listas de militancia truncadas y sin match → NO declara ausencia; declara la limitación + conteo total_n", async () => {
    rpcImpl.mockImplementation((name: string) => {
      switch (name) {
        case "parlamentarios_publico_v2":
          return { data: ROSTER_DEFAULT, error: null };
        case "militancia_historica_compartida":
          // 20 filas (cap alcanzado) con total_n=25 y SIN el contraparte: la
          // membresía en la lista truncada NO permite afirmar ausencia.
          return { data: filasTruncadas(), error: null };
        default:
          return { data: [], error: null };
      }
    });
    const html = await renderEjes("D1001", "D1002");
    // JAMÁS una ausencia afirmada desde una lista cap-eada (copy viejo Y nuevo WR-02).
    expect(html).not.toContain("no comparten militancia");
    expect(html).not.toContain("no registran militancia");
    // La limitación se DECLARA (indeterminado honesto).
    expect(html).toContain("no permiten determinar");
    // El conteo de columna usa total_n (25), no el largo cap-eado (20).
    expect(html).toContain("25 parlamentarios");
    expect(html).not.toContain("20 parlamentarios");
  });

  it("lista bajo el cap de un lado y sin match → ausencia declarada (certeza)", async () => {
    rpcImpl.mockImplementation((name: string) => {
      switch (name) {
        case "parlamentarios_publico_v2":
          return { data: ROSTER_DEFAULT, error: null };
        case "militancia_historica_compartida":
          // 1 fila (bajo el cap) que NO es el contraparte → lista COMPLETA →
          // la no-membresía sí es un hecho → ausencia declarada.
          return {
            data: [{ id: "X0001", nombre: "Relleno", camara: "diputados", total_n: 1 }],
            error: null,
          };
        default:
          return { data: [], error: null };
      }
    });
    const html = await renderEjes("D1001", "D1002");
    // WR-02: la ausencia declarada se ACOTA a la semántica net-new de la RPC 0067
    // (excluye pares con alias vigente compartido) — jamás una ausencia absoluta.
    expect(html).toContain(
      "no registran militancia histórica compartida fuera del partido vigente",
    );
  });

  it("match SOLO en la dirección inversa (A en lista de B) → intersección presente con n_proyectos", async () => {
    rpcImpl.mockImplementation((name: string, args?: Record<string, unknown>) => {
      switch (name) {
        case "parlamentarios_publico_v2":
          return { data: ROSTER_DEFAULT, error: null };
        case "coautores_de_parlamentario_v2":
          if (args?.p_id === "D1002") {
            // La lista de B SÍ contiene a A (n_proyectos simétrico = 2).
            return {
              data: [
                { id: "D1001", nombre: "Ana Prueba", camara: "diputados", n_proyectos: 2, total_n: 1 },
              ],
              error: null,
            };
          }
          // La lista de A viene truncada (cap 20, total 30) y SIN B.
          return { data: filasTruncadas({ n_proyectos: 1, total_n: 30 }), error: null };
        default:
          return { data: [], error: null };
      }
    });
    const html = await renderEjes("D1001", "D1002");
    expect(html).toContain("Comparten 2");
    expect(html).not.toContain("no comparten proyectos co-firmados");
  });
});

// ── (3.3/DEBT-04) membresía de par completa — testigo D1178 × D1099 ─────────────
// La v2 (coautores_de_parlamentario_v2, 0083) lleva CAP_RPC_COAUTORES=1000: la
// membresía de par deja de truncar en silencio a 20. El testigo real D1178 (Héctor
// Ulloa Aguilera) × D1099 (Jaime Araya Guerrero) co-firma 92 boletines — hoy con la
// vieja (limit 20) esto se declara indeterminado; con la v2, se declara el hecho.
describe("(3.3/DEBT-04) membresía de par completa — testigo D1178 × D1099", () => {
  /** Lista larga programática con la fila real del par insertada. */
  function listaLarga(
    length: number,
    filaPar: { id: string; nombre: string; n_proyectos: number },
  ) {
    const relleno = Array.from({ length: length - 1 }, (_, i) => ({
      id: `R${String(i + 1).padStart(4, "0")}`,
      nombre: `Relleno ${String(i + 1).padStart(3, "0")}`,
      camara: "diputados",
      n_proyectos: 1,
      total_n: length,
    }));
    const fila = {
      id: filaPar.id,
      nombre: filaPar.nombre,
      camara: "diputados",
      n_proyectos: filaPar.n_proyectos,
      total_n: length,
    };
    return [...relleno, fila];
  }

  it("D1178 × D1099: la v2 declara el hecho 'Comparten 92 proyectos co-firmados' (no indeterminado)", async () => {
    // 91 co-autores de D1178 (incluye D1099 con n_proyectos=92); 82 de D1099
    // (incluye D1178 con n_proyectos=92, simétrico).
    const listaD1178 = listaLarga(91, { id: "D1099", nombre: "Jaime Araya Guerrero", n_proyectos: 92 });
    const listaD1099 = listaLarga(82, { id: "D1178", nombre: "Héctor Ulloa Aguilera", n_proyectos: 92 });
    rpcImpl.mockImplementation((name: string, args?: Record<string, unknown>) => {
      switch (name) {
        case "parlamentarios_publico_v2":
          return { data: ROSTER_DEFAULT, error: null };
        case "coautores_de_parlamentario_v2":
          return {
            data: args?.p_id === "D1099" ? listaD1099 : listaD1178,
            error: null,
          };
        default:
          return { data: [], error: null };
      }
    });
    const html = await renderEjes("D1178", "D1099");
    // Extracción numérica (no literal con dígitos pegados a markup — React
    // intercala `<!-- -->` entre texto y `<span>`, gotcha v6.1).
    const plano = html.replace(/<!--\s*-->/g, "");
    expect(plano).toContain("Comparten");
    expect(plano).toContain("92");
    expect(plano).toContain("proyectos co-firmados");
    expect(html).not.toContain("no permiten determinar si comparten proyectos co-firmados");
  });

  it("regresión del defecto: listas truncadas al cap de 1000 sin match y total_n>1000 → indeterminado citando 1000, no 20", async () => {
    // El cap de co-autoría es 1000 (CAP_RPC_COAUTORES), no 20 — la lista debe
    // alcanzar ESE cap para contar como truncada bajo la nueva disciplina.
    const filasTruncadasAlCap = Array.from({ length: 1000 }, (_, i) => ({
      id: `X${String(i + 1).padStart(4, "0")}`,
      nombre: `Relleno ${String(i + 1).padStart(4, "0")}`,
      camara: "diputados",
      n_proyectos: 1,
      total_n: 1005,
    }));
    rpcImpl.mockImplementation((name: string) => {
      switch (name) {
        case "parlamentarios_publico_v2":
          return { data: ROSTER_DEFAULT, error: null };
        case "coautores_de_parlamentario_v2":
          return { data: filasTruncadasAlCap, error: null };
        default:
          return { data: [], error: null };
      }
    });
    const html = await renderEjes("D1001", "D1002");
    expect(html).toContain("no permiten determinar si comparten proyectos co-firmados");
    // El copy cita el cap de la RPC v2 (1000), NUNCA el de militancia (20) — prueba
    // que el copy consume CAP_RPC_COAUTORES.
    expect(html).toContain("más de 1000 registros por parlamentario");
    expect(html).not.toContain("más de 20 registros por parlamentario");
  });

  it("control apareado anti-Pitfall-1: militancia con listas de 20 y total_n=40 sin match sigue INDETERMINADA (no ausente)", async () => {
    const militanciaTruncada20 = Array.from({ length: 20 }, (_, i) => ({
      id: `Y${String(i + 1).padStart(4, "0")}`,
      nombre: `Relleno ${String(i + 1).padStart(2, "0")}`,
      camara: "diputados",
      total_n: 40,
    }));
    rpcImpl.mockImplementation((name: string) => {
      switch (name) {
        case "parlamentarios_publico_v2":
          return { data: ROSTER_DEFAULT, error: null };
        case "militancia_historica_compartida":
          return { data: militanciaTruncada20, error: null };
        default:
          return { data: [], error: null };
      }
    });
    const html = await renderEjes("D1001", "D1002");
    // Si alguien subiera CAP_RPC a 1000, este test se pondría rojo (guard vivo
    // contra la ausencia falsa, T-131-10).
    expect(html).toContain("no permiten determinar");
    expect(html).not.toContain("no registran militancia histórica compartida");
  });
});

// ── CR-02: comisiones homónimas de cámaras distintas NO se comparten ────────────
describe("(9) CR-02 — intersección de comisiones por camara+nombre", () => {
  it("Hacienda (diputados) vs Hacienda (senadores) → 'no comparten comisiones' (dos órganos distintos)", async () => {
    rpcImpl.mockImplementation((name: string, args?: Record<string, unknown>) => {
      switch (name) {
        case "parlamentarios_publico_v2":
          return { data: ROSTER_DEFAULT, error: null };
        case "comisiones_de_parlamentario": {
          // Mismo NOMBRE, cámara distinta: el string solo NO es identidad.
          const camara = args?.p_id === "D1002" ? "senadores" : "diputados";
          return {
            data: [
              { nombre: "Hacienda", camara, tipo: "permanente", cargo: null, origen: "x", fecha_captura: "2026-01-01", enlace: null },
            ],
            error: null,
          };
        }
        default:
          return { data: [], error: null };
      }
    });
    const html = await renderEjes("D1001", "D1002");
    expect(html).toContain("no comparten comisiones");
    expect(html).not.toContain("Comparten 1");
  });

  it("misma cámara + mismo nombre → sí comparten (el fixture default ya lo cubre)", async () => {
    const html = await renderEjes("D1001", "D1002");
    expect(html).toContain("Comparten 1");
    expect(html).toContain("Hacienda");
  });
});

// ── WR-02 (102-REVIEW): comisiones con listas al cap (50, 0064) sin match →
//    INDETERMINADO declarado, jamás ausencia atribuida a fuente desde listas truncadas.
describe("(9b) WR-02 — comisiones cap-eadas sin match → indeterminado, no ausencia", () => {
  function comisionesFixture(prefijo: string) {
    return Array.from({ length: 50 }, (_, i) => ({
      nombre: `Comisión ${prefijo} ${String(i).padStart(2, "0")}`,
      camara: "diputados",
      tipo: "permanente",
      cargo: null,
      origen: "camara",
      fecha_captura: "2026-01-01",
      enlace: null,
    }));
  }

  it("ambas listas en el cap (50) y sin intersección → limitación declarada + nota de truncamiento", async () => {
    rpcImpl.mockImplementation((name: string, args?: Record<string, unknown>) => {
      switch (name) {
        case "parlamentarios_publico_v2":
          return { data: ROSTER_DEFAULT, error: null };
        case "comisiones_de_parlamentario":
          return {
            data: comisionesFixture(args?.p_id === "D1002" ? "B" : "A"),
            error: null,
          };
        default:
          return { data: [], error: null };
      }
    });
    const html = await renderEjes("D1001", "D1002");
    // La limitación se DECLARA; la ausencia con atribución de fuente NO se afirma.
    expect(html).toContain("no permiten determinar si comparten comisiones");
    expect(html).not.toContain("no comparten comisiones.");
    // Las columnas declaran el truncamiento del canal (a lo más 50 registros).
    expect(html).toContain("Lista posiblemente truncada");
  });

  it("listas cortas (bajo el cap) sin intersección → la ausencia declarada se mantiene", async () => {
    rpcImpl.mockImplementation((name: string, args?: Record<string, unknown>) => {
      switch (name) {
        case "parlamentarios_publico_v2":
          return { data: ROSTER_DEFAULT, error: null };
        case "comisiones_de_parlamentario":
          return {
            data: comisionesFixture(args?.p_id === "D1002" ? "B" : "A").slice(0, 3),
            error: null,
          };
        default:
          return { data: [], error: null };
      }
    });
    const html = await renderEjes("D1001", "D1002");
    expect(html).toContain("no comparten comisiones");
    expect(html).not.toContain("no permiten determinar si comparten comisiones");
    expect(html).not.toContain("Lista posiblemente truncada");
  });
});

// ── WR-01: fechas honestas (jamás una fecha de cobertura horneada en build) ─────
describe("(10) WR-01 — provenance con fecha honesta", () => {
  it("comisiones usa la fecha_captura de la FUENTE por fila; los ejes sin fecha_captura declaran la consulta", async () => {
    const html = await renderEjes("D1001", "D1002");
    // fecha_captura del fixture de comisiones → "según fuente al".
    // C-03 (129-04): el DÍA es el mismo del fixture (2026-01-01); cambia solo el
    // formato, del ISO al civil chileno del resto de la app.
    expect(html).toContain("según fuente al 01 ene 2026");
    // Militancia/co-autoría/zona no traen fecha_captura → "consultado al" (request-time).
    expect(html).toContain("consultado al ");
  });

  it("C-03: CERO fechas ISO en el DOM de los ejes; control positivo apareado en el mismo render", async () => {
    const html = await renderEjes("D1001", "D1002");
    // Control positivo PRIMERO: este render SÍ contiene fechas civiles…
    expect(html).toMatch(/\b\d{2} (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic) 20\d{2}\b/);
    // …y por tanto el cero de abajo es FUERTE, no vacuo.
    expect(html).not.toMatch(/20\d{2}-\d{2}-\d{2}/);
  });

  it("page.tsx NO hornea una constante de fecha de cobertura", () => {
    const src = readFileSync(path.join(APP_ROOT, "app", "comparar", "page.tsx"), "utf-8");
    expect(src).not.toMatch(/FECHA_COBERTURA/);
    // Ninguna fecha literal YYYY-MM-DD interpolada como "consultadas al" fijo.
    expect(src).not.toMatch(/consultadas al 20\d{2}-\d{2}-\d{2}/);
  });
});

// ── WR-06: el copy de COLUMNA de militancia acota la semántica net-new (0067) ───
describe("(11) WR-06 — columnas de militancia acotadas a la semántica net-new", () => {
  it("total_n=0 → la ausencia de columna se acota 'fuera del partido vigente' (jamás absoluta)", async () => {
    rpcImpl.mockImplementation((name: string) => {
      switch (name) {
        case "parlamentarios_publico_v2":
          return { data: ROSTER_DEFAULT, error: null };
        case "militancia_historica_compartida":
          // La RPC net-new devuelve 0 filas AUNQUE dos copartidarios vigentes
          // compartan historia (la exclusión es de la RPC, no de las fuentes) →
          // la columna JAMÁS puede afirmar una ausencia absoluta.
          return { data: [], error: null };
        default:
          return { data: [], error: null };
      }
    });
    const html = await renderEjes("D1001", "D1002");
    expect(html).toContain(
      "Sin militancia histórica compartida fuera del partido vigente registrada para",
    );
    // El copy viejo (ausencia ABSOLUTA sin acotar) no debe reaparecer.
    expect(html).not.toContain("Sin militancia histórica compartida registrada para");
  });

  it("total_n>0 → el conteo de columna declara 'sin contar el partido vigente compartido'", async () => {
    // Fixture default: militancia con total_n=1 en ambas direcciones.
    const html = await renderEjes("D1001", "D1002");
    expect(html).toContain("parlamentario militó en un mismo partido que");
    expect(html).toContain("sin contar el partido vigente compartido");
  });
});

// ── VSIM: 5º eje de similitud de votación, GATED (VSIM-01/VSIM-02) ───────────────
// Flag OFF (default/PROD) ⇒ sección AUSENTE del DOM, cero .rpc. Flag ON (preview
// local) ⇒ figura neutral + caveat. M=0 ⇒ degradado honesto, jamás "0%".
describe("(12) VSIM — 5º eje gated (similitud de votación)", () => {
  // Setup del rpcMock que ADEMÁS responde coincidencia_votos_par.
  function setRpcConVsim(vsim: {
    n_coinciden: number;
    m_compartidas: number;
    fecha_captura_max: string | null;
  }) {
    rpcImpl.mockImplementation((name: string) => {
      switch (name) {
        case "parlamentarios_publico_v2":
          return { data: ROSTER_DEFAULT, error: null };
        case "militancia_historica_compartida":
          return { data: [], error: null };
        case "comisiones_de_parlamentario":
          return { data: [], error: null };
        case "coautores_de_parlamentario_v2":
          return { data: [], error: null };
        case "coincidencia_votos_par":
          return { data: [vsim], error: null };
        default:
          return { data: [], error: null };
      }
    });
  }

  it("flag OFF (ausente) → la sección NO existe en el DOM y NO se llama la RPC", async () => {
    // Sin vi.stubEnv → VSIM_PUBLIC_ENABLED ausente → vsimPublicEnabled=false.
    setRpcConVsim({ n_coinciden: 3, m_compartidas: 4, fecha_captura_max: "2026-07-24" });
    const html = await renderEjes("D1001", "D1002");
    expect(html).not.toContain("Similitud de votación");
    expect(html).not.toContain("La coincidencia alta es la norma");
    // Cero llamadas a la RPC gated (el return null es ANTES del fetch).
    const llamadasVsim = rpcMock.mock.calls.filter(
      (c) => c[0] === "coincidencia_votos_par",
    );
    expect(llamadasVsim).toHaveLength(0);
  });

  it("flag = 'false' explícito → sigue ausente (fail-closed, no truthiness laxa)", async () => {
    vi.stubEnv("VSIM_PUBLIC_ENABLED", "false");
    setRpcConVsim({ n_coinciden: 3, m_compartidas: 4, fecha_captura_max: "2026-07-24" });
    const html = await renderEjes("D1001", "D1002");
    expect(html).not.toContain("Similitud de votación");
  });

  it("flag ON + rpc con datos → sección + caveat + figura NEUTRAL (sin acento)", async () => {
    vi.stubEnv("VSIM_PUBLIC_ENABLED", "true");
    setRpcConVsim({ n_coinciden: 3, m_compartidas: 4, fecha_captura_max: "2026-07-24" });
    const html = await renderEjes("D1001", "D1002");
    expect(html).toContain("Similitud de votación");
    expect(html).toContain("La coincidencia alta es la norma");
    // % computado en el server: round(3/4·100) = 75.
    expect(html).toContain("Coinciden en 3 de 4 votaciones compartidas (75%).");
    // Cobertura declarada + provenance.
    expect(html).toContain("Cobertura del voto: Cámara ~80%");
    expect(html).toContain("según fuente al");
    // La figura NO lleva el resaltado petróleo/bold de los ejes factuales.
    // WR-04 (102-REVIEW): asertar sobre el PÁRRAFO COMPLETO que contiene la figura
    // (del `<p` que la abre hasta su `</p>`), no una ventana solo-ANTERIOR — un
    // <span className="font-semibold text-accent-product"> envolviendo el "75%"
    // abriría su tag DESPUÉS de figuraIdx y pasaría la ventana anterior verbatim.
    const figuraIdx = html.indexOf("Coinciden en 3 de 4");
    expect(figuraIdx).toBeGreaterThan(-1);
    const abreP = html.lastIndexOf("<p", figuraIdx);
    const cierraP = html.indexOf("</p>", figuraIdx);
    expect(abreP).toBeGreaterThan(-1);
    expect(cierraP).toBeGreaterThan(figuraIdx);
    const parrafoFigura = html.slice(abreP, cierraP + "</p>".length);
    expect(parrafoFigura).toContain("Coinciden en 3 de 4");
    expect(parrafoFigura).not.toContain("text-accent-product");
    expect(parrafoFigura).not.toContain("font-semibold");
  });

  it("flag ON + m=0 → copy degradado honesto, JAMÁS '0%'", async () => {
    vi.stubEnv("VSIM_PUBLIC_ENABLED", "true");
    setRpcConVsim({ n_coinciden: 0, m_compartidas: 0, fecha_captura_max: null });
    const html = await renderEjes("D1001", "D1002");
    expect(html).toContain("Similitud de votación");
    expect(html).toContain(
      "Sin votaciones compartidas suficientes en las fuentes consultadas al",
    );
    expect(html).not.toContain("0%");
    // Sin figura ni provenance en el estado degradado.
    expect(html).not.toContain("Coinciden en");
  });

  it("flag ON + error real de la RPC LANZA (#34, jamás degrada a 'sin votaciones')", async () => {
    vi.stubEnv("VSIM_PUBLIC_ENABLED", "true");
    rpcImpl.mockImplementation((name: string) => {
      if (name === "parlamentarios_publico_v2") return { data: ROSTER_DEFAULT, error: null };
      if (name === "coincidencia_votos_par") return { data: null, error: { message: "boom" } };
      return { data: [], error: null };
    });
    await expect(renderEjes("D1001", "D1002")).rejects.toThrow(/coincidencia_votos_par/);
  });

  it("el 5º eje es el ÚLTIMO sibling del return de CompararEjes (después de ejeZona)", () => {
    const src = readFileSync(path.join(APP_ROOT, "app", "comparar", "page.tsx"), "utf-8");
    // ejeSimilitud aparece tras ejeZona en el return fragment.
    expect(src).toMatch(/\{ejeZona\}\s*\{ejeSimilitud\}/);
    // page.tsx importa el gate (anti-flip V3: nunca lee process.env crudo del flag).
    expect(src).toMatch(/vsimPublicEnabled/);
    expect(src).not.toMatch(/process\.env\.VSIM_PUBLIC_ENABLED/);
  });
});

// ── Candados de régimen ────────────────────────────────────────────────────────
describe("(7) candados de régimen (cero-hex, tokens tipográficos)", () => {
  it("comparar/page.tsx no usa hex ni text-[Npx] en el copy", () => {
    const src = readFileSync(path.join(APP_ROOT, "app", "comparar", "page.tsx"), "utf-8");
    // Cero hex de color (#rrggbb / #rgb) en className.
    expect(src).not.toMatch(/className=["'][^"']*#[0-9a-fA-F]{3,6}/);
    // Cero text-[Npx] arbitrario.
    expect(src).not.toMatch(/text-\[\d+px\]/);
  });
});
