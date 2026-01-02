/**
 * Local Development Server
 * Serves static files from dist/ and handles API routes
 */

import proxyHandler from "./api/proxy";
import downloadHandler from "./api/download";
import uploadHandler from "./api/upload";

const PORT = 3000;

const server = Bun.serve({
    port: PORT,

    async fetch(req) {
        const url = new URL(req.url);
        const pathname = url.pathname;

        // API Routes
        if (pathname === "/api/proxy") {
            return proxyHandler(req);
        }
        if (pathname === "/api/download") {
            return downloadHandler(req);
        }
        if (pathname === "/api/upload") {
            return uploadHandler(req);
        }

        // Static file serving from dist/
        let filePath = `./dist${pathname}`;

        // Default to index.html for SPA routing
        if (pathname === "/" || !pathname.includes(".")) {
            filePath = "./dist/index.html";
        }

        const file = Bun.file(filePath);
        if (await file.exists()) {
            return new Response(file);
        }

        // Fallback to index.html for SPA
        return new Response(Bun.file("./dist/index.html"));
    },
});

console.log(`
  ⚡ Data Waster Dev Server

  → Local:   http://localhost:${PORT}
  → API:     http://localhost:${PORT}/api/*
  → Runtime: Bun v${Bun.version}
`);
