# AetherAR Architecture (v0 foundation)

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

- `core`: lifecycle state machine, plugin registration, runtime clock.
- `tracking`: image/face/world tracker schedulers and target store abstractions.
- `rendering`: renderer interface + render loop contract.
- `xr`: WebXR session and hit-test abstractions.
- `adapters/react`: declarative component bridge over core APIs.
- `tools/cli`: target optimization and diagnostics entry points.

## Performance strategy (initial)

- Separate `detectionFPS` from `requestAnimationFrame` to preserve visual smoothness.
- Maintain immutable snapshots for tracking outputs to avoid mutation stalls.
- Build around typed arrays and transferable objects to support future worker offload.
