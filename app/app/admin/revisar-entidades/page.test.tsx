import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests de la COLA DE REVISIÓN ADMIN protegida de identidades de TERCEROS (ENT-04).
 * Verifican por comportamiento (no por convención), espejo de /contraparte/[id]/page.test.tsx:
 *   - gate OFF (default) → notFound() ANTES de tocar la DB (la cola PII jamás es pública).
 *   - gate ON → lista SOLO `revision_entidad` estado='pendiente' (filtro .eq verde).
 *   - la acción 'confirmar' invoca el RPC `resolver_entidad` con p_promover=true (promoción
 *     humana); NINGÚN dudoso se auto-confirma.
 *
 * `notFound()` lanza (semántica de Next: NEXT_HTTP_ERROR_FALLBACK;404). Se mockea con un sentinel.
 * `createAdminSupabase` se mockea para PROBAR que con el gate OFF la DB NUNCA se toca y para
 * inyectar la cadena de query (from().select().eq()) + rpc().
 */

class NotFoundSignal extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
    this.name = "NotFoundSignal";
  }
}

const notFoundMock = vi.fn(() => {
  throw new NotFoundSignal();
});
vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

// Gate inyectable por test.
const adminEnabledMock = vi.fn<() => boolean>(() => false);
vi.mock("@/lib/admin-gate", () => ({
  adminRevisionEnabled: () => adminEnabledMock(),
}));

// Cadena de query: from(tabla).select(cols).eq(col, val) → { data, error }.
const eqMock = vi.fn();
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));
const rpcMock = vi.fn();
const createAdminSupabaseMock = vi.fn(() => ({ from: fromMock, rpc: rpcMock }));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminSupabase: () => createAdminSupabaseMock(),
}));

import RevisarEntidadesPage, { listarPendientes, resolverEntidadAdmin } from "./page";
import { renderToStaticMarkup } from "react-dom/server";

beforeEach(() => {
  notFoundMock.mockClear();
  adminEnabledMock.mockReset();
  fromMock.mockClear();
  selectMock.mockClear();
  eqMock.mockReset();
  rpcMock.mockReset();
  createAdminSupabaseMock.mockClear();
});

describe("/admin/revisar-entidades — gate a nivel de página (LOCKED)", () => {
  it("gate OFF (default) → notFound() ANTES de tocar la DB", async () => {
    adminEnabledMock.mockReturnValue(false);
    await expect(RevisarEntidadesPage()).rejects.toBeInstanceOf(NotFoundSignal);
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    // La DB NUNCA se tocó: ni cliente service-role ni query con el gate OFF.
    expect(createAdminSupabaseMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("gate ON → lista SOLO revision_entidad estado='pendiente' (filtro .eq), monta la cola", async () => {
    adminEnabledMock.mockReturnValue(true);
    eqMock.mockResolvedValue({
      data: [
        {
          id: 7,
          mencion_nombre: "Constructora Andes SpA",
          mencion_normalizada: "andes constructora spa",
          tipo_entidad: "juridica",
          estado: "pendiente",
          candidatos: [{ id: "E00100", nombre: "Constructora Andes SpA" }],
          salida_modelo: { chosen_id: "E00100" },
          modelo_version: "minimax-m3",
        },
      ],
      error: null,
    });

    const el = await RevisarEntidadesPage();
    const html = renderToStaticMarkup(el);

    // Consultó la tabla de la cola filtrando por 'pendiente'.
    expect(fromMock).toHaveBeenCalledWith("revision_entidad");
    expect(eqMock).toHaveBeenCalledWith("estado", "pendiente");
    // El caso pendiente aparece en la cola montada.
    expect(html).toContain("Constructora Andes SpA");
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});

describe("listarPendientes — SOLO 'pendiente'", () => {
  it("filtra estrictamente por estado='pendiente'", async () => {
    eqMock.mockResolvedValue({ data: [], error: null });
    await listarPendientes();
    expect(fromMock).toHaveBeenCalledWith("revision_entidad");
    expect(eqMock).toHaveBeenCalledWith("estado", "pendiente");
  });

  it("un error real de la query → THROW (no 'sin casos')", async () => {
    eqMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(listarPendientes()).rejects.toThrow(/boom/);
  });
});

describe("resolverEntidadAdmin — promoción SOLO humana vía RPC resolver_entidad", () => {
  it("gate OFF → notFound() ANTES de tocar la DB (no se puede promover sin gate)", async () => {
    adminEnabledMock.mockReturnValue(false);
    await expect(
      resolverEntidadAdmin({ casoId: 7, accion: "confirmar", revisor: "operador" }),
    ).rejects.toBeInstanceOf(NotFoundSignal);
    expect(createAdminSupabaseMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("'confirmar' invoca resolver_entidad con p_promover=true (promoción humana)", async () => {
    adminEnabledMock.mockReturnValue(true);
    rpcMock.mockResolvedValue({ data: 11, error: null });

    await resolverEntidadAdmin({
      casoId: 7,
      accion: "confirmar",
      revisor: "operador",
      chosenId: "E00100",
      tipoEntidad: "juridica",
      mencionNombre: "Constructora Andes SpA",
      mencionNormalizada: "andes constructora spa",
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [name, params] = rpcMock.mock.calls[0]!;
    expect(name).toBe("resolver_entidad");
    expect(params.p_caso_id).toBe(7);
    expect(params.p_estado).toBe("confirmado");
    expect(params.p_promover).toBe(true);
    expect(params.p_revisor).toBe("operador");
    // El vínculo promovido apunta al chosen_id, metodo humano (gate humano LOCKED).
    expect(params.p_vinculo.entidad_tercero_id).toBe("E00100");
    expect(params.p_vinculo.metodo).toBe("humano");
  });

  it("'rechazar' NO promueve (p_promover=false, sin vínculo)", async () => {
    adminEnabledMock.mockReturnValue(true);
    rpcMock.mockResolvedValue({ data: null, error: null });

    await resolverEntidadAdmin({
      casoId: 7,
      accion: "rechazar",
      revisor: "operador",
      motivo: "no es la misma entidad",
      tipoEntidad: "juridica",
    });

    const [, params] = rpcMock.mock.calls[0]!;
    expect(params.p_estado).toBe("rechazado");
    expect(params.p_promover).toBe(false);
    expect(params.p_vinculo).toBeNull();
  });

  it("revisor vacío → NO toca la DB (trazabilidad ENT-04)", async () => {
    adminEnabledMock.mockReturnValue(true);
    await expect(
      resolverEntidadAdmin({ casoId: 7, accion: "confirmar", revisor: "  ", chosenId: "E00100" }),
    ).rejects.toThrow();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("'confirmar' sin chosenId válido → NO toca la DB (un confirmado debe apuntar a una entidad real)", async () => {
    adminEnabledMock.mockReturnValue(true);
    await expect(
      resolverEntidadAdmin({ casoId: 7, accion: "confirmar", revisor: "operador", chosenId: "BAD" }),
    ).rejects.toThrow();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
