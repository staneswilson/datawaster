// Vercel Edge Runtime handler
export const config = {
    runtime: 'edge',
};

const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
        return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
    }

    let bytesReceived = 0;

    if (request.body) {
        const reader = request.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
                bytesReceived += value.length;
            }
        }
    }

    return new Response(
        JSON.stringify({ status: "ok", bytesReceived }),
        {
            status: 200,
            headers: {
                ...CORS_HEADERS,
                "Content-Type": "application/json",
            },
        }
    );
}
