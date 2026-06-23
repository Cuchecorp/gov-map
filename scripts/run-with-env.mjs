// run-with-env — carga .env (BOM-safe) a process.env y ejecuta el comando de argv.
// Uso: node scripts/run-with-env.mjs <bin> [args...]
// Necesario porque pipeline-cli de @obs/fichas lee de process.env (NO carga .env solo).
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const raw = readFileSync(join(root, ".env"), "utf8").replace(/^﻿/, "");
const env = { ...process.env };
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
}

const [bin, ...args] = process.argv.slice(2);
if (!bin) {
  console.error("run-with-env: falta el comando a ejecutar");
  process.exit(2);
}
const child = spawn(bin, args, { env, stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error("run-with-env: no se pudo ejecutar:", err.message);
  process.exit(1);
});
