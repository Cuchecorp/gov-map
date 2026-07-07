#!/usr/bin/env node
// bros-cli.mjs — wrapper mínimo del MCP de BrowserOS (http://127.0.0.1:9200/mcp)
// para agentes que NO tienen los tools MCP registrados en su sesión (Phase 53/54 UX).
//
// El servidor MCP corre en el host (BrowserOS desktop). Verificado 2026-07-07.
// IMPORTANTE: usar páginas/ventanas OCULTAS (new_hidden_page / create_hidden_window)
// para no interferir con el navegador del operador.
//
// Uso:
//   node scripts/bros-cli.mjs tools                      # lista tools con schema resumido
//   node scripts/bros-cli.mjs schema <tool>              # inputSchema completo de un tool
//   node scripts/bros-cli.mjs call <tool> '<json-args>'  # llamada cruda
// Atajos:
//   node scripts/bros-cli.mjs open <url>                 # new_hidden_page → imprime page id
//   node scripts/bros-cli.mjs shot <page> <abs-path>     # save_screenshot {page, path}
//   node scripts/bros-cli.mjs content <page>             # get_page_content (markdown)
//   node scripts/bros-cli.mjs snapshot <page>            # take_snapshot (elementos interactivos)
//   node scripts/bros-cli.mjs links <page>               # get_page_links
//   node scripts/bros-cli.mjs close <page>               # close_page
//
// Gotchas conocidos (probados 2026-07-07):
//   - save_screenshot usa {page:number, path:string} (NO pageId/filePath).
//   - path de screenshot: ruta ABSOLUTA Windows con forward-slashes OK ("C:/Users/...").
//   - tras open, esperar 4-5s antes del screenshot (SSR + hidratación).
//   - el Page ID INCREMENTA por sesión de browser (no asumir 1) — parsear "Page ID: N"
//     del output de `open`: PID=$(... | grep -oE "Page ID: [0-9]+" | grep -oE "[0-9]+").
//   - save_screenshot puede fallar 1 vez con "CDP request timeout" → reintentar una vez
//     tras sleep 3 (patrón: cmd || (sleep 3; cmd)).

const MCP = process.env.BROS_MCP_URL || "http://127.0.0.1:9200/mcp";

async function rpc(method, params) {
  const res = await fetch(MCP, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const text = await res.text();
  // El endpoint puede responder SSE ("data: {...}") o JSON plano.
  const jsonLine = text.startsWith("data:")
    ? text.split("\n").find((l) => l.startsWith("data: "))?.slice(6)
    : text;
  const parsed = JSON.parse(jsonLine);
  if (parsed.error) throw new Error(`MCP error: ${JSON.stringify(parsed.error)}`);
  return parsed.result;
}

async function callTool(name, args = {}) {
  const result = await rpc("tools/call", { name, arguments: args });
  // El contenido útil viene en result.content[].text; structuredContent si existe.
  const texts = (result.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    // corta el bloque "--- Additional context (auto-included) ---" (ruido)
    .join("\n")
    .split("--- Additional context")[0]
    .trim();
  return { texts, structured: result.structuredContent };
}

const [, , cmd, ...rest] = process.argv;

const die = (msg) => {
  console.error(msg);
  process.exit(1);
};

try {
  switch (cmd) {
    case "tools": {
      const r = await rpc("tools/list", {});
      for (const t of r.tools) console.log(`${t.name} — ${(t.description || "").slice(0, 90)}`);
      break;
    }
    case "schema": {
      const r = await rpc("tools/list", {});
      const t = r.tools.find((x) => x.name === rest[0]);
      if (!t) die(`tool no encontrado: ${rest[0]}`);
      console.log(JSON.stringify(t.inputSchema, null, 2));
      break;
    }
    case "call": {
      const { texts, structured } = await callTool(rest[0], rest[1] ? JSON.parse(rest[1]) : {});
      console.log(texts);
      if (structured) console.log("STRUCTURED: " + JSON.stringify(structured));
      break;
    }
    case "open": {
      const { texts } = await callTool("new_hidden_page", { url: rest[0] });
      console.log(texts);
      break;
    }
    case "shot": {
      const { texts } = await callTool("save_screenshot", { page: Number(rest[0]), path: rest[1] });
      console.log(texts);
      break;
    }
    case "content": {
      const { texts } = await callTool("get_page_content", { page: Number(rest[0]) });
      console.log(texts);
      break;
    }
    case "snapshot": {
      const { texts } = await callTool("take_snapshot", { page: Number(rest[0]) });
      console.log(texts);
      break;
    }
    case "links": {
      const { texts } = await callTool("get_page_links", { page: Number(rest[0]) });
      console.log(texts);
      break;
    }
    case "close": {
      const { texts } = await callTool("close_page", { page: Number(rest[0]) });
      console.log(texts);
      break;
    }
    default:
      die("uso: bros-cli.mjs tools|schema <tool>|call <tool> '<json>'|open <url>|shot <page> <path>|content <page>|snapshot <page>|links <page>|close <page>");
  }
} catch (e) {
  die(String(e?.message ?? e));
}
