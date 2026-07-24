import { describe, it, expect, vi, beforeEach } from "vitest";
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
type RpcResult = { data: unknown; error: unknown };
const rpcImpl = vi.fn<(name: string) => Promise<RpcResult> | RpcResult>();

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
      case "coautores_de_parlamentario":
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
const rpcMock = vi.fn((name: string) => {
  const r = rpcImpl(name);
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
      if (name === "coautores_de_parlamentario") return { data: [], error: null };
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
