/**
 * API route handlers
 */

import { CORS_HEADERS, STREAMING } from "../lib/constants";

export const apiRoutes = {
    "/api/health": () =>
        Response.json({
            status: "ok",
            runtime: `Bun v${Bun.version}`,
            timestamp: new Date().toISOString(),
        }),

    "/api/download": () => {
        const stream = new ReadableStream({
            pull(controller) {
                controller.enqueue(STREAMING.BUFFER);
            },
        });

        return new Response(stream, {
            headers: {
                ...CORS_HEADERS,
                "Content-Type": "application/octet-stream",
                "Cache-Control": "no-store",
            },
        });
    },

    "/api/upload": {
        POST: async (req: Request) => {
            if (req.body) {
                const reader = req.body.getReader();
                while (true) {
                    const { done } = await reader.read();
                    if (done) break;
                }
            }
            return Response.json({ status: "ok" }, { headers: CORS_HEADERS });
        },
    },

    // Proxy endpoint for external downloads (bypasses CORS)
    "/api/proxy": async (req: Request) => {
        const url = new URL(req.url);
        const targetUrl = url.searchParams.get("url");

        if (!targetUrl) {
            return Response.json({ error: "Missing 'url' parameter" }, { status: 400, headers: CORS_HEADERS });
        }

        try {
            // Validate URL
            const parsed = new URL(targetUrl);
            if (!["http:", "https:"].includes(parsed.protocol)) {
                return Response.json({ error: "Only HTTP/HTTPS URLs allowed" }, { status: 400, headers: CORS_HEADERS });
            }

            // Fetch from external source
            const externalRes = await fetch(targetUrl, {
                headers: {
                    "User-Agent": "DataWaster/1.0",
                },
            });

            if (!externalRes.ok) {
                return Response.json(
                    { error: `External server returned ${externalRes.status}` },
                    { status: externalRes.status, headers: CORS_HEADERS },
                );
            }

            // Stream the response back
            return new Response(externalRes.body, {
                headers: {
                    ...CORS_HEADERS,
                    "Content-Type": "application/octet-stream",
                    "Cache-Control": "no-store",
                },
            });
        } catch (err) {
            return Response.json(
                { error: `Proxy error: ${err instanceof Error ? err.message : "Unknown error"}` },
                { status: 500, headers: CORS_HEADERS },
            );
        }
    },
};
