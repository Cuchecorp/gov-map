#!/usr/bin/env python3
"""Driver mínimo del MCP de BrowserOS por HTTP (v0.0.119).

Workaround: el cliente MCP de Claude Code quedó con la lista de tools vieja
cacheada tras el upgrade del server. Hablamos JSON-RPC directo a 127.0.0.1:9200.

Uso:
  python bros.py tabs
  python bros.py nav <page> <url>
  python bros.py shot <page> <outfile.jpg>
  python bros.py read <page> [selector]
"""
import json, sys, base64, urllib.request

URL = "http://127.0.0.1:9200/mcp"
_id = [10]

def call(name, args):
    _id[0] += 1
    body = json.dumps({"jsonrpc": "2.0", "id": _id[0],
                       "method": "tools/call",
                       "params": {"name": name, "arguments": args}}).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read().decode("utf-8")
    # streamable-http puede venir como SSE; quedarse con la última línea JSON
    txt = raw
    if raw.lstrip().startswith("event:") or "\ndata:" in raw:
        for line in raw.splitlines():
            if line.startswith("data:"):
                txt = line[5:].strip()
    return json.loads(txt)

def main():
    cmd = sys.argv[1]
    if cmd == "tabs":
        d = call("tabs", {"action": "list"})
        for p in d["result"]["structuredContent"]["pages"]:
            print(p["page"], p["url"], "::", p["title"])
    elif cmd == "nav":
        page, url = int(sys.argv[2]), sys.argv[3]
        d = call("navigate", {"page": page, "action": "url", "url": url})
        print("navigated", page, "->", url)
    elif cmd == "shot":
        page, out = int(sys.argv[2]), sys.argv[3]
        d = call("screenshot", {"page": page})
        for it in d["result"]["content"]:
            if it.get("type") == "image":
                open(out, "wb").write(base64.b64decode(it["data"]))
                print("saved", out, it.get("mimeType"))
                return
        print("NO IMAGE", json.dumps(d)[:400])
    elif cmd == "read":
        page = int(sys.argv[2])
        args = {"page": page}
        if len(sys.argv) > 3:
            args["selector"] = sys.argv[3]
        d = call("read", args)
        for it in d["result"]["content"]:
            print(it.get("text", "")[:6000])

if __name__ == "__main__":
    main()
