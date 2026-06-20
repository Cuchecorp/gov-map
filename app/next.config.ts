import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// @opennextjs/cloudflare: habilita los bindings de Cloudflare en `next dev` y
// `opennextjs-cloudflare preview`. Solo corre en desarrollo; no afecta el build de prod.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
void initOpenNextCloudflareForDev();
