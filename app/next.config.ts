import type { NextConfig } from "next";

// Cabeceras de seguridad HTTP conservadoras (WR-01 — 85-SEC-REVIEW.md).
// Se aplican a TODAS las rutas vía el Worker de OpenNext (SSR + API routes).
// Para assets estáticos servidos por Cloudflare Assets, ver public/_headers.
//
// CSP: solo Report-Only para no bloquear la hidratación de Next.js (inline
// scripts en __NEXT_DATA__ y el bootstrap runtime). Una CSP enforced requiere
// nonces/hashes que el build de OpenNext no inyecta hoy — pendiente de
// validación post-deploy. El resto de cabeceras son seguras para aplicar ya.
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
  // CSP en modo Report-Only: detecta violaciones sin romper el sitio.
  // Cuando se confirme que no hay violaciones en prod, promover a enforced.
  // PENDIENTE OPERADOR: configurar report-uri antes de hacer enforced.
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
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
