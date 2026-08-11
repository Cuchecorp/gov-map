import { describe, it, expect } from "vitest";
import {
  assertAllowlistNoVacia,
  resolverBoletin,
  resolverParlamentario,
  normalizarNombre,
  type AllowlistResolver,
} from "./resolver";
import { construirAllowlist } from "./allowlist";
import { DeadLetterRowSchema, DeadLetterPayloadSchema } from "./dead-letter";
import { construirEmisionRequest, aplicarUmbral, EmisionSchema, UMBRAL_CONFIANZA } from "./emision";
import { procesarLoteAllOrNothing } from "./gate";

function allowlistFixture(): AllowlistResolver {
  return construirAllowlist(
    ["14309-04", "20730", "18296-05", "18296-07"],
    [
      {
        id: "P00001",
        nombre_normalizado: "fidel espinoza sandoval",
        nombres: "Fidel",
        apellido_paterno: "Espinoza",
        apellido_materno: "Sandoval",
      },
      {
        id: "P00002",
        nombre_normalizado: "maria jose gatica bertin",
        nombres: "María José",
        apellido_paterno: "Gatica",
        apellido_materno: "Bertín",
      },
      // Homónimo deliberado de apellido: segundo "Espinoza" para probar ambigüedad.
      {
        id: "P00003",
        nombre_normalizado: "marcos espinoza monardes",
        nombres: "Marcos",
        apellido_paterno: "Espinoza",
        apellido_materno: "Monardes",
      },
      // Tercer "Espinoza" que ADEMÁS comparte "Sandoval" con P00001: hace que el token-set
      // "espinoza sandoval" tenga DOS candidatos reales (guardia de la mutación >= 1).
      {
        id: "P00005",
        nombre_normalizado: "maria espinoza sandoval",
        nombres: "María",
        apellido_paterno: "Espinoza",
        apellido_materno: "Sandoval",
      },
      // Homónimos EXACTOS (mismo nombre completo, dos personas): la clave exacta debe ser
      // irresoluble.
      {
        id: "P00006",
        nombre_normalizado: "pedro perez soto",
        nombres: "Pedro",
        apellido_paterno: "Pérez",
        apellido_materno: "Soto",
      },
      {
        id: "P00007",
        nombre_normalizado: "pedro perez soto",
        nombres: "Pedro",
        apellido_paterno: "Pérez",
        apellido_materno: "Soto",
      },
    ],
    [{ parlamentario_id: "P00001", alias: "Fidel Espinoza S." }],
  );
}

describe("resolver — SC1 allowlist LOUD", () => {
  it("(a) allowlist vacía LANZA antes de procesar (boletines y parlamentarios)", () => {
    expect(() =>
      assertAllowlistNoVacia({
        boletines: new Set(),
        parlamentarios: new Map([["x", ["1"]]]),
        apellidos: new Set(["x"]),
      }),
    ).toThrow(/VACÍA/);
    expect(() =>
      assertAllowlistNoVacia({ boletines: new Set(["1-1"]), parlamentarios: new Map(), apellidos: new Set() }),
    ).toThrow(/VACÍA/);
    expect(() =>
      resolverBoletin("14309-04", { boletines: new Set(), parlamentarios: new Map(), apellidos: new Set() }),
    ).toThrow();
    expect(() =>
      construirEmisionRequest({
        allowlist: { boletines: new Set(), parlamentarios: new Map(), apellidos: new Set() },
        titulo: "t",
        descripcion: "d",
      }),
    ).toThrow();
  });
});

describe("resolver — resolverBoletin (SC2: null, jamás best-guess)", () => {
  const al = allowlistFixture();

  it("(b) match exacto con sufijo", () => {
    expect(resolverBoletin("14309-04", al)).toBe("14309-04");
    expect(resolverBoletin("14.309-04", al)).toBe("14309-04");
  });

  it("(c) base sin sufijo: resuelve SOLO si es única en la lista", () => {
    expect(resolverBoletin("14309", al)).toBe("14309-04"); // única
    expect(resolverBoletin("20730", al)).toBe("20730"); // existe pelada
    expect(resolverBoletin("18296", al)).toBeNull(); // dos sufijos ⇒ ambiguo ⇒ null
  });

  it("(d) fuera de lista, basura y vacío ⇒ null", () => {
    expect(resolverBoletin("99999-99", al)).toBeNull();
    // Confusión ley/boletín: una emisión que dice "Ley" NO es una emisión de boletín,
    // aunque el número exista en la lista — el falso positivo exacto de la regla LOCKED.
    expect(resolverBoletin("Ley 20.730", al)).toBeNull();
    expect(resolverBoletin("Ley 20.730 completa", al)).toBeNull();
    expect(resolverBoletin("no es un boletín", al)).toBeNull();
    expect(resolverBoletin("", al)).toBeNull();
    expect(resolverBoletin(null, al)).toBeNull();
  });

  it("(d2) prefijo declarativo 'boletín' en la emisión pelada sí se acepta", () => {
    expect(resolverBoletin("boletín 20730", al)).toBe("20730");
    expect(resolverBoletin("bol. 14309", al)).toBe("14309-04");
  });
});

describe("resolver — resolverParlamentario (A2.3 fail-closed)", () => {
  const al = allowlistFixture();

  it("(e) nombre completo, variante nombres+paterno, y alias resuelven al id", () => {
    expect(resolverParlamentario("Fidel Espinoza Sandoval", al)).toBe("P00001");
    expect(resolverParlamentario("fidel espinoza", al)).toBe("P00001");
    expect(resolverParlamentario("Fidel Espinoza S.", al)).toBe("P00001");
    expect(resolverParlamentario("María José Gatica", al)).toBe("P00002");
    expect(resolverParlamentario("maria jose gatica bertin", al)).toBe("P00002");
  });

  it("(f) apellido suelto JAMÁS resuelve, ni siquiera sin homónimos", () => {
    expect(resolverParlamentario("Espinoza", al)).toBeNull();
    expect(resolverParlamentario("Gatica", al)).toBeNull(); // única, pero suelta ⇒ null igual
  });

  it("(g) token-set con DOS candidatos reales ⇒ null (jamás best-guess; guardia de la mutación >=1)", () => {
    // "espinoza sandoval" está contenido tanto en "fidel espinoza sandoval" (P00001) como
    // en "maria espinoza sandoval" (P00005): 2 candidatos ⇒ null. La mutación
    // `candidatos.size >= 1` devolvería uno de los dos — un vínculo fabricado.
    expect(resolverParlamentario("Espinoza Sandoval", al)).toBeNull();
    // Cero candidatos también es null (ausencia, control apareado del mismo camino).
    expect(resolverParlamentario("Juan Espinoza", al)).toBeNull();
  });

  it("(g2) homónimos EXACTOS: la clave exacta con dos ids ⇒ null (guardia de exactos.length===1)", () => {
    expect(resolverParlamentario("Pedro Pérez Soto", al)).toBeNull();
  });

  it("(g3) nombres de pila solos JAMÁS resuelven: el token-set exige un apellido", () => {
    // "maria jose" son solo nombres de pila de P00002 — sin token de apellido, null.
    expect(resolverParlamentario("María José", al)).toBeNull();
  });

  it("(h) fuera de lista y vacío ⇒ null", () => {
    expect(resolverParlamentario("Gabriel Boric Font", al)).toBeNull();
    expect(resolverParlamentario("", al)).toBeNull();
    expect(resolverParlamentario(null, al)).toBeNull();
  });

  it("(i) normalización: tildes y mayúsculas no cambian el resultado", () => {
    expect(normalizarNombre("MARÍA  JOSÉ   Gatica")).toBe("maria jose gatica");
  });
});

describe("resolver — dead-letter schema (T-134-04: payload sin texto completo)", () => {
  it("(j) fila válida pasa; campo extra `texto` NO valida (strict)", () => {
    const fila = {
      url_hash: "abc",
      rejection_stage: "boletin_no_resuelto",
      detalle: "emisión sin match",
      payload: { emision: "14309-99", candidatos: 0 },
      run_id: null,
    };
    expect(DeadLetterRowSchema.parse(fila).rejection_stage).toBe("boletin_no_resuelto");
    expect(() =>
      DeadLetterPayloadSchema.parse({ emision: "x", texto: "artículo completo..." }),
    ).toThrow();
    expect(() => DeadLetterPayloadSchema.parse({ emision: "x".repeat(201) })).toThrow();
  });

  it("(k) rejection_stage inventado no valida", () => {
    expect(() =>
      DeadLetterRowSchema.parse({
        url_hash: "abc",
        rejection_stage: "stage_inventado",
        detalle: null,
        payload: {},
        run_id: null,
      }),
    ).toThrow();
  });
});

describe("resolver — emisión (SC1/SC4)", () => {
  const al = allowlistFixture();

  it("(l) el request inyecta la lista cerrada, temperature=0, y JAMÁS ids internos", () => {
    const req = construirEmisionRequest({ allowlist: al, titulo: "T", descripcion: "D" });
    expect(req.temperature).toBe(0);
    expect(req.system).toContain("14309-04");
    expect(req.system).toContain("fidel espinoza sandoval");
    expect(req.system).not.toContain("P00001");
    expect(req.system).not.toContain("P00002");
    expect(req.user).toContain("<titulo>T</titulo>");
  });

  it("(m) umbral de confianza: bajo el umbral la emisión completa se anula", () => {
    const emision = EmisionSchema.parse({ boletin: "14309-04", parlamentario: null, confianza: 0.69 });
    expect(aplicarUmbral(emision)).toBeNull();
    expect(aplicarUmbral({ ...emision, confianza: UMBRAL_CONFIANZA })).not.toBeNull();
  });
});

describe("resolver — gate all-or-nothing (SC4)", () => {
  it("(n) un ítem inválido ⇒ CERO aplicaciones y el lote se reporta inválido", async () => {
    let aplicados = 0;
    const r = await procesarLoteAllOrNothing(
      [1, 2, 3],
      (n) => (n === 2 ? "dos es inválido" : null),
      async () => {
        aplicados += 1;
      },
    );
    expect(r.aplicado).toBe(false);
    expect(r.invalidos.length).toBe(1);
    expect(aplicados).toBe(0);
  });

  it("(o) todo válido ⇒ aplicar corre exactamente una vez con el lote completo", async () => {
    const lotes: number[][] = [];
    const r = await procesarLoteAllOrNothing(
      [1, 2, 3],
      () => null,
      async (l) => {
        lotes.push([...l]);
      },
    );
    expect(r.aplicado).toBe(true);
    expect(lotes).toEqual([[1, 2, 3]]);
  });

  it("(p) lote vacío LANZA (cero vacuo)", async () => {
    await expect(procesarLoteAllOrNothing([], () => null, async () => {})).rejects.toThrow(/cero vacuo/);
  });
});
