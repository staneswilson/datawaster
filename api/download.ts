// Vercel Edge Runtime handler - finite chunks to avoid timeout
export const config = {
    runtime: 'edge',
};

// 10MB per request to stay well under timeout limits
const TARGET_BYTES = 10 * 1024 * 1024;
const CHUNK_SIZE = 256 * 1024; // 256KB per chunk
const CHUNKS_PER_REQUEST = Math.ceil(TARGET_BYTES / CHUNK_SIZE);

// Pre-filled buffer for streaming
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

    let chunksSent = 0;

    // Stream exactly 10MB then close - client will make another request
    const stream = new ReadableStream({
        pull(controller) {
            if (chunksSent >= CHUNKS_PER_REQUEST) {
                controller.close();
                return;
            }
            controller.enqueue(STREAMING_BUFFER);
            chunksSent++;
        },
        cancel() {
            // Client cancelled, clean up
        },
    });

    return new Response(stream, {
        status: 200,
        headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/octet-stream",
            "Content-Length": String(TARGET_BYTES),
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Data-Waster": "active",
        },
    });
}
