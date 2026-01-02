export const config = {
    runtime: 'edge',
};

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req: Request) {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(req.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
        return Response.json({ error: "Missing 'url' parameter" }, { status: 400, headers: CORS_HEADERS });
    }

    try {
        const parsed = new URL(targetUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
            return Response.json({ error: "Only HTTP/HTTPS URLs allowed" }, { status: 400, headers: CORS_HEADERS });
        }

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
}
