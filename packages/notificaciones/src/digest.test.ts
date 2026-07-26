import { createHash, createHmac } from "node:crypto";

import { describe, it, expect } from "vitest";
import {
  computeNovedades,
  deriveRawToken,
  deriveUserBajaToken,
  filtrarConNovedades,
  redactEmail,
  nuevoCursor,
  enforceCap,
  notaSinNovedades,
  HARD_CAP_DIARIO,
  type DbLike,
  type QueryLike,
  type NovedadEvento,
} from "./digest";

// ── Fake db EN MEMORIA (subconjunto de PostgREST) ────────────────────────────────
// Modela dos tablas: tramitacion_evento (id/boletin/…) y proyecto_autor
// (boletin/parlamentario_id/estado_vinculo). El builder acumula filtros y los aplica
// al resolver .range(). Espeja el shape del cliente supabase-js real usado por el CLI.

interface EventoRow {
  id: number;
  boletin: string;
  fecha: string | null;
  tipo: string;
  descripcion: string | null;
  enlace: string | null;
  origen: string;
}
interface AutorRow {
  boletin: string;
  parlamentario_id: string;
  estado_vinculo: "confirmado" | "no_confirmado";
}

function fakeDb(store: { eventos: EventoRow[]; autores: AutorRow[] }): DbLike {
  return {
    from(table: string): QueryLike {
      const eqs: Record<string, string> = {};
      let inCol: string | null = null;
      let inVals: string[] = [];
      let gtCol: string | null = null;
      let gtVal = -Infinity;

      const q: QueryLike = {
        select() {
          return q;
        },
        eq(col, val) {
          eqs[col] = val;
          return q;
        },
        in(col, vals) {
          inCol = col;
          inVals = vals;
          return q;
        },
        gt(col, val) {
          gtCol = col;
          gtVal = val;
          return q;
        },
        order() {
          return q;
        },
        async range(from, to) {
          let rows: Record<string, unknown>[];
          if (table === "tramitacion_evento") {
            rows = store.eventos.filter((e) => {
              if (inCol === "boletin" && !inVals.includes(e.boletin)) return false;
              if (gtCol === "id" && !(e.id > gtVal)) return false;
              return true;
            }) as unknown as Record<string, unknown>[];
          } else if (table === "proyecto_autor") {
            rows = store.autores.filter((a) => {
              for (const [col, val] of Object.entries(eqs)) {
                if ((a as unknown as Record<string, unknown>)[col] !== val) return false;
              }
              return true;
            }) as unknown as Record<string, unknown>[];
          } else {
            rows = [];
          }
          return { data: rows.slice(from, to + 1), error: null };
        },
      };
      return q;
    },
  };
}

function ev(id: number, boletin: string): EventoRow {
  return {
    id,
    boletin,
    fecha: "2026-07-26T00:00:00Z",
    tipo: "tramite",
    descripcion: `evento ${id}`,
    enlace: `https://www.camara.cl/e/${id}`,
    origen: "camara",
  };
}

describe("computeNovedades — suscripción proyecto (idempotencia por cursor)", () => {
  it("devuelve SOLO eventos con id > cursor del boletín objetivo", async () => {
    const db = fakeDb({
      eventos: [ev(10, "14309-04"), ev(20, "14309-04"), ev(99, "OTRO-01")],
      autores: [],
    });
    const nov = await computeNovedades({ tipo: "proyecto", objetivo_id: "14309-04" }, 10, db);
    expect(nov.map((n) => n.id)).toEqual([20]); // 10 excluido (no > cursor), OTRO-01 ajeno
  });

  it("re-correr sobre un tramo ya enviado (cursor = max) produce CERO novedades", async () => {
    const db = fakeDb({ eventos: [ev(10, "14309-04"), ev(20, "14309-04")], autores: [] });
    const nov = await computeNovedades({ tipo: "proyecto", objetivo_id: "14309-04" }, 20, db);
    expect(nov).toEqual([]);
  });

  it("cursor=0 trae todos los eventos del boletín (primer digest)", async () => {
    const db = fakeDb({ eventos: [ev(1, "14309-04"), ev(2, "14309-04")], autores: [] });
    const nov = await computeNovedades({ tipo: "proyecto", objetivo_id: "14309-04" }, 0, db);
    expect(nov.map((n) => n.id)).toEqual([1, 2]);
  });
});

describe("computeNovedades — suscripción parlamentario (fail-closed confirmado)", () => {
  const PID = "D1074";

  it("FIXTURE: proyecto_autor confirmado → lista NO vacía con el evento autorado", async () => {
    const db = fakeDb({
      eventos: [ev(42, "14309-04")],
      autores: [{ boletin: "14309-04", parlamentario_id: PID, estado_vinculo: "confirmado" }],
    });
    const nov = await computeNovedades({ tipo: "parlamentario", objetivo_id: PID }, 0, db);
    expect(nov.map((n) => n.id)).toEqual([42]); // NO vacío: el evento del boletín autorado
  });

  it("una autoría no_confirmado aporta CERO eventos (fail-closed, T-103-21)", async () => {
    const db = fakeDb({
      eventos: [ev(42, "14309-04")],
      autores: [{ boletin: "14309-04", parlamentario_id: PID, estado_vinculo: "no_confirmado" }],
    });
    const nov = await computeNovedades({ tipo: "parlamentario", objetivo_id: PID }, 0, db);
    expect(nov).toEqual([]); // el no_confirmado NUNCA surface (fail-closed)
  });

  it("mezcla confirmado + no_confirmado: SOLO surface los boletines confirmados", async () => {
    const db = fakeDb({
      eventos: [ev(42, "14309-04"), ev(43, "9999-99")],
      autores: [
        { boletin: "14309-04", parlamentario_id: PID, estado_vinculo: "confirmado" },
        { boletin: "9999-99", parlamentario_id: PID, estado_vinculo: "no_confirmado" },
      ],
    });
    const nov = await computeNovedades({ tipo: "parlamentario", objetivo_id: PID }, 0, db);
    expect(nov.map((n) => n.id)).toEqual([42]); // 43 excluido (autoría no_confirmado)
  });

  it("sin autorías confirmadas → CERO novedades (no toca tramitacion_evento)", async () => {
    const db = fakeDb({ eventos: [ev(42, "14309-04")], autores: [] });
    const nov = await computeNovedades({ tipo: "parlamentario", objetivo_id: PID }, 0, db);
    expect(nov).toEqual([]);
  });
});

describe("nuevoCursor — avanza al max id de la batch (solo tras envío exitoso)", () => {
  const batch: NovedadEvento[] = [ev(10, "b"), ev(30, "b"), ev(20, "b")].map((e) => ({ ...e }));
  it("cursor avanza al mayor id de la batch enviada", () => {
    expect(nuevoCursor(batch, 5)).toBe(30);
  });
  it("batch vacía (envío fallido / sin novedades) NO retrocede el cursor", () => {
    expect(nuevoCursor([], 30)).toBe(30);
  });
});

describe("enforceCap — hard-cap 100/día (over-cap queda en cola, Pitfall 3)", () => {
  it("≤100 pendientes: todos se envían, cero diferidos", () => {
    const users = Array.from({ length: 100 }, (_, i) => ({ user_id: `u${i}` }));
    const { aEnviar, diferidos } = enforceCap(users);
    expect(aEnviar).toHaveLength(100);
    expect(diferidos).toHaveLength(0);
  });

  it(">100 pendientes: envía 100, deja el resto para mañana (cursor sin avanzar)", () => {
    const users = Array.from({ length: 150 }, (_, i) => ({ user_id: `u${i}` }));
    const { aEnviar, diferidos } = enforceCap(users);
    expect(aEnviar).toHaveLength(HARD_CAP_DIARIO);
    expect(diferidos).toHaveLength(50); // quedan en cola, NUNCA se pierden
  });
});

describe("filtrarConNovedades — WR-03: no se emiten digests vacíos", () => {
  const conNov = { userId: "a", grupos: [{ nov: [ev(1, "b")] as NovedadEvento[] }] };
  const vacio = { userId: "b", grupos: [{ nov: [] as NovedadEvento[] }, { nov: [] as NovedadEvento[] }] };
  const mixto = { userId: "c", grupos: [{ nov: [] as NovedadEvento[] }, { nov: [ev(2, "b")] as NovedadEvento[] }] };

  it("excluye a los usuarios cuyos TODOS los grupos están vacíos", () => {
    const out = filtrarConNovedades([conNov, vacio]);
    expect(out.map((u) => u.userId)).toEqual(["a"]); // 'b' fuera: no quema slot ni reputación
  });

  it("incluye a un usuario con AL MENOS un grupo con novedades (grupos vacíos se conservan)", () => {
    const out = filtrarConNovedades([mixto]);
    expect(out).toHaveLength(1);
    // El usuario mixto pasa; sus grupos vacíos siguen ahí (la nota 'sin novedades' aplica a esos).
    expect(out[0]!.grupos).toHaveLength(2);
  });

  it("todos vacíos → lista vacía (nada que enviar, salida limpia)", () => {
    expect(filtrarConNovedades([vacio])).toEqual([]);
  });
});

describe("redactEmail — el email NUNCA se devuelve crudo (Pitfall 4)", () => {
  it("redacta el local-part conservando dominio, nunca el valor completo", () => {
    const out = redactEmail("juan@example.com");
    expect(out).not.toBe("juan@example.com");
    expect(out).not.toContain("juan");
    expect(out).toBe("j***@example.com");
  });
  it("input no-email → <REDACTED> completo", () => {
    expect(redactEmail("no-es-un-email")).toBe("<REDACTED>");
    expect(redactEmail("@sindominio")).toBe("<REDACTED>");
    expect(redactEmail("local@")).toBe("<REDACTED>");
  });
});

describe("notaSinNovedades — honesto, jamás silencio (UI-SPEC S5)", () => {
  it("declara la fecha de corte de las fuentes consultadas", () => {
    const nota = notaSinNovedades("2026-07-26");
    expect(nota).toContain("Sin novedades registradas");
    expect(nota).toContain("según las fuentes consultadas al 2026-07-26");
  });
});

describe("deriveRawToken (CR-01) — el token del link REVIVE el unsubscribe (round-trip)", () => {
  const SECRET = "secreto-de-servidor-de-prueba";
  const SUSC_ID = "11111111-2222-3333-4444-555555555555";
  // hashToken de la app = sha256 hex del raw. La DB guarda ese hash como baja_token_hash.
  const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

  it("ROUND-TRIP: sha256(deriveRawToken('baja')) === el baja_token_hash guardado al suscribir", () => {
    // Al suscribir, la app guardó baja_token_hash = sha256(deriveToken(secret,'baja',id).raw),
    // con la MISMA fórmula HMAC. El CRON reproduce ese raw y lo pone en ?t=. La página lo
    // re-hashea (hashToken) y busca por baja_token_hash → DEBE casar. Esto es la prueba de
    // que el link de baja YA NO está muerto (el bug CR-01 ponía el hash en ?t=).
    const storedBajaTokenHash = hashToken(
      createHmac("sha256", SECRET).update(`baja:${SUSC_ID}`).digest("base64url"),
    );
    const rawEnElLink = deriveRawToken(SECRET, "baja", SUSC_ID);
    expect(hashToken(rawEnElLink)).toBe(storedBajaTokenHash);
    // Y el CONTRA-EJEMPLO del bug: poner el hash en el link (doble-hash) NUNCA casa.
    expect(hashToken(storedBajaTokenHash)).not.toBe(storedBajaTokenHash);
  });

  it("es DETERMINISTA: el CRON reproduce el mismo raw en cada corrida", () => {
    expect(deriveRawToken(SECRET, "baja", SUSC_ID)).toBe(deriveRawToken(SECRET, "baja", SUSC_ID));
  });

  it("confirm y baja NO colisionan; otro secreto → otro raw (no forjable sin el secreto)", () => {
    expect(deriveRawToken(SECRET, "confirm", SUSC_ID)).not.toBe(
      deriveRawToken(SECRET, "baja", SUSC_ID),
    );
    expect(deriveRawToken("otro", "baja", SUSC_ID)).not.toBe(deriveRawToken(SECRET, "baja", SUSC_ID));
  });

  it("sin secreto lanza (fail-loud: no emitir un link de baja muerto)", () => {
    expect(() => deriveRawToken("", "baja", SUSC_ID)).toThrow(/NOTIF_TOKEN_SECRET/);
  });
});

describe("deriveUserBajaToken (CR-03) — el token del digest da de baja AL USUARIO completo", () => {
  const SECRET = "secreto-de-servidor-de-prueba";
  const USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  // Re-implementa el verificador de la app (verifyUserBajaToken) para probar el ROUND-TRIP
  // cross-package (el CRON deriva; la landing verifica). La fórmula debe ser byte-idéntica.
  function verifyUserBajaToken(secret: string, token: string): string | null {
    if (!secret || !token) return null;
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep <= 0 || sep === decoded.length - 1) return null;
    const userId = decoded.slice(0, sep);
    const firmaRecibida = decoded.slice(sep + 1);
    const firmaEsperada = createHmac("sha256", secret).update(`baja-user:${userId}`).digest("base64url");
    return firmaRecibida === firmaEsperada ? userId : null;
  }

  it("ROUND-TRIP cross-package: verifyUserBajaToken(deriveUserBajaToken(user)) === userId", () => {
    // Lo que el bug CR-03 dejaba roto: el digest agregaba N suscripciones pero el token de baja
    // era de UNA sola → un click no detenía el correo. Ahora el token es POR USUARIO; la landing
    // lo verifica por firma y borra TODAS las suscripciones del user (one-click 21.719).
    const token = deriveUserBajaToken(SECRET, USER_ID);
    expect(verifyUserBajaToken(SECRET, token)).toBe(USER_ID);
  });

  it("es DETERMINISTA: el CRON reproduce el mismo token en cada corrida para un userId", () => {
    expect(deriveUserBajaToken(SECRET, USER_ID)).toBe(deriveUserBajaToken(SECRET, USER_ID));
  });

  it("no forjable sin el secreto: otro secreto → la firma NO verifica (userId null)", () => {
    const forjado = deriveUserBajaToken("otro-secreto", USER_ID);
    expect(verifyUserBajaToken(SECRET, forjado)).toBeNull();
  });

  it("DOS suscripciones del mismo usuario comparten UN token de baja (el del digest)", () => {
    // El digest agrupa por usuario: aunque el user tenga 2+ suscripciones, el correo lleva UN
    // solo token de baja (derivado del userId, no de una suscripción). Un click → baja de todo.
    const tokenDelDigest = deriveUserBajaToken(SECRET, USER_ID);
    // El mismo userId (dos suscripciones distintas dan el MISMO token de usuario).
    expect(deriveUserBajaToken(SECRET, USER_ID)).toBe(tokenDelDigest);
    // Y verifica de vuelta al userId → la landing borrará TODAS las suscripciones del user.
    expect(verifyUserBajaToken(SECRET, tokenDelDigest)).toBe(USER_ID);
  });

  it("sin secreto lanza (fail-loud: no emitir un link de baja muerto)", () => {
    expect(() => deriveUserBajaToken("", USER_ID)).toThrow(/NOTIF_TOKEN_SECRET/);
  });
});
