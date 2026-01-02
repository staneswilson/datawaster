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

    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
    }

    let bytesReceived = 0;

    if (req.body) {
        const reader = req.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
                bytesReceived += value.length;
            }
        }
    }

    return Response.json(
        { status: "ok", bytesReceived },
        { headers: CORS_HEADERS }
    );
}
