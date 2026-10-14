/**
 * Local raw-print agent for the cashier PC (Xprinter / Epson USB via the Windows printer queue).
 * Listens on 127.0.0.1:17888 so the POS page can print without a browser dialog.
 */
const http = require("http");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HOST = "127.0.0.1";
const PORT = Number(process.env.EPSON_PRINT_PORT || 17888);
const PRINTER = process.env.EPSON_PRINTER_NAME || "";
const PS1 = path.join(__dirname, "epson-raw-print.ps1");

let cached = { at: 0, selected: null, printers: [] };
let scanning = false;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
}

function refreshPrintersSoon() {
  if (scanning) return;
  if (cached.at && Date.now() - cached.at < 15000) return;
  scanning = true;
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS1, "-List"];
  if (PRINTER) args.push("-PrinterName", PRINTER);
  const child = spawn("powershell.exe", args, { windowsHide: true });
  let out = "";
  const timer = setTimeout(() => {
    try {
      child.kill();
    } catch {
      /* already finished */
    }
  }, 50000);
  child.stdout.on("data", (d) => {
    out += d.toString();
  });
  child.on("close", (code) => {
    clearTimeout(timer);
    scanning = false;
    const raw = out.trim();
    const jsonStart = raw.lastIndexOf("{");
    if (code === 0 && jsonStart >= 0) {
      try {
        const parsed = JSON.parse(raw.slice(jsonStart));
        cached = {
          at: Date.now(),
          selected: parsed.selected || PRINTER || null,
          printers: Array.isArray(parsed.printers) ? parsed.printers : [],
        };
        console.log(`Printer scan: ${cached.selected || "none"} (${cached.printers.length})`);
      } catch {
        cached = { ...cached, at: Date.now() };
      }
    } else {
      cached = { ...cached, at: Date.now() };
    }
  });
}

function printBuffer(buf) {
  const tmp = path.join(os.tmpdir(), `hms-epson-${Date.now()}.bin`);
  fs.writeFileSync(tmp, buf);
  try {
    const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS1, "-FilePath", tmp];
    const name = PRINTER || cached.selected || "";
    if (name) args.push("-PrinterName", name);
    const r = spawnSync("powershell.exe", args, { encoding: "utf8", windowsHide: true, timeout: 60000 });
    if (r.status !== 0) {
      cached.at = 0;
      throw new Error((r.stderr || r.stdout || `exit ${r.status}`).toString().slice(0, 400));
    }
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

const server = http.createServer((req, res) => {
  cors(res);
  const url = (req.url || "/").split("?")[0];
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "GET" && (url === "/health" || url === "/" || url === "/printers")) {
    const info = cached.at ? cached : { selected: null, printers: [] };
    refreshPrintersSoon();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        printer: info.selected || "none",
        printers: info.printers,
      }),
    );
    return;
  }
  if (req.method === "POST" && url === "/print") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const buf = Buffer.concat(chunks);
        if (!buf.length) throw new Error("Empty print payload");
        printBuffer(buf);
        res.writeHead(204);
        res.end();
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(e && e.message ? e.message : e) }));
      }
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, HOST, () => {
  console.log(`Receipt print agent http://${HOST}:${PORT} printer=scanning`);
  refreshPrintersSoon();
});
