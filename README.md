# AetherAR

AetherAR is a modular, open-source WebAR engine designed to exceed MindAR-class performance on modern mobile browsers.

## Current scope (Phases 1-3)

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

## Monorepo layout

```txt
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

## Example: boot engine with plugin + tracker

```ts
import { AetherEngine } from '@aetherar/core';
import { createImageTrackingLoop } from '@aetherar/tracking';

const engine = new AetherEngine({ performance: 'balanced' });
const tracking = createImageTrackingLoop({ detectionFPS: 30 });

tracking.onTick(({ frameId }) => {
  // placeholder detection call
  console.log('track frame', frameId);
});

await engine.initialize();
tracking.start();
await engine.start();
```

## Roadmap highlights

- WASM CV modules for ORB/AKAZE + feature compression
- WebXR session runtime + anchors/hit-test
- Shared AR networking + cloud anchors
- React/Vue/Svelte adapters

## License

MIT
