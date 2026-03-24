# AetherAR

AetherAR is a modular WebAR starter for teams that want to ship browser-based AR experiences with a clean TypeScript architecture.

Today the repo gives you:

- `@aetherar/core` for engine lifecycle and plugin orchestration
- `@aetherar/tracking` for image-target scheduling, target stores, and pose snapshots
- `@aetherar/rendering` for adaptive render loops and a new Three.js renderer
- `@aetherar/xr` for browser WebXR capability checks and session startup
- `@aetherar/react` for a React app shell around the engine
- `@aetherar/cli` for compiling NFT image targets and workflow automation
- `apps/demo` for a working image-tracking + 3D scene demo

## What You Can Build

- Image-tracked product reveals
- Poster and packaging activations
- WebXR-enhanced demo apps
- Three.js-based AR scenes with glTF models

## Quick Start

```bash
npm install
npm run typecheck
npm run build
```

## Run The Demo

```bash
npm install
npm run demo:dev
```

Open the Vite URL that prints in the terminal, usually `http://localhost:5173`.

The demo currently uses a simulated image-target lock so you can validate the tracking/rendering pipeline before plugging in a production CV backend.

## Packages

```txt
apps/
└── demo

packages/
├── core
├── tracking
├── rendering
├── xr
├── adapters/react
└── tools/cli
```

## Three.js + Image Tracking Example

```ts
import { AetherEngine } from '@aetherar/core';
import {
  ThreeSceneRenderer,
  createAdaptiveRenderLoop,
  createHologramModel,
  applyObjectPose
} from '@aetherar/rendering';
import { createImageTrackingLoop } from '@aetherar/tracking';

const engine = new AetherEngine({ performance: 'balanced' });
const tracking = createImageTrackingLoop({ detectionFPS: 24 });
const renderer = new ThreeSceneRenderer();
const model = createHologramModel();

tracking.addTarget({ id: 'poster', width: 1080, height: 1920 });
renderer.add(model);

tracking.onSnapshot((snapshot) => {
  const poster = snapshot.targets.find((target) => target.id === 'poster');

  if (!poster || poster.observation.state !== 'tracked') {
    applyObjectPose(model, { visible: false });
    return;
  }

  applyObjectPose(model, {
    visible: true,
    position: poster.observation.pose.position,
    rotation: poster.observation.pose.rotation,
    scale: poster.observation.pose.scale
  });
});

const renderLoop = createAdaptiveRenderLoop({
  renderer,
  targetFPS: 60,
  viewport: {
    width: () => window.innerWidth,
    height: () => window.innerHeight
  }
});

await engine.initialize();
tracking.start();
renderLoop.start();
await engine.start();
```

## Compile NFT Image Targets

AetherAR now includes a MindAR-style NFT compiler flow for natural-feature image targets.

Compile one image:

```bash
npx aetherar optimize-target ./assets/poster.png --physical-width-mm 180
```

Compile multiple images or a whole directory into one manifest:

```bash
npx aetherar compile-nft ./assets/targets --out ./targets/launch-campaign.aether.nft.json --name launch-campaign
```

The generated manifest includes:

- stable target ids
- width and height metadata
- file fingerprints
- tracking quality warnings
- recommended tracking profile, scale, and detection FPS

Supported source formats: `png`, `jpg`, `jpeg`, `gif`, `webp`.

## Load A Compiled NFT Manifest

```ts
import { createImageTargetsFromNFTManifest } from '@aetherar/tracking';
import manifest from './targets/launch-campaign.aether.nft.json';

const runtimeTargets = createImageTargetsFromNFTManifest(manifest);

for (const target of runtimeTargets) {
  tracking.addTarget(target);
}
```

## Run The Matching Backend

The compiled manifest is now matcher-ready. You can feed camera frames or any `ImageData`-like RGBA buffer into the backend and receive stable target observations.

```ts
import {
  applyBackendFrameToTrackingLoop,
  createNFTTrackingBackend,
  createImageTrackingLoop
} from '@aetherar/tracking';
import manifest from './targets/launch-campaign.aether.nft.json';

const tracking = createImageTrackingLoop({ detectionFPS: 24 });
const backend = createNFTTrackingBackend(manifest, {
  minConfidence: 0.74,
  smoothing: 0.35
});

const frame = {
  width: cameraWidth,
  height: cameraHeight,
  data: rgbaPixels,
  channels: 4 as const
};

const result = backend.processFrame(frame);
applyBackendFrameToTrackingLoop(tracking, result);
```

## Load Your Own 3D Model

`ThreeSceneRenderer` includes `loadGLTFModel()` for glTF and GLB assets:

```ts
const productModel = await renderer.loadGLTFModel('/models/product.glb', {
  scale: 0.6,
  position: { x: 0, y: 0, z: -1.4 }
});

renderer.add(productModel);
```

## Demo Highlights

- React-powered app shell with `AetherAR`
- Adaptive Three.js render loop
- Matcher-ready NFT target descriptors in compiled manifests
- Image-target snapshot API with confidence, pose, and active target ids
- Responsive demo stage for desktop and mobile
- WebXR capability signal for progressive enhancement

## Typical Workflow

1. Create an engine with `@aetherar/core`.
2. Compile NFT targets with `aetherar compile-nft`.
3. Feed camera frames into `createNFTTrackingBackend`.
4. Render anchored content with `ThreeSceneRenderer`.
5. Load glTF models with `loadGLTFModel()` or start with `createHologramModel()`.
6. Use `@aetherar/react` to wrap your app and expose the engine context.

## CLI

```bash
node packages/tools/cli/dist/index.js compile-nft ./assets/targets --out ./targets/catalog.aether.nft.json
node packages/tools/cli/dist/index.js benchmark --device "Pixel 8"
node packages/tools/cli/dist/index.js phase-status
node packages/tools/cli/dist/index.js scaffold-demo --name my-webar-demo
```

## Notes

- The included tracking loop is framework-ready, but the demo target acquisition is still simulated.
- The NFT compiler now embeds matcher descriptors and the tracking package includes a baseline natural-feature matcher written in TypeScript.
- The renderer and tracking loops intentionally run at different cadences so heavy tracking work does not stall visuals.
- `BrowserXRRuntime` is available for capability checks and future immersive AR session wiring.

## License

MIT
