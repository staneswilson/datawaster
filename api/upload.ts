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

    if (req.body) {
        const reader = req.body.getReader();
        while (true) {
            const { done } = await reader.read();
            if (done) break;
        }
    }

    return Response.json({ status: "ok" }, { headers: CORS_HEADERS });
}
