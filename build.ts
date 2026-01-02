import bunPluginTailwind from "bun-plugin-tailwind";
import { cp, rm } from "node:fs/promises";

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const CONFIG = {
    entrypoint: "./src/client/main.tsx",
    outDir: "./dist",
    assetsDir: "./dist/assets",
    publicDir: "./public",
    htmlTemplate: "./index.html",
};

// ─────────────────────────────────────────────────────────────
// Logger
// ─────────────────────────────────────────────────────────────

const log = {
    info: (msg: string) => console.log(`\x1b[36mi\x1b[0m  ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m✔\x1b[0m  ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m✖\x1b[0m  ${msg}`),
    step: (msg: string) => console.log(`\n\x1b[1m⚡ ${msg}\x1b[0m`),
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function minifyHTML(html: string): Promise<string> {
    return html
        .replace(/<!--[\s\S]*?-->/g, "") // Remove comments
        .replace(/\s+/g, " ") // Collapse whitespace
        .replace(/>\s+</g, "><") // Remove space between tags
        .trim();
}

// ─────────────────────────────────────────────────────────────
// Main Build
// ─────────────────────────────────────────────────────────────

async function build() {
    const startTime = performance.now();

    try {
        log.step("Initializing Production Build...");

        // 1. Clean Dist
        log.info("Cleaning previous build artifacts...");
        await rm(CONFIG.outDir, { recursive: true, force: true });

        // 2. Build Client Bundle
        log.step("Bundling Application...");
        const result = await Bun.build({
            entrypoints: [CONFIG.entrypoint],
            outdir: CONFIG.assetsDir,
            minify: true,
            target: "browser",
            sourcemap: "external",
            plugins: [bunPluginTailwind],
            naming: "[name]-[hash].[ext]",
            define: {
                "process.env.NODE_ENV": JSON.stringify("production"),
            },
        });

        if (!result.success) {
            log.error("Bundle Failed:");
            for (const msg of result.logs) console.error(msg);
            process.exit(1);
        }

        log.success(`Generated ${result.outputs.length} asset(s)`);

        // 3. Process & Inject HTML
        log.step("Processing HTML...");

        const jsArtifact = result.outputs.find(o => o.path.endsWith(".js"));
        // Tailwind plugin typically compiles CSS into the JS or outputs a css file
        // We scan for a CSS file just in case the plugin configuration emits one
        const cssArtifact = result.outputs.find(o => o.path.endsWith(".css"));

        if (!jsArtifact) {
            throw new Error("Build did not generate a JavaScript bundle.");
        }

        // Get filenames relative to assets dir
        const jsFilename = jsArtifact.path.split(/[\\/]/).pop();
        const cssFilename = cssArtifact?.path.split(/[\\/]/).pop();

        let html = await Bun.file(CONFIG.htmlTemplate).text();

        // Inject JS Bundle (Use defer to prevent blocking)
        // Replaces the dev script tag: <script type="module" src="/src/client/main.tsx"></script>
        html = html.replace(
            /<script type="module" src="[^"]+"><\/script>/,
            `<script type="module" src="/assets/${jsFilename}" defer></script>`
        );

        // Inject CSS if present (Tailwind v4 might be chunked)
        if (cssFilename) {
            html = html.replace(
                /<\/head>/,
                `<link rel="stylesheet" href="/assets/${cssFilename}">\n</head>`
            );
        }

        // Minify HTML
        const minifiedHtml = await minifyHTML(html);
        await Bun.write(`${CONFIG.outDir}/index.html`, minifiedHtml);
        log.success("HTML injected and minified");

        // 4. Copy Static Assets
        log.step("Copying Public Assets...");
        // Check if public dir exists before copying to avoid error
        // Note: fs.cp with recursive creates dest, but src must exist. 
        // We assume publicDir exists as per project structure.
        await cp(CONFIG.publicDir, CONFIG.outDir, { recursive: true });

        // 5. Finalize
        const duration = ((performance.now() - startTime) / 1000).toFixed(2);
        log.step("Build Summary");
        log.success(`Complete in ${duration}s`);
        log.info(`Output Directory: ${CONFIG.outDir}`);
        log.info("Ready for Vercel Deployment 🚀");

    } catch (error) {
        console.error("\n");
        log.error(`Fatal Build Error:`);
        if (error instanceof Error) {
            console.error(error.message);
            console.error(error.stack);
        } else {
            console.error(String(error));
        }
        process.exit(1);
    }
}

build();
