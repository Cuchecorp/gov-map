/**
 * GATE del golden set DIPID→id_maestra (VOTO-03) — corre en CI, bloquea el deploy si el
 * contrato del cruce de votos se rompe. Mira el patrón de `packages/adjudication/src/golden/
 * golden-set.test.ts` (describe/it + aserciones de umbral), pero aquí el "umbral" son
 * invariantes DUROS + un contrato FAIL-CLOSED contra el reconciliador REAL.
 *
 * Cubre:
 *  - SC#1: golden derivado + validado (≥150, DIPIDs únicos, periodo único "2026-2030", todos
 *    confirmado) + recycle-trap (periodo mismatcheado → fail-closed).
 *  - SC#2: anti-name-match grep-gate diff-checkable (ni normalizarNombre/correrPipeline/adjudic/
 *    LLMProvider en el camino de votos).
 *  - SC#3: DIPID conocido → confirmado con el idMaestra correcto; DIPID DESCONOCIDO → no_confirmado
 *    con parlamentario_id=null, asertado contra el reconciliador REAL `reconciliarVotosCamara`.
 *
 * 100% offline: lee el seed del repo vía `cargarMaestra` y llama funciones puras. Sin red, sin DB.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  cargarMaestra,
  findWorkspaceRoot,
  reconciliarVotosCamara,
  aplanarVoto,
  type CamaraVotoDetalle,
} from "@obs/tramitacion";
import {
  derivarGoldenDipid,
  validarGoldenDipid,
  PERIODO_VIGENTE,
} from "./golden-dipid";

// La maestra REAL del seed autoritativo (155 diputados). Cargada UNA vez para todos los tests.
const maestra = cargarMaestra(findWorkspaceRoot(process.cwd()), () => {});
const golden = derivarGoldenDipid(maestra);

describe("golden set DIPID→id_maestra — invariantes (SC#1)", () => {
  it("valida sin lanzar y expone ≥150 filas del periodo vigente", () => {
    expect(() => validarGoldenDipid(golden, maestra)).not.toThrow();
    expect(golden.length).toBeGreaterThanOrEqual(150);
  });

  it("los DIPIDs son únicos (0 duplicados)", () => {
    const dipids = new Set(golden.map((r) => r.dipid));
    expect(dipids.size).toBe(golden.length);
  });

  it("hay un solo periodo entre los diputados vigentes y es '2026-2030'", () => {
    const periodos = new Set(
      maestra
        .filter((p) => p.camara === "diputados" && p.id_diputado_camara)
        .map((p) => p.periodo),
    );
    expect(periodos.size).toBe(1);
    expect([...periodos][0]).toBe(PERIODO_VIGENTE);
  });

  it("todo diputado vigente sourced está en estado 'confirmado' (A1)", () => {
    const diputados = maestra.filter(
      (p) => p.camara === "diputados" && p.id_diputado_camara,
    );
    expect(diputados.every((p) => p.estado === "confirmado")).toBe(true);
  });

  it("todo idMaestra es no-vacío", () => {
    expect(golden.every((r) => r.idMaestra.length > 0)).toBe(true);
  });
});

describe("cruce voto→persona contra el reconciliador REAL (SC#3, fail-closed)", () => {
  it("un DIPID CONOCIDO del golden → confirmado con el idMaestra correcto (positivo)", () => {
    const conocido = golden[0]!;
    const votos: CamaraVotoDetalle[] = [
      { diputadoId: conocido.dipid, opcion: "si", nombreCrudo: "x" },
    ];
    const [ok] = reconciliarVotosCamara(votos, "camara:1", maestra, {
      periodo: PERIODO_VIGENTE,
    });
    expect(ok!.estado_vinculo).toBe("confirmado");
    expect(ok!.enlace?.parlamentarioId).toBe(conocido.idMaestra);
    expect(aplanarVoto(ok!).parlamentario_id).toBe(conocido.idMaestra);
  });

  it("un DIPID DESCONOCIDO ('999999') → no_confirmado / parlamentario_id=null (FAIL-CLOSED)", () => {
    // "999999" está garantizado FUERA del golden (los DIPID del seed no lo incluyen).
    expect(golden.some((r) => r.dipid === "999999")).toBe(false);
    const votos: CamaraVotoDetalle[] = [
      { diputadoId: "999999", opcion: "si", nombreCrudo: "Persona Fuera De La Maestra" },
    ];
    const [nc] = reconciliarVotosCamara(votos, "camara:1", maestra, {
      periodo: PERIODO_VIGENTE,
    });
    expect(nc!.estado_vinculo).toBe("no_confirmado");
    expect(nc!.enlace).toBeNull();
    expect(aplanarVoto(nc!).parlamentario_id).toBeNull();
  });

  it("un DIPID CONOCIDO con periodo MISMATCHEADO ('2018-2022') → no_confirmado / null (recycle-trap, SC#1)", () => {
    const conocido = golden[0]!;
    const votos: CamaraVotoDetalle[] = [
      { diputadoId: conocido.dipid, opcion: "si", nombreCrudo: "x" },
    ];
    // El scoping cross-periodo fail-cierra: el DIPID solo existe en 2026-2030, no en 2018-2022.
    const [nc] = reconciliarVotosCamara(votos, "camara:1", maestra, {
      periodo: "2018-2022",
    });
    expect(nc!.estado_vinculo).toBe("no_confirmado");
    expect(nc!.enlace).toBeNull();
    expect(aplanarVoto(nc!).parlamentario_id).toBeNull();
  });
});

describe("anti-name-match grep-gate — el camino de votos es DIPID-determinista PUNTO (SC#2)", () => {
  // Espejo del grep-gate de fase 09 (confirmar( no aparece en writers): un name-match/LLM que se
  // cuele como "fallback" cuando el DIPID no resuelve reintroduciría el riesgo #1 (atribución por
  // nombre). Este test lee el fuente del path de votos y asierta la AUSENCIA de esos símbolos.
  const PROHIBIDOS = [/normalizarNombre/, /correrPipeline/, /adjudic/i, /LLMProvider/];

  // Escanear CÓDIGO, no comentarios: `reconciliar-camara.ts` documenta en su cabecera que
  // "NO requiere LLM ni correrPipeline" — un comentario que NIEGA el símbolo NO es una fuga.
  // La fuga real es un import/uso EJECUTABLE. Se strippean comentarios de bloque y de línea
  // antes de asertar (defensa contra el falso positivo del comentario-negación).
  function soloCodigo(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, "") // comentarios de bloque
      .replace(/\/\/.*$/gm, ""); // comentarios de línea
  }

  // `import.meta.dirname` (NO `new URL(import.meta.url)`) — gotcha MEMORY: la forma URL rompe
  // readFileSync bajo ciertos entornos. dirname = packages/votos/src.
  const votosSrc = import.meta.dirname;
  const repoRoot = findWorkspaceRoot(process.cwd());
  const reconciliarCamaraPath = resolve(
    repoRoot,
    "packages/tramitacion/src/reconciliar-camara.ts",
  );

  // Todos los .ts de packages/votos/src EXCLUYENDO tests (.test.ts / .test-d.ts / .live.test.ts).
  const votosFiles = readdirSync(votosSrc)
    .filter((f) => f.endsWith(".ts"))
    .filter((f) => !/\.(test|test-d|live\.test)\.ts$/.test(f))
    .map((f) => resolve(votosSrc, f));

  const archivos = [reconciliarCamaraPath, ...votosFiles];

  for (const path of archivos) {
    it(`${path.replace(repoRoot, "").replace(/\\/g, "/")} NO contiene name-match/LLM`, () => {
      const src = soloCodigo(readFileSync(path, "utf8"));
      for (const re of PROHIBIDOS) {
        expect(src, `patrón prohibido ${re} en el CÓDIGO de ${path}`).not.toMatch(re);
      }
    });
  }
});
