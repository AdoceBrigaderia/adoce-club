import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4173;

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

export function contentTypeFor(filePath) {
  return MIME_TYPES.get(extname(filePath).toLowerCase()) || "application/octet-stream";
}

export function resolveRequestPath(rootDirectory, requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    return { status: 400, filePath: null };
  }

  if (decodedPath.includes("\0")) {
    return { status: 400, filePath: null };
  }

  const normalizedPath = normalize(decodedPath.replace(/^\/+/, ""));
  const root = resolve(rootDirectory);
  const requested = resolve(root, normalizedPath || "index.html");
  const insideRoot = requested === root || requested.startsWith(`${root}${sep}`);

  if (!insideRoot) {
    return { status: 403, filePath: null };
  }

  if (existsSync(requested) && statSync(requested).isFile()) {
    return { status: 200, filePath: requested };
  }

  const isAssetRequest = extname(normalizedPath) !== "";
  if (isAssetRequest) {
    return { status: 404, filePath: null };
  }

  const indexPath = resolve(root, "index.html");
  if (!existsSync(indexPath)) {
    return { status: 500, filePath: null };
  }

  return { status: 200, filePath: indexPath };
}

export function createPreviewServer({ rootDirectory, host = DEFAULT_HOST } = {}) {
  if (!rootDirectory) {
    throw new Error("Diretório do preview não informado.");
  }

  return createServer((request, response) => {
    const method = request.method || "GET";
    if (method !== "GET" && method !== "HEAD") {
      response.writeHead(405, {
        Allow: "GET, HEAD",
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end("Método não permitido.");
      return;
    }

    const result = resolveRequestPath(rootDirectory, request.url || "/");
    if (!result.filePath) {
      response.writeHead(result.status, {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(result.status === 404 ? "Arquivo não encontrado." : "Requisição inválida.");
      return;
    }

    const headers = {
      "Cache-Control": result.filePath.endsWith("index.html")
        ? "no-store"
        : "public, max-age=3600",
      "Content-Type": contentTypeFor(result.filePath),
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    };

    response.writeHead(200, headers);
    if (method === "HEAD") {
      response.end();
      return;
    }

    const stream = createReadStream(result.filePath);
    stream.on("error", () => {
      if (!response.headersSent) {
        response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      }
      response.end("Falha ao ler o preview.");
    });
    stream.pipe(response);
  });
}

function parseArguments(argv) {
  const options = {
    host: process.env.ADOCE_PREVIEW_HOST || DEFAULT_HOST,
    port: Number(process.env.ADOCE_PREVIEW_PORT || DEFAULT_PORT),
    open: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--open") {
      options.open = true;
    } else if (argument === "--port") {
      options.port = Number(argv[index + 1]);
      index += 1;
    } else if (argument === "--host") {
      options.host = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Argumento desconhecido: ${argument}`);
    }
  }

  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
    throw new Error("Porta inválida.");
  }

  if (options.host !== DEFAULT_HOST && options.host !== "localhost") {
    throw new Error("Por segurança, o preview offline aceita somente localhost/127.0.0.1.");
  }

  return options;
}

function openBrowser(url) {
  const commands = {
    darwin: ["open", [url]],
    linux: ["xdg-open", [url]],
    win32: ["cmd", ["/c", "start", "", url]],
  };
  const entry = commands[process.platform];
  if (!entry) return;
  const child = spawn(entry[0], entry[1], { detached: true, stdio: "ignore" });
  child.unref();
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
  const rootDirectory = resolve(scriptDirectory, "dist");

  if (!existsSync(resolve(rootDirectory, "index.html"))) {
    throw new Error("Pasta dist inválida: index.html não foi encontrado.");
  }

  const server = createPreviewServer({ rootDirectory, host: options.host });
  await new Promise((resolveReady, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, resolveReady);
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port;
  const url = `http://${DEFAULT_HOST}:${port}`;

  console.log("Portal Adoce — validação visual offline");
  console.log(`Acesse: ${url}`);
  console.log("Para encerrar, pressione Ctrl+C.");
  console.log("Produção não foi alterada.");

  if (options.open) {
    openBrowser(url);
  }

  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

const isMainModule = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isMainModule) {
  main().catch((error) => {
    console.error(`Não foi possível iniciar o preview: ${error.message}`);
    process.exitCode = 1;
  });
}
