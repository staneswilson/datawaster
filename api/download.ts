export const config = {
    runtime: 'edge',
};

const STREAMING = {
    CHUNK_SIZE: 1024 * 1024,
    BUFFER: (() => {
        const buf = new Uint8Array(1024 * 1024);
        buf.fill(0xaa);
        return buf;
    })(),
};

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export default function handler(req: Request) {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: CORS_HEADERS });
    }

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
}
