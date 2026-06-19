// run-camara-votos.test — test OFFLINE del runner de producción (VOTE-02). SIN red ni DB.
//
// Inyecta un `CamaraConnector` fake (devuelve fixtures XML del shape REAL tempuri.org), un
// `SenadoConnector` fake (XML vacío → runIngest degrada fail-closed, no aborta), un
// `InMemoryTramitacionWriter` y una maestra de prueba con ≥1 DIPID que cruza y ≥1 que no.
//
// Asserts:
//   - Idempotencia (VOTE-02): correr 2× con el mismo input deja `writer.votos.size` estable.
//   - Cruce DIPID determinista: DIPID en la maestra → confirmado/determinista/parlamentario_id;
//     DIPID ausente → no_confirmado/null (fail-closed), conservando la mención cruda.
//   - Provenance por fila: cada votación escrita lleva origen/fecha_captura/enlace.
//   - Corrida acotada: sin boletines y sin limite, el runner lanza (nunca corre a ciegas).

import { describe, it, expect } from "vitest";
import {
  CamaraConnector,
  SenadoConnector,
  InMemoryTramitacionWriter,
} from "@obs/tramitacion";
import type { Parlamentario } from "@obs/core";
import { runCamaraVotos, RunCamaraVotosArgsError } from "./run-camara-votos";

// ── Fixtures inline (shape REAL del WS, ns tempuri.org) ───────────────────────

/** Lista de votaciones por boletín: UNA votación (id 99001) del boletín 14309-04. */
const BOLETIN_XML = `<?xml version="1.0" encoding="utf-8"?>
<Votaciones xmlns="http://tempuri.org/">
  <Votacion>
    <ID>99001</ID>
    <Fecha>2026-05-12T10:00:00</Fecha>
    <Tipo Codigo="6">Única</Tipo>
    <Resultado Codigo="1">Aprobado</Resultado>
    <Quorum Codigo="1">Quorum Simple</Quorum>
    <Boletin>14309-04</Boletin>
    <Tramite Codigo="3">TERCER TRÁMITE</Tramite>
    <TotalAfirmativos>1</TotalAfirmativos>
    <TotalNegativos>1</TotalNegativos>
    <TotalAbstenciones>1</TotalAbstenciones>
    <TotalDispensados>0</TotalDispensados>
  </Votacion>
</Votaciones>`;

/**
 * Detalle voto-a-voto de la votación 99001 con 3 diputados:
 *   - DIPID 815 (en la maestra) → si      → confirmado
 *   - DIPID 843 (en la maestra) → no       → confirmado
 *   - DIPID 999 (NO en maestra) → abstencion → no_confirmado (fail-closed)
 */
const DETALLE_XML = `<?xml version="1.0" encoding="utf-8"?>
<Votacion xmlns="http://tempuri.org/">
  <ID>99001</ID>
  <Fecha>2026-05-12T10:00:00</Fecha>
  <Boletin>14309-04</Boletin>
  <TotalAfirmativos>1</TotalAfirmativos>
  <TotalNegativos>1</TotalNegativos>
  <TotalAbstenciones>1</TotalAbstenciones>
  <Votos>
    <Voto>
      <Diputado>
        <DIPID>815</DIPID>
        <Nombre>Sergio</Nombre>
        <Apellido_Paterno>Bobadilla</Apellido_Paterno>
        <Apellido_Materno>Muñoz</Apellido_Materno>
      </Diputado>
      <Opcion Codigo="1">Afirmativo</Opcion>
    </Voto>
    <Voto>
      <Diputado>
        <DIPID>843</DIPID>
        <Nombre>René Manuel</Nombre>
        <Apellido_Paterno>García</Apellido_Paterno>
        <Apellido_Materno>García</Apellido_Materno>
      </Diputado>
      <Opcion Codigo="0">En Contra</Opcion>
    </Voto>
    <Voto>
      <Diputado>
        <DIPID>999</DIPID>
        <Nombre>Fantasma</Nombre>
        <Apellido_Paterno>Inexistente</Apellido_Paterno>
        <Apellido_Materno>Fuera</Apellido_Materno>
      </Diputado>
      <Opcion Codigo="2">Abstención</Opcion>
    </Voto>
  </Votos>
</Votacion>`;

// ── Fakes de conector (NO red): tipados como las clases reales vía structural cast. ──

/** Fake del CamaraConnector: devuelve los fixtures; nunca toca la red. */
function fakeCamara(): CamaraConnector {
  return {
    async descubrirBoletines(): Promise<string[]> {
      return ["14309-04"];
    },
    async fetchVotacionesBoletin(): Promise<string> {
      return BOLETIN_XML;
    },
    async fetchVotacionDetalle(): Promise<string> {
      return DETALLE_XML;
    },
  } as unknown as CamaraConnector;
}

/** Fake del SenadoConnector: XML vacío → runIngest degrada fail-closed (no aborta el boletín). */
function fakeSenado(): SenadoConnector {
  return {
    async fetchTramitacion(): Promise<string> {
      return "<Proyectos></Proyectos>";
    },
    async fetchVotaciones(): Promise<string> {
      return "<Votaciones></Votaciones>";
    },
  } as unknown as SenadoConnector;
}

/** Maestra de prueba: dos diputados con DIPID (815, 843); el 999 del fixture NO está → fail-closed. */
function maestraDePrueba(): Parlamentario[] {
  const base = {
    nombre_normalizado: "",
    nombres: "",
    apellido_paterno: "",
    apellido_materno: "",
    camara: "diputados" as const,
    periodo: "2022-2026",
    region: null,
    distrito: null,
    circunscripcion: null,
    partido: null,
    rut: null,
    parlid_senado: null,
  };
  return [
    { ...base, id: "P00815", id_diputado_camara: "815", nombres: "Sergio" } as Parlamentario,
    { ...base, id: "P00843", id_diputado_camara: "843", nombres: "René Manuel" } as Parlamentario,
  ];
}

describe("runCamaraVotos (offline)", () => {
  it("acota la corrida: sin boletines y sin limite, lanza (nunca corre a ciegas)", async () => {
    await expect(
      runCamaraVotos({
        camara: fakeCamara(),
        senado: fakeSenado(),
        writer: new InMemoryTramitacionWriter(),
        maestra: maestraDePrueba(),
      }),
    ).rejects.toBeInstanceOf(RunCamaraVotosArgsError);
  });

  it("cruza DIPID determinista (confirmado/no_confirmado) y persiste provenance por fila", async () => {
    const writer = new InMemoryTramitacionWriter();
    const res = await runCamaraVotos({
      boletines: ["14309-04"],
      camara: fakeCamara(),
      senado: fakeSenado(),
      writer,
      maestra: maestraDePrueba(),
    });

    expect(res.dbLoaded).toBe(false); // writer inyectado in-memory → dry-run
    expect(res.votaciones).toBe(1);
    expect(res.votos).toBe(3);

    const votos = [...writer.votos.values()];
    expect(votos).toHaveLength(3);

    // DIPID 815 → confirmado, determinista, parlamentario_id poblado vía EnlaceConfirmado.
    const v815 = votos.find((v) => v.fuente_voter_id === "815")!;
    expect(v815.estado_vinculo).toBe("confirmado");
    expect(v815.metodo).toBe("determinista");
    expect(v815.parlamentario_id).toBe("P00815");
    expect(v815.seleccion).toBe("si");

    // DIPID 843 → confirmado, voto 'no'.
    const v843 = votos.find((v) => v.fuente_voter_id === "843")!;
    expect(v843.estado_vinculo).toBe("confirmado");
    expect(v843.parlamentario_id).toBe("P00843");
    expect(v843.seleccion).toBe("no");

    // DIPID 999 NO en la maestra → no_confirmado, fail-closed, conserva la mención cruda.
    const v999 = votos.find((v) => v.fuente_voter_id === "999")!;
    expect(v999.estado_vinculo).toBe("no_confirmado");
    expect(v999.parlamentario_id).toBeNull();
    expect(v999.seleccion).toBe("abstencion");
    expect(v999.mencion_nombre.length).toBeGreaterThan(0);

    // Provenance por fila en la votación escrita.
    const votacion = [...writer.votaciones.values()][0]!;
    expect(votacion.origen.length).toBeGreaterThan(0);
    expect(votacion.fecha_captura.length).toBeGreaterThan(0);
    expect(votacion.enlace.length).toBeGreaterThan(0);
  });

  it("es idempotente: correr 2× con el mismo input no duplica filas (clave natural)", async () => {
    const writer = new InMemoryTramitacionWriter();
    const comun = {
      boletines: ["14309-04"],
      camara: fakeCamara(),
      senado: fakeSenado(),
      writer,
      maestra: maestraDePrueba(),
    };

    await runCamaraVotos(comun);
    const sizeTras1 = writer.votos.size;
    await runCamaraVotos(comun);
    const sizeTras2 = writer.votos.size;

    expect(sizeTras1).toBe(3);
    expect(sizeTras2).toBe(sizeTras1); // upsert por (votacion_id, fuente_voter_id), no duplica
  });
});
