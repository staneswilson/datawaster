/**
 * Data Waster - Unified Bun Server
 *
 * A high-performance network stress testing tool.
 * Serves both API endpoints and the React frontend via HTML imports.
 */

import { apiRoutes } from "./api/routes";
import homepage from "./client/index.html";
import { CONFIG, CORS_HEADERS } from "./lib/constants";

const _server = Bun.serve({
    port: CONFIG.PORT,

    routes: {
        "/": homepage,
        "/favicon.svg": new Response(Bun.file("./src/client/favicon.svg")),

        "/sitemap.xml": new Response(
            `<?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url>
                    <loc>https://datawaster.pro/</loc>
                    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
                    <changefreq>weekly</changefreq>
                    <priority>1.0</priority>
                </url>
            </urlset>`,
            { headers: { "Content-Type": "application/xml" } },
        ),

        "/robots.txt": new Response(
            `User-agent: *
Allow: /
Sitemap: https://datawaster.pro/sitemap.xml`,
            { headers: { "Content-Type": "text/plain" } },
        ),

        ...apiRoutes,
    },

    development: CONFIG.IS_PRODUCTION
        ? false
        : {
              hmr: true,
              console: true,
          },

    fetch(req) {
        if (req.method === "OPTIONS") {
            return new Response(null, { headers: CORS_HEADERS });
        }
        return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
    },
});

console.log(`
  ⚡ Data Waster

  → Local:   http://localhost:${CONFIG.PORT}
  → Mode:    ${CONFIG.IS_PRODUCTION ? "Production" : "Development"}
  → Runtime: Bun v${Bun.version}
`);
