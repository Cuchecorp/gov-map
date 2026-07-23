/**
 * SEC-02 — Guard CI placeholder-only de `.env.example`.
 *
 * `.env.example` está commiteado en el repo PÚBLICO. Un valor con forma de secreto real
 * (sb_secret_*, JWT eyJ*, hex ≥32 chars, connection string con password, R2 key) filtrado
 * ahí es Information Disclosure directa. Este guard VERIFICA que el archivo solo contenga
 * placeholders (vacíos, booleanos, enteros, slugs de config, templates con angle-brackets).
 *
 * Dos secciones:
 *   (1) Aserción contra el archivo REAL: 0 offenders.
 *   (2) Mutation self-check EN MEMORIA: el detector MUERDE ante ≥4 formatos de secreto
 *       real y NO muerde ante ≥6 valores de config legítimos. Prueba que el guard no es
 *       un no-op verde permanente.
 *
 * Molde: `app/lib/money-antiflip-guard.test.ts` (anclas APP_ROOT/REPO_ROOT, detector PURO
 * exportado, mutation self-check §2).
 *
 * ESTE GUARD SOLO LEE Y AFIRMA. Nunca edita `.env.example`. Nunca imprime un valor de secreto.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Rutas — vitest de app/ corre desde el dir app/ (vitest.config.ts vive ahí).
// ---------------------------------------------------------------------------
const APP_ROOT = process.cwd(); // app/
const REPO_ROOT = path.resolve(APP_ROOT, ".."); // raíz del monorepo
const ENV_EXAMPLE = path.join(REPO_ROOT, ".env.example");

// ---------------------------------------------------------------------------
// Detector PURO — dado el contenido completo de un archivo .env, devuelve las
// líneas que parecen contener un valor con forma de secreto real.
// Allowlist de valores config legítimos (no son secretos):
//   - Vacío tras '=' (placeholder standard: KEY=)
//   - Booleanos: false, true
//   - Enteros: 1, 0, etc.
//   - Slugs conocidos: crudo-servel
//   - Templates con angle-brackets: <password>, <host>, etc. (todo el valor es template)
// ---------------------------------------------------------------------------
export function detectarValorNoPlaceholder(envSrc: string): string[] {
  const offenders: string[] = [];

  for (const line of envSrc.split("\n")) {
    const trimmed = line.trim();
    // Ignorar líneas vacías y comentarios
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Solo procesar KEY=value
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;

    const value = trimmed.slice(eqIdx + 1).trim();

    // Allowlist: vacío, booleano, entero, slug simple conocido
    if (value === "") continue;
    if (value === "false" || value === "true") continue;
    if (/^\d+$/.test(value)) continue;
    if (value === "crudo-servel") continue;

    // Allowlist: template con angle-brackets (todo el valor contiene al menos un <...>)
    // p.ej. postgresql://postgres:<password>@<host>:5432/postgres
    if (/<[^>]+>/.test(value)) continue;

    // --- Patrones de secreto real que SÍ deben morder ---

    // sb_secret_* (Supabase service role key)
    if (/^sb_secret_/.test(value)) {
      offenders.push(trimmed);
      continue;
    }

    // JWT: empieza con eyJ (base64url de {"alg":...})
    if (/^eyJ/.test(value)) {
      offenders.push(trimmed);
      continue;
    }

    // Hex ≥32 chars (API keys, tokens hex, digests)
    if (/^[0-9a-fA-F]{32,}$/.test(value)) {
      offenders.push(trimmed);
      continue;
    }

    // Connection string con password real (no placeholder con angle-brackets ya filtrado arriba)
    // postgresql://user:ALGO@host:port/db donde ALGO no tiene angle-brackets
    if (/^postgresql:\/\/[^:]+:[^@<>]+@/.test(value)) {
      offenders.push(trimmed);
      continue;
    }

    // R2 key: contiene .r2.cloudflarestorage.com con credencial en el valor
    if (/\.r2\.cloudflarestorage\.com/.test(value)) {
      offenders.push(trimmed);
      continue;
    }

    // Valor no-vacío de más de 20 chars que no tiene espacios ni es una URL simple:
    // captura otras claves API (GEMINI_API_KEY=AIza..., etc.)
    // Solo morder si parece un token: alfanumérico con guiones/underscores/puntos ≥20 chars
    // SIN espacios, SIN slashes (para no morder URLs de config).
    if (
      value.length >= 20 &&
      /^[A-Za-z0-9_\-\.]{20,}$/.test(value) &&
      !/^(false|true)$/.test(value)
    ) {
      offenders.push(trimmed);
      continue;
    }

    // Base64-ish secret (alfabeto estándar + url-safe): captura HMAC blobs, R2 secret keys,
    // JWT secrets no-eyJ, etc. que contienen '+', '/' o '=' y escapan al regex anterior.
    // Condición: ≥20 chars, sólo alphabet base64 estándar, NO es una URL (sin "://"),
    // y contiene al menos un char base64 ambiguo (+, /, =) para reducir FP en slugs simples.
    if (
      value.length >= 20 &&
      /^[A-Za-z0-9+/=]{20,}$/.test(value) &&
      !value.includes("://") &&
      /[+/=]/.test(value)
    ) {
      offenders.push(trimmed);
      continue;
    }
  }

  return offenders;
}

// ---------------------------------------------------------------------------
// (1) Aserción contra el archivo REAL — 0 offenders en la base de código viva.
// ---------------------------------------------------------------------------
describe("(1) .env.example real — 0 offenders (todos los valores son placeholders)", () => {
  it("sanity: el archivo .env.example existe y es no-vacío", () => {
    const src = readFileSync(ENV_EXAMPLE, "utf-8");
    expect(src.length).toBeGreaterThan(0);
  });

  it(".env.example real → detectarValorNoPlaceholder retorna [] (0 offenders)", () => {
    const src = readFileSync(ENV_EXAMPLE, "utf-8");
    const offenders = detectarValorNoPlaceholder(src);
    expect(
      offenders,
      `Líneas con forma de secreto real en .env.example: [${offenders.join(" | ")}]. ` +
        "Verificar que sean placeholders vacíos o mover el valor real a .env (no commitear secretos).",
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (2) Mutation self-check — el detector MUERDE ante secretos reales y NO muerde
//     ante valores de config legítimos. Fixtures en memoria, sin tocar .env.example.
// ---------------------------------------------------------------------------
describe("(2) Mutation self-check — el detector MUERDE ante valores reales", () => {
  // --- NO MUERDE (valores legítimos de config) ---

  it("NO MUERDE: KEY vacío (placeholder estándar)", () => {
    expect(detectarValorNoPlaceholder("SUPABASE_SECRET_KEY=\n")).toEqual([]);
  });

  it("NO MUERDE: MONEY_PUBLIC_ENABLED=false (booleano)", () => {
    expect(detectarValorNoPlaceholder("MONEY_PUBLIC_ENABLED=false\n")).toEqual([]);
  });

  it("NO MUERDE: PUBLIC_INDEXABLE=false (booleano)", () => {
    expect(detectarValorNoPlaceholder("PUBLIC_INDEXABLE=false\n")).toEqual([]);
  });

  it("NO MUERDE: ADMIN_REVISION_ENABLED=false (booleano)", () => {
    expect(detectarValorNoPlaceholder("ADMIN_REVISION_ENABLED=false\n")).toEqual([]);
  });

  it("NO MUERDE: BACKFILL_ITERATIONS=1 (entero)", () => {
    expect(detectarValorNoPlaceholder("BACKFILL_ITERATIONS=1\n")).toEqual([]);
  });

  it("NO MUERDE: SERVEL_CRUDO_BUCKET=crudo-servel (slug conocido)", () => {
    expect(detectarValorNoPlaceholder("SERVEL_CRUDO_BUCKET=crudo-servel\n")).toEqual([]);
  });

  it("NO MUERDE: SUPABASE_DB_URL con template angle-brackets (placeholder)", () => {
    expect(
      detectarValorNoPlaceholder(
        "SUPABASE_DB_URL=postgresql://postgres:<password>@<host>:5432/postgres\n",
      ),
    ).toEqual([]);
  });

  it("NO MUERDE: comentarios y líneas vacías", () => {
    expect(
      detectarValorNoPlaceholder(
        "# Este es un comentario con sb_secret_fake y eyJhbG\n\n",
      ),
    ).toEqual([]);
  });

  // --- MUERDE (formatos de secreto real) ---

  it("MUERDE: sb_secret_* prefix (service_role key real)", () => {
    const offenders = detectarValorNoPlaceholder(
      "SUPABASE_SECRET_KEY=sb_secret_realvalueXXXXXXXXXXXXXXX\n",
    );
    expect(offenders.length).toBeGreaterThan(0);
  });

  it("MUERDE: JWT eyJ prefix (anon key real)", () => {
    const offenders = detectarValorNoPlaceholder(
      "SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx\n",
    );
    expect(offenders.length).toBeGreaterThan(0);
  });

  it("MUERDE: hex ≥32 chars como valor", () => {
    const offenders = detectarValorNoPlaceholder(
      "R2_SECRET_ACCESS_KEY=aabbccdd11223344aabbccdd11223344\n",
    );
    expect(offenders.length).toBeGreaterThan(0);
  });

  it("MUERDE: connection string con password real (no angle-brackets)", () => {
    const offenders = detectarValorNoPlaceholder(
      "SUPABASE_DB_URL=postgresql://postgres:mysecretpassword123@db.supabase.co:5432/postgres\n",
    );
    expect(offenders.length).toBeGreaterThan(0);
  });

  it("MUERDE: R2 endpoint con .r2.cloudflarestorage.com", () => {
    const offenders = detectarValorNoPlaceholder(
      "R2_ENDPOINT_URL=https://abc123.r2.cloudflarestorage.com\n",
    );
    expect(offenders.length).toBeGreaterThan(0);
  });

  it("MUERDE: base64 con '+' y '/' (HMAC blob, R2 secret key, JWT secret no-eyJ)", () => {
    // Un secreto base64 estándar típico — contiene '/' y '+', escapa al regex alfanumérico anterior
    const offenders = detectarValorNoPlaceholder(
      "R2_SECRET_ACCESS_KEY=abc/def+ghijklmnopqrstuvwxyz1234==\n",
    );
    expect(offenders.length).toBeGreaterThan(0);
  });
});
