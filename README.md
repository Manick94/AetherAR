# AetherAR

AetherAR is a modular, open-source WebAR engine designed to exceed MindAR-class performance on modern mobile browsers.

## Current scope (Phases 1-5)

### Phase 1 — foundation
- Monorepo package boundaries for core engine, tracking, rendering, XR, adapters, and CLI.
- Production-ready TypeScript project references for incremental builds.
- Engine kernel lifecycle and plugin registration contracts.

### Phase 2 — runtime + tracking primitives
- Runtime event bus + frame clock to power plugin frame callbacks.
- Expanded runtime context (`bus`, clock-backed timing).
- Tracking target store with immutable snapshot support.
- Tracking loop telemetry (`activeTargets`, precise deltas).

### Phase 3 — integration scaffolding
- Rendering loop abstraction + no-op renderer implementation.
- XR runtime placeholder (`MockXRRuntime`) for capability wiring.
- React provider + hook (`useAetherEngine`) and optional auto-start.
- CLI command outputs now machine-readable JSON for automation.

### Phase 4 — production runtime adapters
- Browser-native WebXR runtime (`BrowserXRRuntime`) with required/optional capability mapping.
- XR session status API (`getStatus`) for dashboards and diagnostics.
- Adaptive render loop that supports dynamic target FPS and frame-time statistics.

### Phase 5 — demo + DX expansion
- New frontend demo app (`apps/demo`) for presentations, smoke tests, and onboarding.
- CLI status and demo scaffolding commands (`phase-status`, `scaffold-demo`).
- Updated docs for contributors building real-world WebAR proof-of-concepts.

## Monorepo layout

```txt
apps/
└── demo                # Vite + React demo console for demos/presentations

packages/
├── core
├── tracking
├── rendering
├── xr
├── adapters/react
└── tools/cli
```

## Quick start

```bash
npm install
npm run typecheck
npm run build
```

## Run the demo app

```bash
npm install
npm run demo:dev
```

Then open the local Vite URL in your browser (usually `http://localhost:5173`).

## Example: boot engine with plugin + tracker

```ts
import { AetherEngine } from '@aetherar/core';
import { createImageTrackingLoop } from '@aetherar/tracking';

const engine = new AetherEngine({ performance: 'balanced' });
const tracking = createImageTrackingLoop({ detectionFPS: 30 });

tracking.onTick(({ frameId }) => {
  console.log('track frame', frameId);
});

await engine.initialize();
tracking.start();
await engine.start();
```

## Example: start real WebXR runtime

```ts
import { BrowserXRRuntime } from '@aetherar/xr';

const xr = new BrowserXRRuntime('immersive-ar');

if (await xr.isSupported()) {
  await xr.start({
    required: ['hit-test'],
    optional: ['anchors', 'light-estimation']
  });
}
```

## CLI examples

```bash
# Benchmark profile
node packages/tools/cli/dist/index.js benchmark --device "Pixel 8"

# Show roadmap implementation status
node packages/tools/cli/dist/index.js phase-status

# Scaffold a demo stub manifest
node packages/tools/cli/dist/index.js scaffold-demo --name my-webar-demo
```

## Building your next WebAR project quickly

1. Start with `@aetherar/core` + `@aetherar/tracking` for runtime + CV cadence.
2. Add `@aetherar/rendering` adaptive loop to maintain smooth visuals under load.
3. Integrate `@aetherar/xr` to progressively enable browser XR capabilities.
4. Use `@aetherar/react` as your declarative app shell for feature demos.
5. Copy `apps/demo` as a baseline for product demos and stakeholder presentations.

## Roadmap highlights

- WASM CV modules for ORB/AKAZE + feature compression
- WebXR session runtime + anchors/hit-test ✅
- Shared AR networking + cloud anchors
- React/Vue/Svelte adapters

## License

MIT
