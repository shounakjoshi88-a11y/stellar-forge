import { serve } from "bun";

const SRC = import.meta.dir;
const DIST = import.meta.dir + "/../dist";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".tsx": "application/javascript",
  ".jsx": "application/javascript",
  ".ts": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".webm": "audio/webm",
  ".wav": "audio/wav",
  ".map": "application/json",
};

function contentTypeFor(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf("."));
  return MIME[ext] || "application/octet-stream";
}

const server = serve({
  port: Number(process.env.PORT || 5173),
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname === "/" ? "/index.html" : url.pathname;

    const distPath = DIST + path;
    const distFile = Bun.file(distPath);
    if (await distFile.exists()) {
      return new Response(distFile, { headers: { "Content-Type": contentTypeFor(distPath) } });
    }

    const srcPath = SRC + path;
    const srcFile = Bun.file(srcPath);
    if (await srcFile.exists()) {
      return new Response(srcFile, { headers: { "Content-Type": contentTypeFor(srcPath) } });
    }

    const distIndex = DIST + "/index.html";
    if (await Bun.file(distIndex).exists()) return new Response(Bun.file(distIndex), { headers: { "Content-Type": "text/html" } });
    return new Response(Bun.file(SRC + "/index.html"), { headers: { "Content-Type": "text/html" } });
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`Stellar Forge frontend running at ${server.url}`);
