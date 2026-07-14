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
  type VotoParaEscribir,
  type TramitacionWriter,
} from "@obs/tramitacion";
import type { Parlamentario } from "@obs/core";
import type { R2Store } from "@obs/ingest";
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

/**
 * Detalle voto-a-voto con un DIPID ausente (VOTO-01, 0019 amplió el CHECK a 'ausente'):
 *   - DIPID 815 (en la maestra) → si       → confirmado
 *   - DIPID 843 (en la maestra) → ausente   → confirmado, seleccion='ausente' (no se descarta)
 */
const DETALLE_AUSENTE_XML = `<?xml version="1.0" encoding="utf-8"?>
<Votacion xmlns="http://tempuri.org/">
  <ID>99001</ID>
  <Fecha>2026-05-12T10:00:00</Fecha>
  <Boletin>14309-04</Boletin>
  <TotalAfirmativos>1</TotalAfirmativos>
  <TotalNegativos>0</TotalNegativos>
  <TotalAbstenciones>0</TotalAbstenciones>
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
      <Opcion Codigo="4">Ausente</Opcion>
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

// ── Wire dos-etapas (P66 / DEBT-01): fake R2Store + orden Etapa-1-primero + --from-r2 sin fetch ──

/** Envelope crudo que runIngest escribe en Etapa 1 (mismo shape que ingest-cli.ts). */
interface Envelope {
  boletin: string;
  tramXml: string | null;
  votXml: string | null;
  detalles: string[];
}

/**
 * Fake in-memory de `R2Store`. Registra el ORDEN de cada `putImmutable` contra un contador
 * monotónico COMPARTIDO con el writer (Test A: la Etapa 1 precede a la Etapa 2). `getObject`
 * devuelve un envelope serializado (Test B: replay --from-r2 sin fetch). Idempotencia:
 * la 1ª escritura de un sha da `existed:false`; la 2ª del mismo sha da `existed:true` (412).
 */
class FakeR2Store {
  /** Ticks (del contador compartido) en que se llamó a putImmutable, en orden. */
  readonly putTicks: number[] = [];
  /** sha de cada put (para simular 412 en la 2ª escritura idéntica). */
  private readonly seen = new Set<string>();
  /** Envelope servido por getObject (modo --from-r2). */
  private readonly envelope: Envelope | null;

  constructor(
    private readonly tick: () => number,
    envelope: Envelope | null = null,
  ) {
    this.envelope = envelope;
  }

  async putImmutable(
    source: string,
    resource: string,
    date: string,
    sha: string,
    ext: string,
    _body: Uint8Array,
  ): Promise<{ r2Path: string; existed: boolean }> {
    this.putTicks.push(this.tick());
    const r2Path = `${source}/${resource}/${date}/${sha}.${ext}`;
    const existed = this.seen.has(sha);
    this.seen.add(sha);
    return { r2Path, existed };
  }

  async getObject(_r2Path: string): Promise<Uint8Array> {
    if (this.envelope == null) throw new Error("FakeR2Store: getObject sin envelope");
    return new TextEncoder().encode(JSON.stringify(this.envelope));
  }
}

/**
 * Writer que envuelve al in-memory y registra el ORDEN de `upsertVotos` contra el contador
 * compartido con el FakeR2Store (Test A: la primera escritura de votos ocurre DESPUÉS del put).
 */
class OrderTrackingWriter implements TramitacionWriter {
  readonly inner = new InMemoryTramitacionWriter();
  readonly upsertVotosTicks: number[] = [];

  constructor(private readonly tick: () => number) {}

  get votos() {
    return this.inner.votos;
  }
  get votaciones() {
    return this.inner.votaciones;
  }

  upsertProyecto = (p: Parameters<TramitacionWriter["upsertProyecto"]>[0]) =>
    this.inner.upsertProyecto(p);
  upsertVotacion = (v: Parameters<TramitacionWriter["upsertVotacion"]>[0]) =>
    this.inner.upsertVotacion(v);
  upsertEventos = (e: Parameters<TramitacionWriter["upsertEventos"]>[0]) =>
    this.inner.upsertEventos(e);
  upsertAutores = (a: Parameters<TramitacionWriter["upsertAutores"]>[0]) =>
    this.inner.upsertAutores(a);

  async upsertVotos(votos: VotoParaEscribir[]): Promise<void> {
    this.upsertVotosTicks.push(this.tick());
    return this.inner.upsertVotos(votos);
  }
}

/** Fake del CamaraConnector para el fixture ausente (VOTO-01). */
function fakeCamaraAusente(): CamaraConnector {
  return {
    async descubrirBoletines(): Promise<string[]> {
      return ["14309-04"];
    },
    async fetchVotacionesBoletin(): Promise<string> {
      return BOLETIN_XML;
    },
    async fetchVotacionDetalle(): Promise<string> {
      return DETALLE_AUSENTE_XML;
    },
  } as unknown as CamaraConnector;
}

/** Conectores spy que LANZAN si cualquier método de fetch se invoca (Test B: 0 fetch a la fuente). */
function camaraQueLanza(): CamaraConnector {
  return {
    async descubrirBoletines(): Promise<string[]> {
      throw new Error("no debe fetchear en --from-r2 (descubrirBoletines)");
    },
    async fetchVotacionesBoletin(): Promise<string> {
      throw new Error("no debe fetchear en --from-r2 (fetchVotacionesBoletin)");
    },
    async fetchVotacionDetalle(): Promise<string> {
      throw new Error("no debe fetchear en --from-r2 (fetchVotacionDetalle)");
    },
  } as unknown as CamaraConnector;
}

function senadoQueLanza(): SenadoConnector {
  return {
    async fetchTramitacion(): Promise<string> {
      throw new Error("no debe fetchear en --from-r2 (fetchTramitacion)");
    },
    async fetchVotaciones(): Promise<string> {
      throw new Error("no debe fetchear en --from-r2 (fetchVotaciones)");
    },
  } as unknown as SenadoConnector;
}

describe("runCamaraVotos — wire dos-etapas (P66 / DEBT-01)", () => {
  it("Test A: Etapa 1 (putImmutable a R2) ocurre ANTES de Etapa 2 (upsertVotos)", async () => {
    let counter = 0;
    const tick = () => ++counter;
    const r2 = new FakeR2Store(tick);
    const writer = new OrderTrackingWriter(tick);

    const res = await runCamaraVotos({
      boletines: ["14309-04"],
      camara: fakeCamara(),
      senado: fakeSenado(),
      writer,
      maestra: maestraDePrueba(),
      r2Store: r2 as unknown as R2Store,
    });

    // Etapa 1 se ejecutó (crudo a R2) y Etapa 2 escribió votos.
    expect(r2.putTicks.length).toBeGreaterThan(0);
    expect(writer.upsertVotosTicks.length).toBeGreaterThan(0);
    expect(res.votos).toBe(3);

    // Orden por contador monotónico compartido: el primer put precede a la primera escritura.
    expect(r2.putTicks[0]!).toBeLessThan(writer.upsertVotosTicks[0]!);
  });

  it("Test B: --from-r2 re-ejecuta Etapa 2 SIN ningún fetch a la fuente", async () => {
    const envelope: Envelope = {
      boletin: "14309-04",
      tramXml: null,
      votXml: BOLETIN_XML,
      detalles: [DETALLE_XML],
    };
    let counter = 0;
    const r2 = new FakeR2Store(() => ++counter, envelope);
    const writer = new InMemoryTramitacionWriter();

    // Los conectores LANZAN si se tocan → el test solo pasa si 0 fetch a la fuente.
    const res = await runCamaraVotos({
      fromR2: "tramitacion/14309-04/2026-05-12/deadbeef.json",
      camara: camaraQueLanza(),
      senado: senadoQueLanza(),
      writer,
      maestra: maestraDePrueba(),
      r2Store: r2 as unknown as R2Store,
    });

    // Pobló los votos del envelope (sin tocar la fuente).
    expect(res.votos).toBe(3);
    expect(writer.votos.size).toBe(3);
    const v815 = [...writer.votos.values()].find((v) => v.fuente_voter_id === "815")!;
    expect(v815.seleccion).toBe("si");
    expect(v815.estado_vinculo).toBe("confirmado");
  });

  it("Test B2: --from-r2 sin r2Store lanza (espejo de ingest-cli)", async () => {
    await expect(
      runCamaraVotos({
        fromR2: "tramitacion/x/y/z.json",
        camara: camaraQueLanza(),
        senado: senadoQueLanza(),
        writer: new InMemoryTramitacionWriter(),
        maestra: maestraDePrueba(),
      }),
    ).rejects.toBeInstanceOf(RunCamaraVotosArgsError);
  });

  it("Test C: seleccion='ausente' (0019) se persiste sin descartarse ni coaccionarse", async () => {
    const writer = new InMemoryTramitacionWriter();
    const res = await runCamaraVotos({
      boletines: ["14309-04"],
      camara: fakeCamaraAusente(),
      senado: fakeSenado(),
      writer,
      maestra: maestraDePrueba(),
    });

    expect(res.votos).toBe(2);
    const v843 = [...writer.votos.values()].find((v) => v.fuente_voter_id === "843")!;
    expect(v843.seleccion).toBe("ausente");
    expect(v843.estado_vinculo).toBe("confirmado");
  });

  it("Test D: idempotente por el camino r2Store (2× no duplica; 2ª put = existed→skip)", async () => {
    let counter = 0;
    const tick = () => ++counter;
    const r2 = new FakeR2Store(tick);
    const writer = new InMemoryTramitacionWriter();
    const comun = {
      boletines: ["14309-04"],
      camara: fakeCamara(),
      senado: fakeSenado(),
      writer,
      maestra: maestraDePrueba(),
      r2Store: r2 as unknown as R2Store,
    };

    await runCamaraVotos(comun);
    const sizeTras1 = writer.votos.size;
    // 2ª corrida: el mismo contenido → putImmutable devuelve existed=true → runIngest hace skip
    // de la Etapa 2 de ese boletín; el conteo de votos NO cambia (idempotente).
    await runCamaraVotos(comun);

    expect(sizeTras1).toBe(3);
    expect(writer.votos.size).toBe(sizeTras1);
    expect(r2.putTicks.length).toBe(2); // se intentó put ambas veces (2ª → 412 existed)
  });
});
