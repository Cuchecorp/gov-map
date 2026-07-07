#!/usr/bin/env node
// rewalk-shot.mjs — one-shot iframe-harness screenshot helper for Phase 53 Wave 3.
// Injects an iframe of the given width pointing at PROD, waits for SSR+hydration,
// and saves a fullPage jpeg. Avoids shell/JSON escaping of evaluate_script.
//
// Usage: node scripts/rewalk-shot.mjs <path> <width> <route> [waitMs]
//   <path>  absolute output path (forward-slashes)
//   <width> iframe width px (390 mobile / 1280 desktop)
//   <route> route relative to PROD base (e.g. "/", "/proyecto/14309-04")

const MCP = process.env.BROS_MCP_URL || "http://127.0.0.1:9200/mcp";
const BASE = "https://observatorio-congreso.thevalis.workers.dev";
const HID = Number(process.env.HARNESS_PAGE || "1");

const [, , outPath, widthStr, route, waitStr] = process.argv;
if (!outPath || !widthStr || !route) {
  console.error("uso: rewalk-shot.mjs <path> <width> <route> [waitMs]");
  process.exit(1);
}
const width = Number(widthStr);
const height = width >= 1000 ? 3200 : 4000; // generous; fullPage crops via content
const waitMs = Number(waitStr || (width >= 1000 ? 7000 : 7000));

async function rpc(method, params) {
  const res = await fetch(MCP, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const text = await res.text();
  const line = text.startsWith("data:")
    ? text.split("\n").find((l) => l.startsWith("data: "))?.slice(6)
    : text;
  const parsed = JSON.parse(line);
  if (parsed.error) throw new Error(`MCP error: ${JSON.stringify(parsed.error)}`);
  return parsed.result;
}
// WR-02 (53-REVIEW): MCP tool failures come back as a SUCCESSFUL JSON-RPC
// response with `result.isError: true` (error text in result.content) — they must
// abort (exit != 0), never print SHOT_OK: this script produces audit evidence.
const callTool = async (name, args) => {
  const result = await rpc("tools/call", { name, arguments: args });
  if (result?.isError) {
    const msg = (result.content ?? [])
      .map((c) => c?.text ?? "")
      .join(" ")
      .trim();
    throw new Error(`tool ${name} failed: ${msg.slice(0, 200)}`);
  }
  return result;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const expr = `var f=document.getElementById('vp')||document.createElement('iframe');`
  + `f.id='vp';`
  + `f.style.cssText='width:${width}px;height:${height}px;border:0;display:block';`
  + `document.body.style.margin='0';`
  + `if(!f.parentNode)document.body.appendChild(f);`
  + `f.src=${JSON.stringify(BASE + route)};`
  + `'ok:'+f.src`;

try {
  const r = await callTool("evaluate_script", { page: HID, expression: expr });
  const t = (r.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join(" ");
  console.log("inject:", t.split("--- Additional")[0].trim().slice(0, 120));
  await sleep(waitMs);
  const shotArgs = { page: HID, path: outPath, fullPage: true, format: "jpeg", quality: 70 };
  try {
    await callTool("save_screenshot", shotArgs);
  } catch (e) {
    console.error("retry after:", String(e?.message ?? e).slice(0, 80));
    await sleep(3000);
    await callTool("save_screenshot", shotArgs);
  }
  console.log("SHOT_OK", outPath);
} catch (e) {
  console.error("FAIL", String(e?.message ?? e));
  process.exit(1);
}
