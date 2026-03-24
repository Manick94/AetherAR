# AetherAR

AetherAR is a modular, open-source WebAR engine designed to exceed MindAR-class performance on modern mobile browsers.

## Current scope (Phase 1 foundation)

- Monorepo package boundaries for core engine, tracking, rendering, XR, adapters, and CLI.
- Production-ready TypeScript project references for incremental builds.
- Engine kernel with lifecycle and plugin system.
- Tracking scheduler with decoupled detection FPS timing.
- Rendering and XR interfaces to unblock parallel implementation.
- React adapter shell for declarative API expansion.

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
