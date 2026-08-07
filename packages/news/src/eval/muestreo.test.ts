import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  prngDeSemilla,
  ordenarPorHash,
  contieneTokenPrefijo,
  elegiblesSonda,
  muestrear,
  hashComposicion,
} from "./muestreo";
import type { PoolCaso } from "./pool-r2";

const AQUI = dirname(fileURLToPath(import.meta.url));

function caso(overrides: Partial<PoolCaso> & { caso_id: string; url_hash: string }): PoolCaso {
  return {
    caso_id: overrides.caso_id,
    url_hash: overrides.url_hash,
    url_canonica: overrides.url_canonica ?? "https://www.latercera.com/x",
    outlet: overrides.outlet ?? "latercera",
    estado: overrides.estado ?? "descarta",
    causa: overrides.causa ?? "prefiltro_lexico",
    titulo: overrides.titulo ?? "Titular genérico",
    descripcion: overrides.descripcion ?? "Bajada genérica",
    fecha_pub: overrides.fecha_pub ?? null,
    r2_path: overrides.r2_path ?? "news/rss-latercera/2026-08-05/x.xml",
    date_bucket: overrides.date_bucket ?? "2026-08-05",
  };
}

describe("muestreo — Task 1: PRNG determinista + orden total", () => {
  it("(a) prngDeSemilla da la misma secuencia en dos instancias con la misma semilla", () => {
    const a = prngDeSemilla("133-b-golden-2026");
    const b = prngDeSemilla("133-b-golden-2026");
    const secA = Array.from({ length: 10 }, () => a());
    const secB = Array.from({ length: 10 }, () => b());
    expect(secA).toEqual(secB);
  });

  it("(b) dos semillas distintas dan secuencias distintas", () => {
    const a = prngDeSemilla("133-b-golden-2026");
    const b = prngDeSemilla("133-b-golden-2026-X");
    const secA = Array.from({ length: 10 }, () => a());
    const secB = Array.from({ length: 10 }, () => b());
    expect(secA).not.toEqual(secB);
  });

  it("(c) ordenarPorHash es orden total: un array y su reverso ordenan igual", () => {
    const hashes = ["ccc", "aaa", "eee", "bbb", "ddd"];
    const casos = hashes.map((h, i) => caso({ caso_id: `c${i}`, url_hash: h }));
    const directo = ordenarPorHash(casos).map((c) => c.url_hash);
    const reverso = ordenarPorHash([...casos].reverse()).map((c) => c.url_hash);
    expect(directo).toEqual(reverso);
    expect(directo).toEqual(["aaa", "bbb", "ccc", "ddd", "eee"]);
  });
});

describe("muestreo — Task 2: estratos disjuntos, sonda con prefijo CONGELADO", () => {
  it("(a) contieneTokenPrefijo casa por prefijo de palabra: subsecretaria cuenta para subsecretari", () => {
    expect(contieneTokenPrefijo("el ministerio anuncio a la nueva subsecretaria de estado", "subsecretari")).toBe(
      true,
    );
  });

  it("(b) control negativo de substring: administrador NO cuenta para ministro", () => {
    expect(contieneTokenPrefijo("el administrador del edificio renuncio", "ministro")).toBe(false);
  });

  it("(c) solo entran casos con estado de descarte: un pasa con token institucional NO es sonda", () => {
    const casos = [
      caso({ caso_id: "p1", url_hash: "hp1", estado: "pasa", causa: null, titulo: "El ministro anuncio" }),
      caso({ caso_id: "d1", url_hash: "hd1", estado: "descarta", titulo: "El ministro anuncio" }),
    ];
    const sonda = elegiblesSonda(casos);
    expect(sonda.map((c) => c.caso_id)).toEqual(["d1"]);
  });

  it("(d) determinismo: dos corridas con la misma semilla dan la misma lista", () => {
    const pool = construirPoolSintetico();
    const r1 = muestrear({ pool, semilla: "sem-fija", nSonda: 2, nAlea: 2 });
    const r2 = muestrear({ pool, semilla: "sem-fija", nSonda: 2, nAlea: 2 });
    expect(r1.alea.map((c) => c.url_hash)).toEqual(r2.alea.map((c) => c.url_hash));
    expect(r1.sonda.map((c) => c.url_hash)).toEqual(r2.sonda.map((c) => c.url_hash));
  });

  it("(e) control negativo: otra semilla da N-alea distinto", () => {
    const pool = construirPoolSintetico();
    const r1 = muestrear({ pool, semilla: "sem-fija", nSonda: 2, nAlea: 4 });
    const r2 = muestrear({ pool, semilla: "sem-fija-otra", nSonda: 2, nAlea: 4 });
    expect(r1.alea.map((c) => c.url_hash)).not.toEqual(r2.alea.map((c) => c.url_hash));
  });

  it("(f) N-sonda y N-alea son disjuntos, y la sonda se toma primero", () => {
    const pool = construirPoolSintetico();
    const r = muestrear({ pool, semilla: "sem-fija", nSonda: 2, nAlea: 4 });
    const idsSonda = new Set(r.sonda.map((c) => c.url_hash));
    const idsAlea = new Set(r.alea.map((c) => c.url_hash));
    const interseccion = [...idsSonda].filter((h) => idsAlea.has(h));
    expect(interseccion).toEqual([]);
  });

  it("(g) muestrear LANZA si un estrato tiene menos elegibles que el n pedido", () => {
    const pool = construirPoolSintetico();
    expect(() => muestrear({ pool, semilla: "sem-fija", nSonda: 999, nAlea: 4 })).toThrow();
  });

  it("(h) P es censo: entran TODOS los pasa, en orden por url_hash, ninguno se sortea", () => {
    const pool = construirPoolSintetico();
    const pasaEsperado = ordenarPorHash(pool.filter((c) => c.estado === "pasa")).map((c) => c.url_hash);
    const r = muestrear({ pool, semilla: "sem-fija", nSonda: 2, nAlea: 4 });
    expect(r.P).toHaveLength(pasaEsperado.length);
    // Orden exacto por url_hash, no barajado: un P sorteado (aunque conservara el largo) no
    // produciría necesariamente este orden ascendente estable.
    expect(r.P.map((c) => c.url_hash)).toEqual(pasaEsperado);
  });

  it("(i) la regla queda CONGELADA sobre el pool real: elegiblesSonda(descartes).length === 60 y subsecretari aporta 4", () => {
    const poolReal = JSON.parse(readFileSync(join(AQUI, "pool-133b.json"), "utf8")) as PoolCaso[];
    const descartes = poolReal.filter((c) => c.estado !== "pasa");
    expect(descartes.length).toBeGreaterThanOrEqual(505);
    const elegibles = elegiblesSonda(descartes);
    expect(elegibles.length).toBe(60);
    const conSubsecretari = descartes.filter((c) => {
      const texto = `${c.titulo} ${c.descripcion ?? ""}`;
      return contieneTokenPrefijo(
        texto
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase(),
        "subsecretari",
      );
    });
    expect(conSubsecretari.length).toBe(4);
  });
});

describe("muestreo — Task 3: hash de composición + no-filtrado por descripción", () => {
  it("(a) hashComposicion cambia si cambia un caso_id", () => {
    const base = [
      { caso_id: "a:1", estrato: "P" },
      { caso_id: "b:2", estrato: "sonda" },
    ];
    const cambiada = [
      { caso_id: "a:1", estrato: "P" },
      { caso_id: "c:3", estrato: "sonda" },
    ];
    expect(hashComposicion(base)).not.toBe(hashComposicion(cambiada));
  });

  it("(b) hashComposicion NO cambia al reordenar la entrada", () => {
    const orden1 = [
      { caso_id: "a:1", estrato: "P" },
      { caso_id: "b:2", estrato: "sonda" },
      { caso_id: "c:3", estrato: "alea" },
    ];
    const orden2 = [orden1[2]!, orden1[0]!, orden1[1]!];
    expect(hashComposicion(orden1)).toBe(hashComposicion(orden2));
  });

  it("(c) el muestreo NO filtra por descripción: población sintética 50% sin bajada, la muestra contiene >=1 sin descripción", () => {
    const pool: PoolCaso[] = [];
    for (let i = 0; i < 20; i++) {
      pool.push(
        caso({
          caso_id: `desc${i}`,
          url_hash: `hash-desc-${String(i).padStart(3, "0")}`,
          estado: "descarta",
          titulo: `Noticia ${i}`,
          descripcion: i % 2 === 0 ? "" : "Alguna bajada no vacía aqui",
        }),
      );
    }
    const r = muestrear({ pool, semilla: "sem-desc", nSonda: 0, nAlea: 10 });
    const sinDescripcion = r.alea.filter((c) => (c.descripcion ?? "").trim().length === 0);
    expect(sinDescripcion.length).toBeGreaterThanOrEqual(1);
  });
});

/** Población sintética pequeña: 1 pasa, 3 descartes elegibles de sonda, 3 descartes no elegibles. */
function construirPoolSintetico(): PoolCaso[] {
  const pool: PoolCaso[] = [
    caso({ caso_id: "pasa0", url_hash: "hpasa0", estado: "pasa", causa: null }),
    caso({ caso_id: "pasa1", url_hash: "hpasa1", estado: "pasa", causa: null }),
    caso({ caso_id: "pasa2", url_hash: "hpasa2", estado: "pasa", causa: null }),
    caso({ caso_id: "pasa3", url_hash: "hpasa3", estado: "pasa", causa: null }),
    caso({ caso_id: "pasa4", url_hash: "hpasa4", estado: "pasa", causa: null }),
    caso({ caso_id: "pasa5", url_hash: "hpasa5", estado: "pasa", causa: null }),
    caso({ caso_id: "elegible1", url_hash: "helig001", estado: "descarta", titulo: "Anuncia el ministro" }),
    caso({ caso_id: "elegible2", url_hash: "helig002", estado: "descarta", titulo: "Habla el presidente" }),
    caso({ caso_id: "elegible3", url_hash: "helig003", estado: "descarta", titulo: "Nueva subsecretaria" }),
    caso({ caso_id: "resto1", url_hash: "hrest001", estado: "descarta", titulo: "Accidente de transito" }),
    caso({ caso_id: "resto2", url_hash: "hrest002", estado: "descarta", titulo: "Partido de futbol" }),
    caso({ caso_id: "resto3", url_hash: "hrest003", estado: "descarta", titulo: "Clima soleado" }),
    caso({ caso_id: "resto4", url_hash: "hrest004", estado: "descarta", titulo: "Concierto de musica" }),
  ];
  return pool;
}
