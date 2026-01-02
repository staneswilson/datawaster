// Vercel Edge Runtime - Downloads from REAL external CDNs
export const config = {
    runtime: 'edge',
};

// Real CDN test file URLs (these are actual files that will use real data)
const TEST_URLS = [
    "https://speed.cloudflare.com/__down?bytes=10000000", // 10MB from Cloudflare
    "https://proof.ovh.net/files/10Mb.dat", // 10MB from OVH
];

const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
        return new Response(null, { headers: CORS_HEADERS });
    }

    // Try each CDN URL until one works
    for (const url of TEST_URLS) {
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "DataWaster/1.0 (Network Test Tool)",
                },
            });

            if (response.ok && response.body) {
                // Stream the REAL data from external CDN to client
                return new Response(response.body, {
                    status: 200,
                    headers: {
                        ...CORS_HEADERS,
                        "Content-Type": "application/octet-stream",
                        "Cache-Control": "no-store, no-cache, must-revalidate",
                        "X-Data-Source": url,
                    },
                });
            }
        } catch {
            // Try next URL
            continue;
        }
    }

    // All CDNs failed - return error
    return new Response(
        JSON.stringify({ error: "All CDN sources unavailable" }),
        {
            status: 503,
            headers: {
                ...CORS_HEADERS,
                "Content-Type": "application/json",
            },
        }
    );
}
