/**
 * Application constants and configuration
 */

export const CONFIG = {
    PORT: Number(process.env.PORT) || 3000,
    IS_PRODUCTION: process.env.NODE_ENV === "production",
} as const;

export const STREAMING = {
    /** Chunk size for streaming (1MB) */
    CHUNK_SIZE: 1024 * 1024,
    /** Pre-allocated buffer filled with dummy data */
    BUFFER: (() => {
        const buf = new Uint8Array(1024 * 1024);
        buf.fill(0xaa);
        return buf;
    })(),
} as const;

export const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
} as const;
