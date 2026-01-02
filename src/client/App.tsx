import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / 1024 ** i).toFixed(2)} ${sizes[i]}`;
}

function formatSpeed(bps: number): { value: string; unit: string } {
    const bits = bps * 8;
    if (bits === 0) return { value: "0", unit: "bps" };
    const sizes = ["bps", "Kbps", "Mbps", "Gbps"];
    const i = Math.min(Math.floor(Math.log(bits) / Math.log(1000)), sizes.length - 1);
    return { value: (bits / 1000 ** i).toFixed(1), unit: sizes[i] };
}

function formatTime(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type Mode = "download" | "upload" | "both";

// ─────────────────────────────────────────────────────────────
// Toggle Switch Component
// ─────────────────────────────────────────────────────────────

function ToggleSwitch({
    checked,
    onChange,
    disabled,
    activeColor = "bg-linear-to-r from-purple-600 to-pink-600",
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    activeColor?: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label="Toggle unlimited mode"
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 ease-out
                ${checked ? activeColor : "bg-zinc-700/80"}
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:scale-105"}
                focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-2 focus:ring-offset-zinc-900`}
        >
            <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-all duration-300 ease-out
                    ${checked ? "translate-x-8" : "translate-x-1"}
                    ${checked ? "shadow-purple-500/50" : ""}`}
            />
        </button>
    );
}

// ─────────────────────────────────────────────────────────────
// Animated Counter Component
// ─────────────────────────────────────────────────────────────

function AnimatedNumber({ value, className = "" }: { value: string; className?: string }) {
    return <span className={`inline-block tabular-nums transition-all duration-300 ${className}`}>{value}</span>;
}

// ─────────────────────────────────────────────────────────────
// Stat Card Component
// ─────────────────────────────────────────────────────────────

function StatCard({
    label,
    value,
    unit,
    icon,
    highlight = false,
}: {
    label: string;
    value: string;
    unit?: string;
    icon: string;
    highlight?: boolean;
}) {
    return (
        <article
            className={`glass rounded-2xl p-4 md:p-5 border transition-all duration-300 hover:scale-[1.02]
                ${highlight ? "border-purple-500/50 glow-purple" : "border-zinc-800/50 hover:border-zinc-700"}`}
        >
            <div className="flex items-center gap-2 mb-2">
                <span className="text-lg" role="img" aria-hidden="true">
                    {icon}
                </span>
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">{label}</p>
            </div>
            <div className="flex items-baseline gap-1.5">
                <AnimatedNumber
                    value={value}
                    className={`text-2xl md:text-3xl font-bold ${highlight ? "text-purple-300" : ""}`}
                />
                {unit && <span className="text-sm text-purple-400 font-medium">{unit}</span>}
            </div>
        </article>
    );
}

// ─────────────────────────────────────────────────────────────
// Hook: Data Waster Engine
// ─────────────────────────────────────────────────────────────

function useDataWaster() {
    const [active, setActive] = useState(false);
    const [mode, setMode] = useState<Mode>("download");
    const [threads, setThreads] = useState(4);
    const [stats, setStats] = useState({ speedBps: 0, totalBytes: 0, elapsed: 0 });
    const [stoppedReason, setStoppedReason] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "error">("idle");

    const [dataLimitMB, setDataLimitMB] = useState(100);
    const [enableLimit, setEnableLimit] = useState(true);

    const bytesRef = useRef(0);
    const lastBytesRef = useRef(0);
    const startTimeRef = useRef(0);
    const activeRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);
    // 512KB upload chunks for better throughput
    const uploadChunk = useRef(new Uint8Array(512 * 1024).fill(0xaa));
    const limitRef = useRef({ enabled: enableLimit, limitBytes: dataLimitMB * 1024 * 1024 });

    useEffect(() => {
        limitRef.current = { enabled: enableLimit, limitBytes: dataLimitMB * 1024 * 1024 };
    }, [enableLimit, dataLimitMB]);

    const stopWithReason = useCallback((reason: string) => {
        setStoppedReason(reason);
        setActive(false);
        abortRef.current?.abort();
    }, []);

    const downloadWorker = useCallback(
        async (signal: AbortSignal) => {
            let retryCount = 0;
            const maxRetries = 3;

            // Direct CDN URLs - fetched directly by browser (real data consumption)
            const cdnUrls = [
                "https://speed.cloudflare.com/__down?bytes=26214400", // 25MB
                "https://speed.hetzner.de/100MB.bin", // 100MB backup
            ];

            while (!signal.aborted && activeRef.current) {
                try {
                    if (limitRef.current.enabled && bytesRef.current >= limitRef.current.limitBytes) {
                        stopWithReason(`✓ Target reached: ${formatBytes(limitRef.current.limitBytes)}`);
                        return;
                    }

                    // Add cache-busting parameter to prevent any caching
                    const url = `${cdnUrls[0]}&t=${Date.now()}`;

                    // Direct fetch from CDN - data flows directly to browser
                    const res = await fetch(url, {
                        signal,
                        cache: "no-store",
                        mode: "cors",
                    });

                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}`);
                    }

                    setConnectionStatus("connected");
                    retryCount = 0;

                    const reader = res.body?.getReader();
                    if (reader) {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done || signal.aborted) break;
                            if (value) {
                                bytesRef.current += value.length;
                                if (limitRef.current.enabled && bytesRef.current >= limitRef.current.limitBytes) {
                                    reader.cancel();
                                    stopWithReason(`✓ Target reached: ${formatBytes(limitRef.current.limitBytes)}`);
                                    return;
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error("[DataWaster] Download error:", error);
                    if (signal.aborted) return;
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        setConnectionStatus("error");
                    }
                    // Exponential backoff: 500ms, 1s, 2s
                    await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** (retryCount - 1), 2000)));
                }
            }
        },
        [stopWithReason],
    );

    const uploadWorker = useCallback(
        async (signal: AbortSignal) => {
            let retryCount = 0;
            const maxRetries = 3;

            while (!signal.aborted && activeRef.current) {
                try {
                    if (limitRef.current.enabled && bytesRef.current >= limitRef.current.limitBytes) {
                        stopWithReason(`✓ Target reached: ${formatBytes(limitRef.current.limitBytes)}`);
                        return;
                    }

                    const res = await fetch("/api/upload", {
                        method: "POST",
                        body: uploadChunk.current,
                        signal,
                        cache: "no-store",
                    });

                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}`);
                    }

                    setConnectionStatus("connected");
                    retryCount = 0;
                    bytesRef.current += uploadChunk.current.length;
                } catch (error) {
                    console.error("[DataWaster] Upload error:", error);
                    if (signal.aborted) return;
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        setConnectionStatus("error");
                    }
                    await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** (retryCount - 1), 2000)));
                }
            }
        },
        [stopWithReason],
    );

    const start = useCallback(() => {
        setStoppedReason(null);
        setConnectionStatus("idle");
        startTimeRef.current = Date.now();
        bytesRef.current = 0;
        lastBytesRef.current = 0;
        activeRef.current = true;
        abortRef.current = new AbortController();
        const signal = abortRef.current.signal;

        for (let i = 0; i < threads; i++) {
            if (mode === "download" || mode === "both") downloadWorker(signal);
            if (mode === "upload" || mode === "both") uploadWorker(signal);
        }

        setActive(true);
    }, [threads, mode, downloadWorker, uploadWorker]);

    const stop = useCallback(() => {
        activeRef.current = false;
        abortRef.current?.abort();
        setActive(false);
        setConnectionStatus("idle");
    }, []);

    useEffect(() => {
        if (!active) return;

        const interval = setInterval(() => {
            const diff = bytesRef.current - lastBytesRef.current;
            lastBytesRef.current = bytesRef.current;
            setStats({
                speedBps: diff,
                totalBytes: bytesRef.current,
                elapsed: (Date.now() - startTimeRef.current) / 1000,
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [active]);

    return {
        active,
        start,
        stop,
        mode,
        setMode,
        threads,
        setThreads,
        stats,
        dataLimitMB,
        setDataLimitMB,
        enableLimit,
        setEnableLimit,
        stoppedReason,
        connectionStatus,
    };
}

// ─────────────────────────────────────────────────────────────
// Data Presets
// ─────────────────────────────────────────────────────────────

const DATA_PRESETS = [
    { label: "10 MB", value: 10, popular: false },
    { label: "50 MB", value: 50, popular: false },
    { label: "100 MB", value: 100, popular: true },
    { label: "500 MB", value: 500, popular: false },
    { label: "1 GB", value: 1024, popular: true },
    { label: "5 GB", value: 5120, popular: false },
];

// ─────────────────────────────────────────────────────────────
// SEO Content Section
// ─────────────────────────────────────────────────────────────

function SEOSection() {
    return (
        <article className="mt-12 text-zinc-400 space-y-8 max-w-none prose prose-invert prose-zinc prose-sm md:prose-base glass rounded-3xl p-6 md:p-8 border border-zinc-800/50">
            <header className="border-b border-zinc-800 pb-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                    #1 Tool to Waste Mobile Data & Stress Test Networks
                </h2>
                <p>
                    Data Waster Pro is the ultimate <strong>bandwidth burner</strong> designed to consume your internet
                    data plan quickly, efficiently, and securely.
                </p>
            </header>

            <section>
                <h3 className="text-xl font-semibold text-white mb-3">Why Waste Mobile Data?</h3>
                <p className="mb-4">
                    There are many professional and personal reasons why you might need to{" "}
                    <strong className="text-purple-400">waste data</strong> or burn through a bandwidth quota:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                    <li>
                        <strong>Finish Data Plans:</strong> Use up remaining daily or monthly data quotas before they
                        expire.
                    </li>
                    <li>
                        <strong>Network Stress Testing:</strong> Validate the stability of your router, 5G connection,
                        or ISP stability under high load.
                    </li>
                    <li>
                        <strong>Thermal Throttling Tests:</strong> Test how your mobile device handles sustained
                        high-speed 5G downloads.
                    </li>
                    <li>
                        <strong>Battery Drain Testing:</strong> Evaluate battery performance while the 5G modem is
                        active.
                    </li>
                </ul>
            </section>

            <section>
                <h3 className="text-xl font-semibold text-white mb-3">How to Burn Bandwidth Instantly</h3>
                <ol className="list-decimal pl-5 space-y-2">
                    <li>
                        Select a data preset (e.g., <strong className="text-white">1 GB</strong> or{" "}
                        <strong className="text-white">5 GB</strong>).
                    </li>
                    <li>
                        Toggle "Unlimited Mode" if you want to run a continuous <strong>network stress test</strong>.
                    </li>
                    <li>
                        Click the <strong>WASTE</strong> button to start downloading high-speed dummy files.
                    </li>
                    <li>
                        Watch the real-time speedometer to verify your <strong>5G speed test</strong> results.
                    </li>
                </ol>
            </section>

            <section>
                <h3 className="text-xl font-semibold text-white mb-3">Premium Features</h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/30">
                        <h4 className="font-bold text-white mb-1">🚀 Unlimited Speed</h4>
                        <p className="text-sm">
                            Connects directly to global CDNs (Cloudflare) to saturate 1Gbps+ connections.
                        </p>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/30">
                        <h4 className="font-bold text-white mb-1">🔒 Secure & Safe</h4>
                        <p className="text-sm">
                            No files are saved to your disk. Data is downloaded to RAM and instantly discarded.
                        </p>
                    </div>
                </div>
            </section>

            <section className="bg-zinc-900/50 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Frequently Asked Questions</h3>
                <div className="space-y-4">
                    <details className="group">
                        <summary className="font-semibold text-white cursor-pointer list-none flex justify-between">
                            How fast can I waste data?
                            <span className="group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <p className="mt-2 text-sm">
                            Data Waster Pro supports gigabit speeds. If you have 5G or Fiber, you can burn 1GB in under
                            10 seconds.
                        </p>
                    </details>
                    <hr className="border-zinc-800" />
                    <details className="group">
                        <summary className="font-semibold text-white cursor-pointer list-none flex justify-between">
                            Does this work as a 5G Speed Test?
                            <span className="group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <p className="mt-2 text-sm">
                            Yes! By running a sustained download, you get a more accurate real-world speed test than
                            short burst tests.
                        </p>
                    </details>
                    <hr className="border-zinc-800" />
                    <details className="group">
                        <summary className="font-semibold text-white cursor-pointer list-none flex justify-between">
                            Is using Data Waster Pro free?
                            <span className="group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <p className="mt-2 text-sm">Yes, it is 100% free with no ads and no sign-up required.</p>
                    </details>
                </div>
            </section>

            <footer className="text-center pt-8 border-t border-zinc-800">
                <p className="text-xs text-zinc-600">
                    Keywords: waste data, burn bandwidth, network load generator, download large file, finish data, 4g
                    data waster, internet stress test.
                </p>
            </footer>
        </article>
    );
}

export function App() {
    const {
        active,
        start,
        stop,
        mode,
        setMode,
        threads,
        setThreads,
        stats,
        dataLimitMB,
        setDataLimitMB,
        enableLimit,
        setEnableLimit,
        stoppedReason,
        connectionStatus,
    } = useDataWaster();

    const speed = formatSpeed(stats.speedBps);
    const progress = enableLimit ? Math.min(100, (stats.totalBytes / (dataLimitMB * 1024 * 1024)) * 100) : 0;

    return (
        <div className="min-h-screen p-4 md:p-6 lg:p-8 font-[Inter]">
            {/* Decorative Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl" />
            </div>

            <div className="relative max-w-4xl mx-auto">
                {/* Header */}
                <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div
                                className={`w-14 h-14 rounded-2xl bg-linear-to-br from-purple-600 via-pink-600 to-purple-600 
                                flex items-center justify-center shadow-2xl overflow-hidden p-3
                                ${active ? "pulse-glow" : ""}`}
                            >
                                <img
                                    src="./favicon.svg"
                                    alt="Data Waster Logo"
                                    className="w-full h-full object-contain filter drop-shadow-md"
                                />
                            </div>
                            {active && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-zinc-900 animate-pulse" />
                            )}
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                                DATA
                                <span className="bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                    WASTER
                                </span>
                                <span className="ml-2 text-xs font-medium text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full align-middle">
                                    PRO
                                </span>
                            </h1>
                            <p className="text-sm text-zinc-500">Instant bandwidth consumption</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div
                            className={`flex items-center gap-2 px-4 py-2 rounded-full glass border
                            ${connectionStatus === "error"
                                    ? "border-red-500/50 text-red-400"
                                    : active
                                        ? "border-green-500/50 text-green-400"
                                        : "border-zinc-700 text-zinc-500"
                                }`}
                        >
                            <span
                                className={`w-2 h-2 rounded-full ${connectionStatus === "error"
                                        ? "bg-red-500 animate-pulse"
                                        : active
                                            ? "bg-green-500 animate-pulse"
                                            : "bg-zinc-600"
                                    }`}
                            />
                            <span className="text-sm font-medium">
                                {connectionStatus === "error"
                                    ? "CONNECTION ERROR"
                                    : active
                                        ? "CONSUMING DATA"
                                        : stoppedReason
                                            ? "COMPLETE"
                                            : "READY"}
                            </span>
                        </div>
                    </div>
                </header>

                {/* Success Banner */}
                {stoppedReason && (
                    <div className="mb-6 glass border border-green-500/30 rounded-2xl p-4 flex items-center gap-3 animate-[fadeIn_0.3s_ease-out] glow-green">
                        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                            <span className="text-green-400 text-xl">✓</span>
                        </div>
                        <div>
                            <p className="font-semibold text-green-300">Mission Complete!</p>
                            <p className="text-sm text-green-400/70">{stoppedReason}</p>
                        </div>
                    </div>
                )}

                {/* Stats Grid */}
                <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" aria-label="Statistics">
                    <StatCard icon="🚀" label="Speed" value={speed.value} unit={speed.unit} highlight={active} />
                    <StatCard icon="📊" label="Consumed" value={formatBytes(stats.totalBytes)} />
                    <StatCard icon="⏱️" label="Duration" value={formatTime(stats.elapsed)} />
                    <StatCard icon="🌐" label="Network" value={mode.charAt(0).toUpperCase() + mode.slice(1)} />
                </section>

                {/* Progress Bar */}
                {enableLimit && (
                    <div className="mb-6 glass rounded-2xl p-4 border border-zinc-800/50">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-zinc-400">Progress</span>
                            <span className="text-sm font-mono font-bold text-purple-400">{progress.toFixed(1)}%</span>
                        </div>
                        <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="absolute inset-y-0 left-0 bg-linear-to-r from-purple-600 via-pink-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                            <div className="absolute inset-0 shimmer rounded-full" />
                        </div>
                        <p className="text-xs text-zinc-600 mt-2 text-center">
                            {formatBytes(stats.totalBytes)} / {formatBytes(dataLimitMB * 1024 * 1024)}
                        </p>
                    </div>
                )}

                {/* Main Control Panel */}
                <main className="glass rounded-3xl border border-zinc-800/50 p-6 mb-6">
                    <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                        <span className="text-2xl">⚡</span>
                        Quick Waste
                    </h2>

                    {/* Data Presets */}
                    <div className="mb-5">
                        <p className="text-sm text-zinc-400 mb-3 font-medium">Select amount to consume:</p>
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                            {DATA_PRESETS.map((preset) => (
                                <button
                                    type="button"
                                    key={preset.value}
                                    onClick={() => {
                                        setEnableLimit(true);
                                        setDataLimitMB(preset.value);
                                    }}
                                    disabled={active}
                                    aria-pressed={enableLimit && dataLimitMB === preset.value}
                                    className={`relative py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200
                                        ${enableLimit && dataLimitMB === preset.value
                                            ? "bg-linear-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30 scale-105"
                                            : "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-white hover:scale-[1.02]"
                                        }
                                        ${active ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                                        focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                                >
                                    {preset.label}
                                    {preset.popular && !active && (
                                        <span className="absolute -top-1.5 -right-1.5 text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded-full font-bold">
                                            HOT
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Unlimited Toggle */}
                    <div className="flex items-center justify-between bg-zinc-800/30 p-4 rounded-xl mb-6 border border-zinc-700/50">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">♾️</span>
                            <div>
                                <span className="font-semibold">Unlimited Mode</span>
                                {!enableLimit && (
                                    <p className="text-xs text-amber-400">⚠️ Will run until manually stopped</p>
                                )}
                            </div>
                        </div>
                        <ToggleSwitch
                            checked={!enableLimit}
                            onChange={(checked) => setEnableLimit(!checked)}
                            disabled={active}
                            activeColor="bg-linear-to-r from-amber-500 to-red-500"
                        />
                    </div>

                    {/* Main Action Button */}
                    <button
                        type="button"
                        onClick={() => (active ? stop() : start())}
                        aria-label={active ? "Stop data consumption" : "Start data consumption"}
                        className={`w-full py-5 rounded-2xl font-bold text-xl transition-all duration-300 transform
                            ${active
                                ? "bg-linear-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-400 shadow-lg shadow-red-500/30"
                                : "bg-linear-to-r from-purple-600 via-pink-600 to-purple-600 text-white hover:scale-[1.02] shadow-2xl shadow-purple-500/40"
                            }
                            focus:outline-none focus:ring-4 focus:ring-purple-500/30 active:scale-[0.98]`}
                    >
                        {active ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 rounded bg-white/30" />
                                STOP
                            </span>
                        ) : (
                            <span className="flex items-center justify-center gap-2">
                                <span className="text-2xl">▶</span>
                                WASTE {enableLimit ? formatBytes(dataLimitMB * 1024 * 1024) : "∞"}
                            </span>
                        )}
                    </button>
                </main>

                {/* Advanced Settings */}
                <details className="glass rounded-2xl border border-zinc-800/50 group">
                    <summary className="p-4 cursor-pointer text-sm text-zinc-400 hover:text-white flex items-center gap-2 select-none list-none">
                        <span className="transition-transform group-open:rotate-90">▸</span>
                        <span className="text-lg">⚙️</span>
                        Advanced Settings
                    </summary>
                    <div className="p-4 pt-0 border-t border-zinc-800/50 mt-2 space-y-4">
                        {/* Mode Selector */}
                        <div>
                            <p className="text-sm text-zinc-400 mb-2 font-medium">Transfer Mode</p>
                            <div className="grid grid-cols-3 gap-2">
                                {(["download", "upload", "both"] as const).map((m) => (
                                    <button
                                        type="button"
                                        key={m}
                                        onClick={() => setMode(m)}
                                        disabled={active}
                                        aria-pressed={mode === m}
                                        className={`py-3 rounded-xl text-sm font-medium capitalize transition-all
                                            ${mode === m ? "bg-zinc-700 text-white" : "bg-zinc-800/50 text-zinc-500 hover:text-white"}
                                            ${active ? "opacity-50 cursor-not-allowed" : ""}`}
                                    >
                                        {m === "download" ? "⬇️" : m === "upload" ? "⬆️" : "⬍"} {m}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Threads */}
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-zinc-400 font-medium">Connections</span>
                                <span className="font-mono bg-zinc-800 px-2 py-0.5 rounded font-bold">{threads}</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="16"
                                value={threads}
                                onChange={(e) => setThreads(+e.target.value)}
                                disabled={active}
                                aria-label="Number of concurrent connections"
                                className="w-full accent-purple-600 cursor-pointer"
                            />
                        </div>
                    </div>
                </details>

                {/* SEO Content */}
                <SEOSection />

                {/* Footer */}
                <footer className="mt-8 text-center space-y-2">
                    <p className="text-xs text-zinc-600">⚡ Powered by Bun Runtime • 🌐 Via Cloudflare Edge Network</p>
                    <p className="text-xs text-zinc-700">Use responsibly • Your data, your choice</p>
                </footer>
            </div>
        </div>
    );
}
