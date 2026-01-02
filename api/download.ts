// Vercel Edge Runtime handler
export const config = {
    runtime: 'edge',
};

// 256KB buffer for optimal streaming throughput
const CHUNK_SIZE = 256 * 1024;
const STREAMING_BUFFER = new Uint8Array(CHUNK_SIZE).fill(0xaa);

const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export default function handler(request: Request): Response {
    if (request.method === "OPTIONS") {
        return new Response(null, { headers: CORS_HEADERS });
    }

    // Create infinite stream of data chunks
    // Each chunk travels from Vercel edge -> client = real data consumption
    let isActive = true;

    const stream = new ReadableStream({
        pull(controller) {
            if (!isActive) {
                controller.close();
                return;
            }
            controller.enqueue(STREAMING_BUFFER);
        },
        cancel() {
            isActive = false;
        },
    });

    return new Response(stream, {
        status: 200,
        headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/octet-stream",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Data-Waster": "active",
        },
    });
}
