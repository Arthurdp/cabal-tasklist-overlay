// Servidor estático mínimo (sem dependências) para usar o overlay como
// "Browser Source" no OBS ou testar no navegador: `npm run start:web`.
// O app Electron NÃO usa este servidor — ele carrega os arquivos direto do disco.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

function startServer(port = PORT) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
    const filePath = path.normalize(path.join(PUBLIC_DIR, relative));

    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end("Not found");
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(data);
    });
  });

  server.listen(port, () => {
    console.log("====================================================");
    console.log("Cabal Online Task List Overlay rodando com sucesso!");
    console.log(`Acesse no OBS Browser Source: http://localhost:${port}`);
    console.log("====================================================");
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
