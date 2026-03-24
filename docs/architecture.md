# AetherAR Architecture (v0.5)

## Design principles

1. **Kernel-first**: `@aetherar/core` owns lifecycle, plugin contracts, runtime context.
2. **Decoupled frame loops**: tracking loop can run at a different cadence from rendering.
3. **Capability composition**: features are enabled by plugins and adapters, not hardcoded flags.
4. **Portable package contracts**: each package exposes explicit interfaces, minimizing hidden coupling.

## Runtime topology

```txt
Camera -> Tracking Loop -> Pose Stream -> XR Space -> Renderer -> UI Adapter
           (WASM CV)        (Rx/event)    (anchors)   (Three/WebGL) (React/Vue)
```

## Package responsibilities

- `core`: lifecycle state machine, plugin registration, runtime bus, frame clock.
- `tracking`: image/face/world tracker schedulers, target store abstractions, snapshots.
- `rendering`: renderer interface, baseline no-op renderer, adaptive loop + frame telemetry.
- `xr`: WebXR session abstractions, browser runtime, mock runtime for integration testing.
- `adapters/react`: declarative component bridge and engine context hooks.
- `tools/cli`: target optimization, benchmark reporting, phase status, demo scaffolding metadata.
- `apps/demo`: Vite React console for demos, stakeholder presentations, and integration smoke tests.

## Performance strategy

- Separate `detectionFPS` from visual frame cadence to preserve smooth animation.
- Maintain immutable snapshots for tracking outputs to avoid mutation stalls.
- Build around typed arrays and transferable objects to support future worker offload.
- Keep renderer and tracker loops independent so heavy CV frames do not block visual throughput.
- Adaptive renderer allows reducing target FPS to keep thermal/perf budgets predictable.
