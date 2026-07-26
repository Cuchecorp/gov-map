// @obs/notificaciones — ENVÍO por Resend (patrón EGRESO, NOTIF-04).
//
// ██████ EGRESO: el destinatario es Resend, NO una fuente gubernamental ██████
// NO hay dos etapas, NO hay R2, NO hay rate-limit 2-3s/host, NO hay robots.txt. El envío
// se hace con `fetch` global (Node 22, CERO SDK — T-103-SC). La ÚNICA cota es el hard-cap
// 100/día (lo aplica el CLI vía enforceCap) + la redacción de PII (redactEmail) en TODO log.
// El email JAMÁS se escribe a R2 ni a CI (Pitfall 4 / T-103-13).
//
// Resend REST: POST https://api.resend.com/emails ; Authorization: Bearer re_... ;
// body { from, to:[...], subject, html, text, headers:{ List-Unsubscribe (one-click) } }.
// Free tier 100/día hard cap, ~2 req/s → ante 429 respetamos retry-after (no crash).
//
// SIN RESEND_API_KEY ⇒ DRY-RUN: no hay fetch, se degrada honestamente (mirror
// del precedente dry-run de @obs/dinero / @obs/actualidad). Nunca se envía a ciegas.

import { redactEmail, type NovedadEvento } from "./digest";

/** Resultado de un intento de envío (para el log del CLI y el avance del cursor). */
export interface ResultadoEnvio {
  sent: boolean;
  dryRun: boolean;
  status?: number;
  /** true si el envío falló de forma reintentable (429/5xx) → el cursor NO avanza. */
  reintentable?: boolean;
}

/** Grupo de novedades de UNA suscripción para el render del digest. */
export interface GrupoDigest {
  /** Nombre del objetivo (proyecto o parlamentario) — heading del grupo. */
  objetivo: string;
  novedades: NovedadEvento[];
}

/** Config del envío (inyectable en tests: fetch fake, base URL, from). */
export interface EnvioConfig {
  apiKey?: string;
  baseUrl: string;
  from: string;
  fetchImpl?: typeof fetch;
  log?: (m: string) => void;
}

// ── Isla de HEX INLINE SANCIONADA (UI-SPEC S5) ────────────────────────────────────
// Los clientes de email NO resuelven CSS vars → el hex es inevitable. Se hornea UNA vez
// aquí, cada valor mapeado a su token de diseño. Ésta es la ÚNICA isla de hex del sistema
// (las superficies del sitio siguen hex-free, guardadas por el bento cero-hex source-scan).
const EMAIL_HEX = {
  background: "#F9F6F0", // --background  (crema 40 33% 97%)
  card: "#FDFBF7", // --card        (40 30% 99%)
  border: "#E3DDD3", // --border      (40 20% ~88%)
  petroleo: "#2A5859", // --accent-product (petróleo 183 38% 26%)
  muted: "#5C6373", // --muted-foreground
} as const;

/** Escapa texto para HTML (los ítems vienen de la DB — nunca inyectar sin escapar). */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Fecha corta (YYYY-MM-DD) de un timestamp ISO o null. */
function fechaCorta(iso: string | null): string {
  if (!iso) return "sin fecha";
  return iso.slice(0, 10);
}

/**
 * Renderiza el digest en HTML (isla de hex inline) + texto plano (multipart). Por grupo:
 * heading del objetivo, ítems `descripción · fuente, fecha · Ver en la fuente ↗`, nota
 * honesta cuando el grupo está vacío. Footer legal CC BY 4.0 + link de baja por token crudo.
 */
export function renderDigest(
  grupos: GrupoDigest[],
  fecha: string,
  baseUrl: string,
  rawBajaToken: string,
): { html: string; text: string } {
  const bajaUrl = `${baseUrl}/notificaciones/baja?t=${rawBajaToken}`;

  const htmlGrupos = grupos
    .map((g) => {
      const items =
        g.novedades.length === 0
          ? `<p style="color:${EMAIL_HEX.muted};font-size:14px;margin:8px 0;">${esc(
              `Sin novedades registradas hoy para lo que sigues, según las fuentes consultadas al ${fecha}.`,
            )}</p>`
          : g.novedades
              .map((n) => {
                const linea = `${n.descripcion ?? n.tipo} · ${n.origen}, ${fechaCorta(n.fecha)}`;
                const ver = n.enlace
                  ? ` · <a href="${esc(n.enlace)}" style="color:${EMAIL_HEX.petroleo};">Ver en la fuente ↗</a>`
                  : "";
                return `<li style="margin:6px 0;font-size:16px;line-height:1.5;">${esc(linea)}${ver}</li>`;
              })
              .join("");
      const listWrap = g.novedades.length === 0 ? items : `<ul style="padding-left:20px;margin:8px 0;">${items}</ul>`;
      return `<tr><td style="padding:16px 24px;background:${EMAIL_HEX.card};border:1px solid ${EMAIL_HEX.border};">
<h2 style="font-size:20px;font-weight:700;margin:0 0 8px;color:${EMAIL_HEX.petroleo};">${esc(g.objetivo)}</h2>
${listWrap}</td></tr>`;
    })
    .join('<tr><td style="height:16px;"></td></tr>');

  const html = `<!doctype html><html><body style="margin:0;background:${EMAIL_HEX.background};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<span style="display:none;">Novedades de los proyectos y parlamentarios que sigues.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_HEX.background};">
<tr><td style="padding:24px;">
<p style="font-size:16px;line-height:1.5;color:#222;">Estas son las novedades registradas desde tu último resumen. Cada dato lleva su fuente y fecha.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${htmlGrupos}</table>
<hr style="border:none;border-top:1px solid ${EMAIL_HEX.border};margin:24px 0;">
<p style="font-size:12px;line-height:1.5;color:${EMAIL_HEX.muted};">Recibes este correo porque te suscribiste en Observatorio del Congreso 360. Datos públicos con atribución CC BY 4.0.</p>
<p style="font-size:12px;"><a href="${esc(bajaUrl)}" style="color:${EMAIL_HEX.petroleo};">Darte de baja</a></p>
</td></tr></table></body></html>`;

  const textGrupos = grupos
    .map((g) => {
      const head = g.objetivo;
      const body =
        g.novedades.length === 0
          ? `  Sin novedades registradas hoy para lo que sigues, según las fuentes consultadas al ${fecha}.`
          : g.novedades
              .map((n) => `  - ${n.descripcion ?? n.tipo} · ${n.origen}, ${fechaCorta(n.fecha)}${n.enlace ? ` · ${n.enlace}` : ""}`)
              .join("\n");
      return `${head}\n${body}`;
    })
    .join("\n\n");

  const text = `Estas son las novedades registradas desde tu último resumen. Cada dato lleva su fuente y fecha.

${textGrupos}

—
Recibes este correo porque te suscribiste en Observatorio del Congreso 360. Datos públicos con atribución CC BY 4.0.
Darte de baja: ${bajaUrl}`;

  return { html, text };
}

/**
 * Envía UN digest por Resend (fetch, one-click List-Unsubscribe). SIN apiKey ⇒ DRY-RUN
 * (no hay fetch, log honesto). Ante 429 respeta retry-after (espera y NO crashea) y marca
 * el envío como reintentable → el CLI NO avanza el cursor. El destinatario NUNCA se loguea
 * crudo (redactEmail). El footer siempre lleva el link de baja con el token CRUDO.
 */
export async function enviarDigest(
  destinatario: string,
  asunto: string,
  html: string,
  text: string,
  rawBajaToken: string,
  cfg: EnvioConfig,
): Promise<ResultadoEnvio> {
  const log = cfg.log ?? ((m: string) => console.log(m));
  const doFetch = cfg.fetchImpl ?? fetch;

  if (!cfg.apiKey) {
    // Degrade honesto: sin API key no se envía a ciegas (mirror @obs/dinero dry-run).
    log(`digest: RESEND_API_KEY missing → dry run (destinatario ${redactEmail(destinatario)})`);
    return { sent: false, dryRun: true };
  }

  const bajaUrl = `${cfg.baseUrl}/notificaciones/baja?t=${rawBajaToken}`;
  const body = JSON.stringify({
    from: cfg.from,
    to: [destinatario],
    subject: asunto,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${bajaUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  const res = await doFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (res.status === 429) {
    // Rate-limit de Resend: respetar retry-after, NO crashear. Reintentable → cursor NO avanza.
    const retryAfter = Number(res.headers.get("retry-after")) || 1;
    log(`digest: 429 de Resend (destinatario ${redactEmail(destinatario)}) → retry-after ${retryAfter}s, diferido`);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return { sent: false, dryRun: false, status: 429, reintentable: true };
  }

  if (!res.ok) {
    // 5xx u otro: reintentable si es 5xx; nunca logueamos el body (puede llevar PII).
    const reintentable = res.status >= 500;
    log(`digest: envío falló (status ${res.status}, destinatario ${redactEmail(destinatario)})`);
    return { sent: false, dryRun: false, status: res.status, reintentable };
  }

  log(`digest: enviado (destinatario ${redactEmail(destinatario)}, status ${res.status})`);
  return { sent: true, dryRun: false, status: res.status };
}
