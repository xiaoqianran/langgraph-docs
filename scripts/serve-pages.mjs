import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "../dist");
const PORT = Number(process.env.PORT || 8080);
const PREFIX = process.env.PAGES_PREFIX || "/langgraph-docs";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function send(res, code, body, type = "text/plain; charset=utf-8") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-cache" });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || "/").split("?")[0]);
  if (url === "/" || url === "") {
    res.writeHead(302, { Location: PREFIX + "/" });
    return res.end();
  }
  if (url === PREFIX || url === PREFIX + "/") url = PREFIX + "/index.html";
  if (!url.startsWith(PREFIX + "/") && url !== PREFIX) {
    return send(res, 404, "Not found");
  }
  let rel = url.slice(PREFIX.length).replace(/^\/+/, "") || "index.html";
  rel = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
  let file = path.join(DIST, rel);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, "index.html");
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    if (fs.existsSync(file + ".html")) file = file + ".html";
    else return send(res, 404, `Not found: ${rel}`);
  }
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`huggingface-docs serve ${PREFIX} from ${DIST} on 0.0.0.0:${PORT}`);
});
