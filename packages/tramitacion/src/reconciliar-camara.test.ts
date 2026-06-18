/**
 * Tests de reconciliarVotosCamara — cruce DETERMINISTA por Diputado/Id contra la maestra.
 * SIN red, SIN DB, SIN LLM (el Id es identificador oficial; no hay riesgo de identidad por nombre).
 *
 * Invariantes:
 *  - Id presente en maestra.id_diputado_camara → parlamentario_id poblado, metodo='determinista',
 *    estado_vinculo='confirmado', seleccion preservada.
 *  - Id ausente en la maestra (p.ej. periodo anterior) → parlamentario_id=null, metodo=null,
 *    estado_vinculo='no_confirmado', conservando el nombre crudo en mencion_nombre (fail-closed).
 */
import { describe, it, expect } from "vitest";
import type { Parlamentario } from "@obs/core";
import { reconciliarVotosCamara } from "./reconciliar-camara";
import type { CamaraVotoDetalle } from "./parse-camara-votacion";

function maestro(p: Partial<Parlamentario> & { id: string }): Parlamentario {
  return {
    id: p.id,
    nombre_normalizado: p.nombre_normalizado ?? "",
    nombres: p.nombres ?? "",
    apellido_paterno: p.apellido_paterno ?? "",
    apellido_materno: p.apellido_materno ?? "",
    camara: p.camara ?? "diputados",
    periodo: p.periodo ?? "diputados-vigente-2026",
    region: p.region ?? null,
    distrito: null,
    circunscripcion: null,
    partido: null,
    rut: null,
    parlid_senado: null,
    id_diputado_camara: p.id_diputado_camara ?? null,
    estado: p.estado ?? "confirmado",
    email: null,
    origen: "diputados",
    fecha_captura: "2026-01-01T00:00:00Z",
    enlace: "https://example.cl",
  };
}

const maestra: Parlamentario[] = [
  maestro({
    id: "P00010",
    nombres: "Karol",
    apellido_paterno: "Cariola",
    id_diputado_camara: "1234",
  }),
  maestro({
    id: "P00020",
    nombres: "Gabriel",
    apellido_paterno: "Boric",
    id_diputado_camara: "5678",
  }),
  // Una fila SIN id_diputado_camara (senador, o no tiene id de Cámara): no debe entrar al índice.
  maestro({
    id: "P00099",
    nombres: "Sin",
    apellido_paterno: "IdCamara",
    id_diputado_camara: null,
  }),
];

describe("reconciliarVotosCamara — cruce determinista por Diputado/Id", () => {
  it("Id presente en la maestra → confirmado/determinista con el parlamentario_id correcto, seleccion preservada", () => {
    const votos: CamaraVotoDetalle[] = [
      { diputadoId: "1234", opcion: "si", nombreCrudo: "Karol Cariola Oliva" },
      { diputadoId: "5678", opcion: "no", nombreCrudo: "Gabriel Boric Font" },
    ];
    const out = reconciliarVotosCamara(votos, "camara:89178", maestra);
    expect(out).toHaveLength(2);

    expect(out[0]!.parlamentario_id).toBe("P00010");
    expect(out[0]!.metodo).toBe("determinista");
    expect(out[0]!.estado_vinculo).toBe("confirmado");
    expect(out[0]!.seleccion).toBe("si");
    expect(out[0]!.votacion_id).toBe("camara:89178");
    expect(out[0]!.mencion_nombre).toBe("Karol Cariola Oliva");

    expect(out[1]!.parlamentario_id).toBe("P00020");
    expect(out[1]!.seleccion).toBe("no");
    expect(out[1]!.estado_vinculo).toBe("confirmado");
  });

  it("Id ausente en la maestra → null + no_confirmado, conservando el nombre crudo (fail-closed)", () => {
    const votos: CamaraVotoDetalle[] = [
      { diputadoId: "0000", opcion: "si", nombreCrudo: "Ex Diputado Periodo Anterior" },
    ];
    const out = reconciliarVotosCamara(votos, "camara:89178", maestra);
    expect(out).toHaveLength(1);
    expect(out[0]!.parlamentario_id).toBeNull();
    expect(out[0]!.metodo).toBeNull();
    expect(out[0]!.estado_vinculo).toBe("no_confirmado");
    expect(out[0]!.mencion_nombre).toBe("Ex Diputado Periodo Anterior");
    expect(out[0]!.seleccion).toBe("si");
  });

  it("una fila de maestra con id_diputado_camara null NO contamina el índice", () => {
    // Un voto con diputadoId vacío/"" no debe matchear la fila P00099 (id_diputado_camara null).
    const votos: CamaraVotoDetalle[] = [
      { diputadoId: "", opcion: "no", nombreCrudo: "Nadie" },
    ];
    const out = reconciliarVotosCamara(votos, "camara:1", maestra);
    expect(out[0]!.parlamentario_id).toBeNull();
    expect(out[0]!.estado_vinculo).toBe("no_confirmado");
  });

  it("maestra vacía → todos no_confirmado con mención cruda preservada", () => {
    const votos: CamaraVotoDetalle[] = [
      { diputadoId: "1234", opcion: "si", nombreCrudo: "Karol Cariola Oliva" },
    ];
    const out = reconciliarVotosCamara(votos, "camara:1", []);
    expect(out[0]!.parlamentario_id).toBeNull();
    expect(out[0]!.estado_vinculo).toBe("no_confirmado");
    expect(out[0]!.mencion_nombre).toBe("Karol Cariola Oliva");
  });
});
