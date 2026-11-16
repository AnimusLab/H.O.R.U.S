# H.O.R.U.S.

H.O.R.U.S. is a local-first tactical intelligence console for visualizing public geospatial and telemetry signals. It combines an interactive 2D/3D globe, event overlays, simulated operational layers, public-feed ingestion, a Rust telemetry broker, and an isolated local gateway.

The project is designed around an explicit boundary between:

- **Presentation**: the browser-based tactical console.
- **Telemetry**: normalized event data delivered over WebSocket.
- **Ingestion**: public-feed workers for earthquakes and weather alerts.
- **Local audit boundary**: a restricted gateway that exposes health/status information without outbound forwarding.
- **Native computation**: a small C++ geospatial library used by the Rust service through FFI.

> H.O.R.U.S. currently includes demo and simulated layers. A visual layer being present in the interface does not imply that it is connected to a live provider.

## Repository layout

```text
.
├── LICENSE
├── README.md
└── horus/
    ├── app/                    # Next.js App Router entry points and global styles
    ├── components/             # Tactical HUD, globe, panels, controls, and state
    ├── engine-cpp/             # Native geospatial computation and CTest target
    ├── server-rust/            # Telemetry broker and public-feed workers
    ├── eidolon-proxy/          # Local audit-only gateway
    ├── sarcophagus-os/         # Supporting sandbox compose definition
    ├── Dockerfile              # Production frontend image
    ├── docker-compose.yml      # Multi-service local deployment
    ├── package.json            # Frontend scripts and dependencies
    ├── package-lock.json       # Locked frontend dependency graph
    └── .gitignore              # Local configuration and generated output rules
```

## Core capabilities

### Tactical globe

The frontend renders an interactive globe using React Three Fiber and Three.js. It supports:

- 2D flat-grid and 3D orbital modes.
- Procedural longitude/latitude grid rendering.
- Natural Earth land geometry loaded from a public package endpoint.
- Atmospheric glow and scanline presentation effects.
- Event pings, event clusters, animated arcs, aircraft, maritime, and satellite layers.
- Camera focus from search, event selection, and command input.
- Responsive tactical panels for desktop and constrained screens.

The globe is intentionally componentized so data providers can be replaced without rewriting the HUD:

- `GlobeViewport.jsx` owns scene construction and projection.
- `store.js` owns filters, focus, layers, telemetry state, and event normalization.
- `HudLayer.jsx` owns operator controls and status displays.
- `TargetPanel.jsx`, `ActivityPanel.jsx`, and `TradeCommsPanel.jsx` expose operational detail.

### Event and telemetry monitoring

The browser connects to the Rust server through a WebSocket endpoint. The client validates each payload before applying it to state. Invalid payloads are rejected and recorded as warnings instead of being treated as successful updates.

The telemetry state tracks:

- System status.
- DEFCON value.
- Network latency.
- Active event count.
- Active feed node.
- Feed status and last successful update.
- Per-source feed health.
- Normalized event records.
- Activity metrics.

### Map source controls

The tactical HUD includes a map source tray with explicit source states:

- **HORUS Tactical**: the current procedural globe.
- **Photorealistic 3D**: a provider-gated integration state.
- **Open Terrain**: an adapter state for open geospatial providers.

Selecting a source updates centralized state and provides operator-visible status text. Provider credentials and attribution are intentionally not hidden behind a silent fallback.

### Browser voice commands

The voice console uses the browser Web Speech API when available. It supports local command interpretation without an external AI dependency.

Examples:

```text
take me to Tehran
show flights
show ships
show satellites
switch to 3D
show the flat map
reset
```

Voice commands can:

- Focus the camera on a known place.
- Switch between 2D and 3D modes.
- Enable aircraft, maritime, or satellite layers.
- Reset the camera focus.

Unsupported browsers and recognition failures produce explicit status messages.

## Architecture

### Frontend

The frontend is a Next.js application using the App Router.

Important entry points:

- `horus/app/page.jsx`: composes the globe, tactical overlays, panels, and operator controls.
- `horus/app/layout.jsx`: defines document metadata and the root layout.
- `horus/app/globals.css`: global tactical styling, glass surfaces, grid treatment, vignette, and reduced-motion behavior.
- `horus/components/GlobeViewport.jsx`: Three.js scene and geographic projection logic.
- `horus/components/store.js`: Zustand store, telemetry contract, feed state, and event normalization.

The frontend uses:

- Next.js 14
- React 18
- Three.js
- React Three Fiber
- React Three Drei
- Zustand
- Tailwind CSS
- Lucide icons
- Vitest

### Rust telemetry server

`horus/server-rust` provides the normalized event broker and public-feed workers.

The service:

1. Starts public-feed workers for USGS earthquakes and NOAA alerts.
2. Starts demo workers for example news and ADS-B signals.
3. Normalizes source records into the H.O.R.U.S. event schema.
4. Broadcasts telemetry frames to connected WebSocket clients.
5. Tracks request, failure, client, and broadcast metrics.
6. Exposes health and activity endpoints.

Default bind address:

```text
0.0.0.0:4000
```

### Eidolon gateway

`horus/eidolon-proxy` is a deliberately constrained local gateway.

It exposes:

- `GET /health`
- `GET /eidolon/status`

The current implementation reports readiness and explicitly identifies itself as local audit-only. It does not forward outbound requests.

Default bind address:

```text
0.0.0.0:5000
```

### C++ geospatial engine

`horus/engine-cpp` contains the native geospatial computation boundary. The current CMake target builds:

- `horus_engine`
- `horus_engine_tests` when CTest is enabled

The Rust service declares an FFI boundary for haversine distance calculation. Native changes should preserve the ABI and be validated with both the C++ tests and the Rust build.

## Local development

### Prerequisites

Install the following tools:

- Node.js 20 or newer.
- npm.
- Rust toolchain with Cargo.
- CMake 3.15 or newer.
- A C++17 compiler.
- Docker Desktop, if using the compose deployment.

### Install frontend dependencies

From the frontend directory:

```powershell
cd D:\H.O.R.U.S\horus
npm ci
```

The repository includes a lockfile. Prefer `npm ci` for reproducible installs.

### Configure local environment

Create `horus\.env` for local configuration. Do not commit credentials or private provider keys.

Example:

```dotenv
NEXT_PUBLIC_TELEMETRY_WS_URL=ws://localhost:4000/ws/telemetry
USGS_FEED_URL=https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson
USGS_POLL_INTERVAL_SECONDS=60
NOAA_ALERTS_URL=https://api.weather.gov/alerts/active
NOAA_POLL_INTERVAL_SECONDS=120
FRONTEND_PORT=3000
RUST_SERVER_PORT=4000
EIDOLON_PORT=5000
```

The frontend derives the telemetry URL from the current host when `NEXT_PUBLIC_TELEMETRY_WS_URL` is not set:

```text
ws://<browser-host>:4000/ws/telemetry
```

For HTTPS deployments, the client uses `wss://` when no explicit URL is configured.

### Run the frontend

```powershell
cd D:\H.O.R.U.S\horus
npm run dev
```

Open:

```text
http://localhost:3000
```

The frontend can run in local-demo mode without the Rust server. When the telemetry server is available, the UI attempts to connect automatically and reconnects after disconnects.

### Run the Rust services

Run the telemetry server:

```powershell
cd D:\H.O.R.U.S\horus\server-rust
cargo run
```

Run the local gateway in a separate terminal:

```powershell
cd D:\H.O.R.U.S\horus\eidolon-proxy
cargo run
```

Useful checks:

```powershell
curl http://localhost:4000/health
curl http://localhost:4000/activity
curl http://localhost:5000/health
curl http://localhost:5000/eidolon/status
```

Expected health responses:

- Telemetry server: `ok`
- Gateway: JSON containing `"status":"READY"`

### Build the native engine

```powershell
cd D:\H.O.R.U.S\horus
cmake -S engine-cpp -B engine-cpp\build
cmake --build engine-cpp\build
ctest --test-dir engine-cpp\build --output-on-failure
```

## Docker deployment

The compose file starts:

| Service | Purpose | Default port |
| --- | --- | ---: |
| `horus-frontend` | Next.js production frontend | `3000` |
| `horus-server` | Rust telemetry broker | `4000` |
| `eidolon-gateway` | Local audit-only gateway | `5000` |
| `sarcophagus-sandbox` | Restricted ephemeral processing sandbox | internal only |

Build and start the stack:

```powershell
cd D:\H.O.R.U.S\horus
docker compose up --build
```

Run in the background:

```powershell
docker compose up --build -d
```

View service logs:

```powershell
docker compose logs -f horus-frontend
docker compose logs -f horus-server
docker compose logs -f eidolon-gateway
```

Stop the stack:

```powershell
docker compose down
```

The compose deployment includes health checks and dependency ordering. The frontend waits for the telemetry server to become healthy, and the telemetry server waits for the gateway health check.

## Telemetry contract

Telemetry frames use a versioned JSON shape:

```json
{
  "schema_version": 1,
  "system_status": "ACTIVE_MONITORING",
  "defcon": 3,
  "timestamp": "2026-11-14T11:00:00Z",
  "network_latency_ms": 12,
  "active_events_count": 1,
  "active_node": "USGS_PUBLIC_FEED",
  "source": "USGS_EARTHQUAKES",
  "latest_intel": "USGS public feed update",
  "distance_km": 4208.36,
  "events": [
    {
      "id": "usgs-test-1",
      "category": "anomaly",
      "source": "USGS_EARTHQUAKES",
      "severity": "MODERATE",
      "timestamp": "2026-11-14T11:00:00Z",
      "latitude": 34.05,
      "longitude": -118.25,
      "title": "USGS earthquake M4.2",
      "tags": ["USGS", "EARTHQUAKE"]
    }
  ],
  "feed_status": "HEALTHY",
  "feed_last_success": "2026-11-14T11:00:00Z"
}
```

The client requires:

- `schema_version` to equal `1`.
- Numeric coordinates, latency, distance, and DEFCON values.
- String identifiers, source names, timestamps, titles, and severities.
- An array of event records.
- A nullable string for `feed_last_success`.

Repeated event IDs are deduplicated in the browser. Malformed frames do not mutate feed state.

## HTTP and WebSocket endpoints

### Telemetry server

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `GET` | `/activity` | Current broker metrics and feed activity |
| `GET` | `/ws/telemetry` | WebSocket telemetry stream |

### Local gateway

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Gateway readiness and operating mode |
| `GET` | `/eidolon/status` | Alias for gateway status |

## Data sources and operational boundaries

The telemetry server currently uses public sources and demo workers:

- USGS earthquake GeoJSON feed.
- NOAA active weather alerts.
- Simulated news updates.
- Simulated ADS-B updates.

The frontend also contains simulated aircraft, maritime, and satellite visualization layers. These are intended as replaceable visualization adapters and should not be represented as live intelligence unless connected to a verified provider.

When adding a provider:

1. Document its terms and attribution requirements.
2. Keep credentials server-side whenever possible.
3. Add explicit source and freshness metadata.
4. Preserve degraded, stale, unavailable, and simulated states.
5. Do not silently substitute simulated data for a failed live source.
6. Add validation tests for the normalized event shape.

## Testing and validation

### Frontend tests

```powershell
cd D:\H.O.R.U.S\horus
npm test
```

The current test suite covers:

- Place search resolution.
- Telemetry schema validation.
- Unsupported schema rejection.
- Independent feed status tracking.
- Event deduplication.
- Malformed payload handling.
- Source and severity filters.
- Local voice command interpretation.

### Production frontend build

```powershell
cd D:\H.O.R.U.S\horus
npm run build
```

### Rust checks

```powershell
cd D:\H.O.R.U.S\horus\server-rust
cargo check
cargo test

cd D:\H.O.R.U.S\horus\eidolon-proxy
cargo check
cargo test
```

### C++ checks

```powershell
cd D:\H.O.R.U.S\horus
cmake -S engine-cpp -B engine-cpp\build -DBUILD_TESTING=ON
cmake --build engine-cpp\build
ctest --test-dir engine-cpp\build --output-on-failure
```

## Security and privacy

- Never commit `.env`, `.env.local`, provider credentials, API tokens, or private certificates.
- Keep externally supplied credentials out of browser bundles.
- Treat public data as untrusted input and validate it before normalization.
- Keep the gateway’s outbound forwarding disabled unless an explicitly reviewed design enables it.
- Preserve the compose hardening settings for restricted services:
  - read-only filesystem where configured,
  - dropped Linux capabilities,
  - `no-new-privileges`,
  - isolated internal network,
  - temporary filesystems for ephemeral processing.
- Review CORS behavior before exposing services outside localhost.
- Restrict production provider keys by origin, API, quota, and environment.
- Do not infer identity, intent, capability, or threat level from a visualization marker alone.

## Development guidelines

When extending H.O.R.U.S.:

1. Inspect existing state, components, and contracts before adding new abstractions.
2. Prefer small, composable components over replacing the entire console.
3. Keep provider-specific behavior behind explicit adapters.
4. Make unavailable and simulated states visible to operators.
5. Preserve keyboard access, focus states, and reduced-motion behavior.
6. Add focused tests for new behavior and malformed inputs.
7. Run the smallest relevant test, build, or native validation command before opening a pull request.
8. Avoid unrelated formatting or dependency changes.

## Troubleshooting

### The frontend shows `LOCAL DEMO`

This means the browser cannot establish a usable telemetry WebSocket connection. Confirm:

```powershell
curl http://localhost:4000/health
```

Then verify that `NEXT_PUBLIC_TELEMETRY_WS_URL` points to the correct WebSocket endpoint and restart the frontend after changing `.env`.

### The telemetry server exits during startup

Check:

- Port `4000` is available.
- Poll interval variables contain integers.
- The native geospatial library can be built and linked.
- The configured feed URLs are valid.

### The gateway health check fails

Check:

```powershell
curl http://localhost:5000/health
```

Review gateway logs and verify that port `5000` is not already in use.

### Voice controls report unavailable

Voice recognition depends on browser support and permission. Confirm that:

- The browser exposes `SpeechRecognition` or `webkitSpeechRecognition`.
- Microphone permission is granted.
- The page is served from an appropriate secure context when required by the browser.

### The photorealistic map source remains unavailable

The source selector currently exposes the integration state and provider requirement. A production provider integration must add credentials, live attribution, quota controls, and a compliant data path before rendering provider content.

## License

See [LICENSE](./LICENSE) for the repository license.

Third-party data, APIs, imagery, terrain, models, and other external assets remain subject to their own licenses and provider terms. Review those terms before redistribution or commercial deployment.
