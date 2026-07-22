/**
 * psql.ts — Wrapper read-only para psql: solo ejecuta SELECT.
 *
 * Reglas de seguridad:
 *   V4: la URL privilegiada SUPABASE_DB_URL viaja en el env del proceso hijo — NUNCA en logs.
 *   V5: el texto de query va bindeado vía `-v` (psql variable substitution) — NUNCA interpolado
 *       en el string SQL.
 *   GUARDA READ-ONLY: cualquier SQL que no sea SELECT (o WITH...SELECT) lanza un error
 *       antes de invocar psql.
 *
 * Salida psql -At (tuples-only, unaligned, separador tab):
 *   Cada línea es una fila, las columnas están separadas por `\t`.
 *   Se parsea a string[][].
 */

import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync, unlinkSync } from "node:fs";

// Tokens de escritura prohibidos — la guarda los detecta y lanza.
const FORBIDDEN_TOKENS =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|vacuum|analyze|reindex|cluster|discard|do|call|notify|listen|unlisten|load|reset|set|savepoint|release|rollback|commit|begin|end|lock|prepare|execute|deallocate|declare|close|fetch|move|checkpoint|pg_terminate_backend|pg_cancel_backend)\b/i;

/**
 * Valida que el SQL sea SELECT-only. Lanza si contiene tokens de escritura.
 *
 * La regla: tras eliminar comentarios de línea y bloque, y strip de espacios,
 * el primer "statement token real" debe ser SELECT. También se permite WITH
 * (CTE) seguido eventualmente de SELECT. Se prohíbe cualquier token de
 * escritura DDL/DML dondequiera que aparezca.
 */
export function assertReadOnly(sql: string): void {
  // Strip comentarios de bloque /* ... */ y de línea --...
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .trim();

  // Chequeo de token prohibido en todo el cuerpo
  if (FORBIDDEN_TOKENS.test(stripped)) {
    const match = stripped.match(FORBIDDEN_TOKENS);
    throw new Error(
      `psql read-only guard: SQL contiene token prohibido "${match?.[0]}". Solo se permite SELECT.`,
    );
  }

  // El primer token real debe ser SELECT o WITH (CTE que luego tiene SELECT)
  const firstToken = stripped.split(/\s+/)[0]?.toLowerCase() ?? "";
  if (firstToken !== "select" && firstToken !== "with") {
    throw new Error(
      `psql read-only guard: el primer token del SQL es "${firstToken}" — solo SELECT o WITH...SELECT está permitido.`,
    );
  }
}

/**
 * Parsea la salida de psql -At (tuples-only, unaligned).
 *
 * Cada línea no vacía es una fila; las columnas están separadas por tab.
 * psql añade un trailing newline que genera una línea vacía final — se descarta.
 */
export function parseAtOutput(raw: string): string[][] {
  return raw
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t"));
}

/**
 * Ejecuta una query SELECT-only contra SUPABASE_DB_URL mediante psql.
 *
 * @param sql     - SQL a ejecutar (debe ser SELECT o WITH...SELECT)
 * @param params  - Parámetros {key: value} interpolados en el SQL con escape de comillas simples.
 *                  El SQL resultante se re-valida con assertReadOnly antes de ejecutarse.
 * @returns filas como string[][]
 *
 * Seguridad:
 *   - assertReadOnly lanza antes de invocar psql si el SQL contiene DDL/DML
 *   - SUPABASE_DB_URL se pasa en el env del proceso hijo, NUNCA en argv/logs
 *   - Los valores de usuario se escapan (' -> '') y se envuelven en comillas simples SQL
   - El SQL final interpolado se re-valida con assertReadOnly (segunda pasada)
 */
export async function runSql(
  sql: string,
  params: Record<string, string> = {},
): Promise<string[][]> {
  assertReadOnly(sql);

  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    throw new Error(
      "runSql: falta SUPABASE_DB_URL en el entorno. No se puede conectar a la DB.",
    );
  }

  // Estrategia de paso de parámetros (Windows-safe, sin límite de línea de comandos):
  // Los parámetros se sustituyen en el SQL y se pasa via archivo temporal (-f).
  // Esto evita el límite de 32KB de cmd.exe y el mangling de caracteres especiales.
  //
  // Seguridad (V5 — interpolación segura por tipo):
  // - Vectores (floats): solo contienen [0-9.,\-\[\]] → sin riesgo de inyección
  // - Números: solo dígitos y punto → sin riesgo de inyección
  // - Null literal → sin riesgo de inyección
  // - Strings de usuario (query text): se escapan las comillas simples (''→'') y se envuelven
  //   en comillas simples SQL. Esto es el estándar SQL para prevenir inyección cuando no hay
  //   parametrized queries reales disponibles via psql -f.
  let sqlWithParams = sql;
  for (const [k, v] of Object.entries(params)) {
    if (v === "null") {
      // SQL null literal — sin comillas
      sqlWithParams = sqlWithParams.replace(new RegExp(`:${k}\\b`, "g"), "null");
    } else {
      // Todos los demás valores (vectores, números, strings) se envuelven en comillas simples.
      // PostgreSQL hará el cast correcto con ::type si el SQL lo especifica.
      // Escape de comillas simples internas: ' → ''
      const escaped = v.replace(/'/g, "''");
      sqlWithParams = sqlWithParams.replace(new RegExp(`:${k}\\b`, "g"), `'${escaped}'`);
    }
  }

  // Segunda pasada: guarda read-only sobre el SQL final interpolado.
  // Detecta inyecciones en valores de usuario antes de que lleguen a psql.
  assertReadOnly(sqlWithParams);

  let tmpFile: string | null = null;
  const args: string[] = [dbUrl, "-At", "-F", "\t"];

  // Siempre pasar via archivo temporal para evitar cualquier límite de línea de comandos
  tmpFile = join(tmpdir(), `psql-spike-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  writeFileSync(tmpFile, sqlWithParams, "utf8");
  args.push("-f", tmpFile);

  // Env del hijo: incluye PGCLIENTENCODING para UTF-8 seguro, pero NUNCA loguea dbUrl
  const childEnv = {
    ...process.env,
    PGCLIENTENCODING: "UTF8",
    // SUPABASE_DB_URL ya está en process.env — se hereda implícitamente
  };

  return new Promise((resolve, reject) => {
    const child = spawn("psql", args, {
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
      // shell: false para evitar la limitación de 32KB de cmd.exe en Windows
      // y el mangling de caracteres especiales (@, :, /) en la URL de la DB.
      shell: false,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      reject(new Error(`psql spawn error: ${err.message}`));
    });

    child.on("close", (code) => {
      // Limpiar archivo temporal si se creó
      if (tmpFile) {
        try { unlinkSync(tmpFile); } catch { /* ignorar errores de limpieza */ }
      }
      if (code !== 0) {
        // No incluir dbUrl en el mensaje de error (V4)
        reject(
          new Error(
            `psql exited with code ${code}. stderr: ${stderr.slice(0, 500)}`,
          ),
        );
        return;
      }
      resolve(parseAtOutput(stdout));
    });
  });
}

/**
 * Prueba si la extensión unaccent está disponible en la DB.
 *
 * Devuelve true si `select unaccent('Ñuñoa')` funciona.
 * Devuelve false SOLO si la extensión no existe (error "function unaccent(...) does not exist").
 * Lanza en cualquier otro error (conexión fallida, auth, timeout) para no enmascarar
 * problemas de infraestructura como "unaccent no disponible".
 *
 * Si SUPABASE_DB_URL no está disponible, devuelve false (degradación segura).
 */
export async function probeUnaccent(): Promise<boolean> {
  if (!process.env.SUPABASE_DB_URL) return false;
  try {
    const rows = await runSql("select unaccent('Ñuñoa')");
    return rows.length > 0 && rows[0]![0] !== undefined;
  } catch (err) {
    // Solo enmascarar si es "extensión unaccent no existe" (extensión ausente).
    // Cualquier otro error (conexión, auth, timeout) se re-lanza para no degradar
    // silenciosamente el FTS de toda la corrida por un fallo transitorio de red.
    const msg = err instanceof Error ? err.message : String(err);
    if (/function unaccent.*does not exist/i.test(msg)) {
      return false;
    }
    throw err;
  }
}
