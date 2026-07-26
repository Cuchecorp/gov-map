import { describe, it, expect, vi } from "vitest";
import {
  enviarConfirmacion,
  enviarDigest,
  renderConfirmacion,
  renderDigest,
  type EnvioConfig,
  type GrupoDigest,
} from "./resend";
import type { NovedadEvento } from "./digest";

function ev(id: number): NovedadEvento {
  return {
    id,
    boletin: "14309-04",
    fecha: "2026-07-26T00:00:00Z",
    tipo: "tramite",
    descripcion: `evento ${id}`,
    enlace: `https://www.camara.cl/e/${id}`,
    origen: "camara",
  };
}

const BASE = "https://obs.example";
const FROM = "Observatorio del Congreso 360 <resumen@dominio-verificado>";

function cfg(overrides: Partial<EnvioConfig> = {}): EnvioConfig {
  return { baseUrl: BASE, from: FROM, log: () => {}, ...overrides };
}

describe("enviarDigest — DRY-RUN cuando falta RESEND_API_KEY", () => {
  it("sin apiKey: no hace fetch, devuelve dryRun, log honesto SIN email crudo", async () => {
    const fetchSpy = vi.fn();
    const logs: string[] = [];
    const res = await enviarDigest(
      "juan@example.com",
      "asunto",
      "<p>h</p>",
      "t",
      "rawtoken",
      cfg({ apiKey: undefined, fetchImpl: fetchSpy as unknown as typeof fetch, log: (m) => logs.push(m) }),
    );
    expect(res).toEqual({ sent: false, dryRun: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logs.join("\n")).toContain("dry run");
    expect(logs.join("\n")).not.toContain("juan@example.com"); // PII redactada
  });
});

describe("enviarDigest — POST a Resend con headers correctos (key presente)", () => {
  it("hace POST a api.resend.com/emails con Bearer + List-Unsubscribe one-click + multipart", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit = {};
    const fetchSpy = vi.fn(async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return { ok: true, status: 200, headers: new Headers() } as Response;
    });
    const res = await enviarDigest(
      "ana@example.com",
      "Tu resumen del Congreso · 2026-07-26",
      "<p>html</p>",
      "texto",
      "TOKEN_CRUDO_BAJA",
      cfg({ apiKey: "re_test123", fetchImpl: fetchSpy as unknown as typeof fetch }),
    );
    expect(res.sent).toBe(true);
    expect(capturedUrl).toBe("https://api.resend.com/emails");
    expect(capturedInit.method).toBe("POST");

    const headers = capturedInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test123");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(capturedInit.body as string);
    expect(body.to).toEqual(["ana@example.com"]);
    expect(body.from).toBe(FROM);
    expect(body.html).toBe("<p>html</p>");
    expect(body.text).toBe("texto");
    expect(body.headers["List-Unsubscribe"]).toBe(
      `<${BASE}/notificaciones/baja?t=TOKEN_CRUDO_BAJA>`,
    );
    expect(body.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

describe("enviarDigest — 429 respeta retry-after y NO crashea", () => {
  it("ante 429 devuelve reintentable (cursor no avanza), no lanza", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: new Headers({ "retry-after": "0" }),
    }) as Response);
    const logs: string[] = [];
    const res = await enviarDigest(
      "pedro@example.com",
      "asunto",
      "<p>h</p>",
      "t",
      "tok",
      cfg({ apiKey: "re_x", fetchImpl: fetchSpy as unknown as typeof fetch, log: (m) => logs.push(m) }),
    );
    expect(res.sent).toBe(false);
    expect(res.reintentable).toBe(true);
    expect(res.status).toBe(429);
    expect(logs.join("\n")).not.toContain("pedro@example.com"); // PII redactada
  });

  it("un 5xx es reintentable; un 4xx (no-429) no lo es", async () => {
    const mk = (status: number) =>
      vi.fn(async () => ({ ok: false, status, headers: new Headers() }) as Response);
    const r500 = await enviarDigest("x@y.cl", "a", "h", "t", "tok", cfg({ apiKey: "re_x", fetchImpl: mk(503) as unknown as typeof fetch }));
    expect(r500.reintentable).toBe(true);
    const r400 = await enviarDigest("x@y.cl", "a", "h", "t", "tok", cfg({ apiKey: "re_x", fetchImpl: mk(422) as unknown as typeof fetch }));
    expect(r400.reintentable).toBe(false);
  });
});

describe("renderDigest — grupos, no-news honesto, footer baja con token crudo", () => {
  const grupos: GrupoDigest[] = [
    { objetivo: "14309-04", novedades: [ev(42)] },
    { objetivo: "D1074 Diputada", novedades: [] },
  ];
  it("HTML incluye heading del objetivo, ítem con fuente+fecha+enlace y footer de baja", () => {
    const { html } = renderDigest(grupos, "2026-07-26", BASE, "RAWBAJA");
    expect(html).toContain("14309-04");
    expect(html).toContain("evento 42");
    expect(html).toContain("camara, 2026-07-26");
    expect(html).toContain("Ver en la fuente ↗");
    expect(html).toContain(`${BASE}/notificaciones/baja?t=RAWBAJA`);
    expect(html).toContain("CC BY 4.0");
  });
  it("grupo vacío ⇒ nota honesta 'sin novedades … según las fuentes consultadas al {fecha}'", () => {
    const { html, text } = renderDigest(grupos, "2026-07-26", BASE, "RAWBAJA");
    expect(html).toContain("Sin novedades registradas hoy");
    expect(html).toContain("según las fuentes consultadas al 2026-07-26");
    expect(text).toContain("Sin novedades registradas hoy");
  });
  it("texto plano lleva el link de baja con el token crudo", () => {
    const { text } = renderDigest(grupos, "2026-07-26", BASE, "RAWBAJA");
    expect(text).toContain(`Darte de baja: ${BASE}/notificaciones/baja?t=RAWBAJA`);
  });
  it("escapa HTML de los ítems (no inyecta sin escapar)", () => {
    const evil: GrupoDigest[] = [
      { objetivo: "<script>x</script>", novedades: [{ ...ev(1), descripcion: "<b>hola</b>" }] },
    ];
    const { html } = renderDigest(evil, "2026-07-26", BASE, "t");
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;hola&lt;/b&gt;");
  });
});

describe("renderConfirmacion (WR-05) — correo de doble opt-in con el link de confirmación", () => {
  const CONFIRM_URL = `${BASE}/notificaciones/confirmar?t=RAWCONFIRM`;

  it("HTML y texto llevan el link de confirmación (CTA) y los objetivos pedidos", () => {
    const { html, text } = renderConfirmacion(["14309-04", "D1074 Diputada"], CONFIRM_URL);
    expect(html).toContain(CONFIRM_URL);
    expect(html).toContain("Confirma tu suscripción");
    expect(html).toContain("14309-04");
    expect(html).toContain("D1074 Diputada");
    expect(text).toContain(CONFIRM_URL);
    expect(text).toContain("14309-04");
  });

  it("NO lleva link de baja / List-Unsubscribe (aún no hay suscripción activa)", () => {
    const { html } = renderConfirmacion(["14309-04"], CONFIRM_URL);
    expect(html).not.toContain("/notificaciones/baja");
    expect(html).not.toContain("Darte de baja");
  });

  it("escapa HTML de los objetivos (no inyecta sin escapar)", () => {
    const { html } = renderConfirmacion(["<script>x</script>"], CONFIRM_URL);
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("enviarConfirmacion (WR-05) — dry-run/POST/PII espejo del digest", () => {
  it("sin apiKey: no hace fetch, dry-run, log SIN email crudo", async () => {
    const fetchSpy = vi.fn();
    const logs: string[] = [];
    const res = await enviarConfirmacion(
      "juan@example.com",
      "<p>h</p>",
      "t",
      cfg({ apiKey: undefined, fetchImpl: fetchSpy as unknown as typeof fetch, log: (m) => logs.push(m) }),
    );
    expect(res).toEqual({ sent: false, dryRun: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logs.join("\n")).toContain("dry run");
    expect(logs.join("\n")).not.toContain("juan@example.com"); // PII redactada
  });

  it("con apiKey: POST a Resend con Bearer + multipart, SIN List-Unsubscribe", async () => {
    let capturedInit: RequestInit = {};
    const fetchSpy = vi.fn(async (_url: string, init: RequestInit) => {
      capturedInit = init;
      return { ok: true, status: 200, headers: new Headers() } as Response;
    });
    const res = await enviarConfirmacion(
      "ana@example.com",
      "<p>html</p>",
      "texto",
      cfg({ apiKey: "re_test123", fetchImpl: fetchSpy as unknown as typeof fetch }),
    );
    expect(res.sent).toBe(true);
    const headers = capturedInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test123");
    const body = JSON.parse(capturedInit.body as string);
    expect(body.to).toEqual(["ana@example.com"]);
    // El correo de confirmación NO lleva header de baja (aún no hay suscripción).
    expect(body.headers).toBeUndefined();
  });

  it("ante 429 devuelve reintentable y NO crashea (PII redactada)", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: new Headers({ "retry-after": "0" }),
    }) as Response);
    const logs: string[] = [];
    const res = await enviarConfirmacion(
      "pedro@example.com",
      "<p>h</p>",
      "t",
      cfg({ apiKey: "re_x", fetchImpl: fetchSpy as unknown as typeof fetch, log: (m) => logs.push(m) }),
    );
    expect(res.reintentable).toBe(true);
    expect(res.status).toBe(429);
    expect(logs.join("\n")).not.toContain("pedro@example.com");
  });
});
