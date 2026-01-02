# Data Waster Pro

> High-performance network stress testing & bandwidth burner tool built on the [Bun](https://bun.sh) runtime.

Data Waster Pro is a production-ready application designed to saturate network connections (Download & Upload) to testing limits. It features a modern, responsive UI with real-time analytics, multiple transfer modes, and zero-disk-write architecture for safety.

## 🚀 Features

- **Pure Bun Fullstack**: Integrated server and SSR-like client serving without webpack/vite.
- **Instant HMR**: Sub-millisecond Hot Module Replacement during development.
- **Bi-Directional Stress**:
  - **Download**: High-speed stream from edge locations (supports Cloudflare proxying).
  - **Upload**: Efficient data sinking to test upstream bandwidth.
  - **Dual Mode**: Simultaneous upload/download stress testing.
- **Smart Concurrency**: Configurable worker threads (1-16 concurrent connections).
- **Real-time Analytics**: Live monitoring of speed (bps/Mbps/Gbps), total data wasted, and elapsed time.
- **Responsive UI**: Glassmorphism design with animated mesh gradients, built with Tailwind CSS v4.
- **SEO Optimized**: Full JSON-LD structured data (WebApplication, FAQ, HowTo) and meta tags.
- **Secure**: RAM-only operations with no disk writes.

## 🛠️ Tech Stack

- **Runtime**: [Bun v1.1+](https://bun.sh) (HTTP Server, Bundler, Runtime)
- **Frontend**: [React 19](https://react.dev)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com) & PostCSS
- **Tooling**: [Biome](https://biomejs.dev) (Linting & Formatting)

## 📦 Project Structure

```bash
src/
├── api/                   # API Route handlers
│   └── routes.ts          # Endpoint definitions
├── client/                # React Frontend
│   ├── App.tsx            # Main UI Logic & State
│   ├── main.tsx           # React Hydration Entry
│   ├── index.html         # HTML Document + SEO
│   └── favicon.svg        # Branding
├── lib/                   # Shared Utilities
│   └── constants.ts       # Config & Buffers
└── server.ts              # Bun HTTP Server Entry
```

## ⚡ Quick Start

### Prerequisites

- [Bun](https://bun.sh/docs/installation) installed.

### Installation

```bash
# Install dependencies
bun install
```

### Development

Start the server with instant HMR:

```bash
bun run dev
# Server running at http://localhost:3000
```

### Production Build

Create an optimized build (though Bun runs TS natively, this helps for verification/deployment prep):

```bash
bun run build
# Start production server
bun run start
```

## 🔍 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | `GET` | Server health, runtime version, and timestamp. |
| `/api/download` | `GET` | Infinite octet-stream for download speed testing. |
| `/api/upload` | `POST` | Accepts binary streams and discards them (Active Sink). |
| `/api/proxy` | `GET` | Proxies external URLs (e.g., Cloudflare) to bypass CORS. Query: `?url=...` |

## 🧪 Code Quality

The project uses **Biome** for fast, opinionated formatting and linting.

```bash
# Run checks
bun run check

# Auto-fix issues
bun run fix
```

## 📄 License

MIT
