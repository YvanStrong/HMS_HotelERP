/**
 * Reverse proxy for kivucloud.rw
 * HTTP :80  — ACME challenges + redirect to HTTPS once a cert exists
 * HTTPS :443 — UI :3000 and API :8080
 */
const fs = require("fs");
const http = require("http");
const https = require("https");
const net = require("net");
const path = require("path");

const HTTP_PORT = Number(process.env.HMS_PROXY_PORT || 80);
const HTTPS_PORT = Number(process.env.HMS_PROXY_TLS_PORT || 443);
const UPSTREAM_TIMEOUT_MS = Number(process.env.HMS_PROXY_TIMEOUT_MS || 120000);
const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");
const FRONTEND = { host: "127.0.0.1", port: 3000 };
const BACKEND = { host: "127.0.0.1", port: 8080 };
const upstreamAgent = new http.Agent({ keepAlive: true, maxSockets: 64 });

const CERT_DIR = process.env.HMS_CERT_DIR
  ? path.resolve(process.env.HMS_CERT_DIR)
  : path.join(__dirname, "..", "certs");
const ACME_ROOT = path.join(CERT_DIR, "acme-www");
const KEY_FILE = path.join(CERT_DIR, "privkey.pem");
const CERT_FILE = path.join(CERT_DIR, "fullchain.pem");

function isUploadPath(url) {
  const urlPath = String(url || "/").split("?")[0];
  return urlPath === "/uploads" || urlPath.startsWith("/uploads/");
}

function serveUpload(req, res) {
  const urlPath = decodeURIComponent(String(req.url || "/").split("?")[0]);
  const rel = urlPath.replace(/^\/uploads\/?/, "");
  if (!rel || rel.includes("..") || rel.includes("\\") || rel.includes("/")) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("bad path");
    return;
  }
  const file = path.resolve(path.join(UPLOAD_ROOT, rel));
  const root = path.resolve(UPLOAD_ROOT);
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("bad path");
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const types = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream", "Cache-Control": "public, max-age=86400" });
    res.end(data);
  });
}

function isBackendPath(url) {
  const urlPath = String(url || "/").split("?")[0];
  return (
    urlPath === "/api" ||
    urlPath.startsWith("/api/") ||
    urlPath === "/ws" ||
    urlPath.startsWith("/ws/") ||
    urlPath.startsWith("/swagger-ui") ||
    urlPath.startsWith("/v3/api-docs") ||
    urlPath.startsWith("/actuator")
  );
}

function isAcmePath(url) {
  const urlPath = String(url || "/").split("?")[0];
  return urlPath.startsWith("/.well-known/acme-challenge/");
}

function serveAcme(req, res) {
  const urlPath = decodeURIComponent(String(req.url || "/").split("?")[0]);
  const token = path.basename(urlPath);
  if (!token || token === "." || token === "..") {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("bad token");
    return;
  }
  const file = path.join(ACME_ROOT, ".well-known", "acme-challenge", token);
  const resolved = path.resolve(file);
  const allowedRoot = path.resolve(path.join(ACME_ROOT, ".well-known", "acme-challenge"));
  if (!resolved.startsWith(allowedRoot + path.sep) && resolved !== allowedRoot) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("bad token");
    return;
  }
  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(data);
  });
}

function redirectHttps(req, res) {
  const host = String(req.headers.host || "kivucloud.rw").split(":")[0];
  res.writeHead(301, {
    Location: `https://${host}${req.url || "/"}`,
    "Content-Type": "text/plain",
  });
  res.end("Redirecting to HTTPS");
}

function proxyHttp(req, res, proto) {
  const target = isBackendPath(req.url) ? BACKEND : FRONTEND;
  const headers = { ...req.headers };
  headers.host = req.headers.host || "kivucloud.rw";
  const forwarded = req.socket.remoteAddress || "";
  headers["x-forwarded-for"] = forwarded;
  headers["x-forwarded-proto"] = proto;
  headers["x-forwarded-host"] = headers.host;

  const up = http.request(
    {
      hostname: target.host,
      port: target.port,
      path: req.url,
      method: req.method,
      headers,
      agent: upstreamAgent,
      timeout: UPSTREAM_TIMEOUT_MS,
    },
    (incoming) => {
      res.writeHead(incoming.statusCode || 502, incoming.headers);
      incoming.pipe(res);
    }
  );
  up.on("timeout", () => up.destroy(new Error("upstream timeout")));
  up.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end(`Bad gateway (${target.port}): ${err.message}`);
  });
  req.pipe(up);
}

function proxyUpgrade(req, socket, head) {
  const target = isBackendPath(req.url) ? BACKEND : FRONTEND;
  const up = net.connect(
    { port: target.port, host: target.host, timeout: UPSTREAM_TIMEOUT_MS },
    () => {
      const headerLines = [`${req.method} ${req.url} HTTP/1.1`];
      for (const [key, value] of Object.entries(req.headers)) {
        if (value == null) continue;
        headerLines.push(`${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
      }
      headerLines.push("", "");
      up.write(headerLines.join("\r\n"));
      if (head && head.length) up.write(head);
      up.pipe(socket);
      socket.pipe(up);
    }
  );
  up.on("timeout", () => up.destroy());
  up.on("error", () => socket.destroy());
  socket.on("error", () => up.destroy());
}

function loadTlsOptions() {
  if (!fs.existsSync(KEY_FILE) || !fs.existsSync(CERT_FILE)) return null;
  return {
    key: fs.readFileSync(KEY_FILE),
    cert: fs.readFileSync(CERT_FILE),
  };
}

fs.mkdirSync(path.join(ACME_ROOT, ".well-known", "acme-challenge"), { recursive: true });
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const tlsOptions = loadTlsOptions();

const httpServer = http.createServer((req, res) => {
  if (isAcmePath(req.url)) {
    serveAcme(req, res);
    return;
  }
  if (tlsOptions) {
    redirectHttps(req, res);
    return;
  }
  proxyHttp(req, res, "http");
});
httpServer.on("upgrade", (req, socket, head) => {
  if (tlsOptions) {
    socket.destroy();
    return;
  }
  proxyUpgrade(req, socket, head);
});
httpServer.keepAliveTimeout = 65000;
httpServer.headersTimeout = 66000;
httpServer.listen(HTTP_PORT, "0.0.0.0", () => {
  console.log(`kivucloud.rw HTTP on :${HTTP_PORT}${tlsOptions ? " (redirects to HTTPS)" : ""}`);
});
httpServer.on("error", (err) => {
  console.error(err);
  process.exit(1);
});

if (tlsOptions) {
  const httpsServer = https.createServer(tlsOptions, (req, res) => {
    if (isAcmePath(req.url)) {
      serveAcme(req, res);
      return;
    }
    if (isUploadPath(req.url)) {
      serveUpload(req, res);
      return;
    }
    proxyHttp(req, res, "https");
  });
  httpsServer.on("upgrade", proxyUpgrade);
  httpsServer.keepAliveTimeout = 65000;
  httpsServer.headersTimeout = 66000;
  httpsServer.listen(HTTPS_PORT, "0.0.0.0", () => {
    console.log(
      `kivucloud.rw HTTPS on :${HTTPS_PORT} -> UI :${FRONTEND.port}, API :${BACKEND.port}`
    );
  });
  httpsServer.on("error", (err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  console.log("No TLS cert yet; serving the app on HTTP until certs/privkey.pem exists.");
}
