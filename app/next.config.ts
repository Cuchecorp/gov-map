import type { NextConfig } from "next";

// Cabeceras de seguridad HTTP conservadoras (WR-01 — 85-SEC-REVIEW.md).
// Se aplican a TODAS las rutas vía el Worker de OpenNext (SSR + API routes).
// Para assets estáticos servidos por Cloudflare Assets, ver public/_headers.
//
// CSP: enforced desde v9.0 Plan 03 (SEC-02). script-src mantiene 'unsafe-inline'
// porque el worker estático de OpenNext no soporta nonce per-request.
// Validación empírica en el deploy real (0 errores CSP, hidratación viva).
const securityHeaders = [
  // Anti-clickjacking: el sitio no usa iframes propios → DENY es seguro.
  { key: "X-Frame-Options", value: "DENY" },
  // Previene MIME-type sniffing en browsers viejos.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Minimiza datos del referer enviados a terceros.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // HSTS: fuerza HTTPS por 1 año + incluye subdominios.
  // Nota: solo tiene efecto si el sitio sirve por HTTPS (Cloudflare Workers → sí).
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // Permissions-Policy: deshabilita APIs sensibles no usadas por el sitio.
  {
    key: "Permissions-Policy",
    value: "geolocation=(), microphone=(), camera=()",
  },
  // CSP enforced pragmático (unsafe-inline en script-src porque el worker
  // estático no soporta nonce per-request; object-src none + frame-ancestors
  // none como defensa de injection). SEC-02 — v9.0 milestone final.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'", // Next hidrata inline sin nonce en OpenNext estático
      "connect-src 'self'", // navegador NO habla con Supabase directo (todo server-side); validado en deploy
      "object-src 'none'", // NET-NEW vs la política anterior
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Aplica a todas las rutas.
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

// @opennextjs/cloudflare: habilita los bindings de Cloudflare en `next dev` y
// `opennextjs-cloudflare preview`. Solo corre en desarrollo; no afecta el build de prod.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
void initOpenNextCloudflareForDev();
