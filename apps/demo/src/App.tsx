import { useEffect, useMemo, useRef, useState } from 'react';
import { AetherAR, useAetherEngine } from '@aetherar/react';
import {
  animateHologramModel,
  applyObjectPose,
  createAdaptiveRenderLoop,
  createHologramModel,
  ThreeSceneRenderer
} from '@aetherar/rendering';
import { createImageTrackingLoop, type ImageTargetPose } from '@aetherar/tracking';
import { BrowserXRRuntime } from '@aetherar/xr';
import './App.css';

const TARGET_ID = 'aether-launch-card';

const INITIAL_RENDER_STATS = {
  frames: 0,
  averageFrameMs: 0,
  effectiveFPS: 0
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createSimulatedPose(
  stageRect: DOMRect,
  markerRect: DOMRect,
  pointer: { x: number; y: number },
  timestamp: number
): ImageTargetPose {
  const centerX = (markerRect.left - stageRect.left + markerRect.width / 2) / stageRect.width;
  const centerY = (markerRect.top - stageRect.top + markerRect.height / 2) / stageRect.height;
  const pointerOffsetX = (pointer.x - centerX) * 0.55;
  const pointerOffsetY = (pointer.y - centerY) * 0.42;
  const pulse = Math.sin(timestamp * 0.0022) * 0.035;

  return {
    position: {
      x: (centerX - 0.5) * 2.15 + pointerOffsetX,
      y: (0.5 - centerY) * 1.75 - pointerOffsetY,
      z: -1.55 + pulse
    },
    rotation: {
      x: -0.32 + pointerOffsetY * 0.5,
      y: pointerOffsetX * 0.85,
      z: Math.sin(timestamp * 0.0015) * 0.08
    },
    scale: clamp((markerRect.width / stageRect.width) * 2.8, 0.4, 0.85)
  };
}

function Dashboard() {
  const engine = useAetherEngine();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<HTMLButtonElement | null>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5 });
  const trackingEnabledRef = useRef(true);

  const [engineState, setEngineState] = useState(engine.getState());
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [trackingState, setTrackingState] = useState<'idle' | 'tracked' | 'lost'>('idle');
  const [trackingFrame, setTrackingFrame] = useState(0);
  const [trackingConfidence, setTrackingConfidence] = useState(0);
  const [activeTargets, setActiveTargets] = useState<string[]>([]);
  const [renderStats, setRenderStats] = useState(INITIAL_RENDER_STATS);
  const [targetFPS, setTargetFPS] = useState(60);
  const [xrSupported, setXrSupported] = useState<boolean | null>(null);

  const tracking = useMemo(() => createImageTrackingLoop({ detectionFPS: 24 }), []);
  const xrRuntime = useMemo(() => new BrowserXRRuntime(), []);
  const renderer = useMemo(() => new ThreeSceneRenderer(), []);
  const trackedModel = useMemo(() => createHologramModel(), []);
  const renderLoop = useMemo(
    () =>
      createAdaptiveRenderLoop({
        renderer,
        targetFPS: 60,
        viewport: {
          width: () => stageRef.current?.clientWidth ?? window.innerWidth,
          height: () => stageRef.current?.clientHeight ?? window.innerHeight
        }
      }),
    [renderer]
  );

  useEffect(() => {
    trackingEnabledRef.current = trackingEnabled;
  }, [trackingEnabled]);

  useEffect(() => {
    setEngineState(engine.getState());
    return engine.getRuntimeContext().bus.on('stateChanged', ({ next }) => {
      setEngineState(next as 'idle' | 'initializing' | 'ready' | 'running' | 'stopped');
    });
  }, [engine]);

  useEffect(() => {
    void xrRuntime.isSupported().then(setXrSupported);
  }, [xrRuntime]);

  useEffect(() => {
    renderLoop.setTargetFPS(targetFPS);
  }, [renderLoop, targetFPS]);

  useEffect(() => {
    tracking.addTarget({
      id: TARGET_ID,
      width: 1080,
      height: 1920,
      metadata: {
        label: 'Aether Launch Card'
      }
    });

    return () => {
      tracking.removeTarget(TARGET_ID);
    };
  }, [tracking]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const canvas = renderer.getDomElement();
    canvas.classList.add('demo-stage__canvas');
    stage.append(canvas);
    renderer.add(trackedModel);

    return () => {
      renderer.remove(trackedModel);
      canvas.remove();
      renderer.dispose();
    };
  }, [renderer, trackedModel]);

  useEffect(
    () =>
      renderer.onBeforeRender(({ deltaMs }) => {
        animateHologramModel(trackedModel, deltaMs);
      }),
    [renderer, trackedModel]
  );

  useEffect(() => {
    const unsubscribeTick = tracking.onTick(({ frameId, timestamp }) => {
      setTrackingFrame(frameId);

      if (!trackingEnabledRef.current) {
        tracking.updateObservation(TARGET_ID, null);
        return;
      }

      const stage = stageRef.current;
      const marker = markerRef.current;

      if (!stage || !marker) {
        return;
      }

      tracking.updateObservation(TARGET_ID, {
        state: 'tracked',
        confidence: 0.9 + Math.sin(timestamp * 0.01) * 0.06,
        pose: createSimulatedPose(
          stage.getBoundingClientRect(),
          marker.getBoundingClientRect(),
          pointerRef.current,
          timestamp
        )
      });
    });

    const unsubscribeSnapshot = tracking.onSnapshot((snapshot) => {
      const target = snapshot.targets.find((item) => item.id === TARGET_ID);

      setActiveTargets(Array.from(snapshot.activeTargetIds));
      setTrackingState(target?.observation.state ?? 'idle');
      setTrackingConfidence(target?.observation.confidence ?? 0);

      if (target?.observation.state === 'tracked') {
        applyObjectPose(trackedModel, {
          visible: true,
          position: target.observation.pose.position,
          rotation: target.observation.pose.rotation,
          scale: target.observation.pose.scale
        });
        return;
      }

      applyObjectPose(trackedModel, { visible: false });
    });

    const statsTimer = window.setInterval(() => {
      setRenderStats(renderLoop.getStats());
    }, 450);

    tracking.start();
    renderLoop.start();

    return () => {
      unsubscribeTick();
      unsubscribeSnapshot();
      window.clearInterval(statsTimer);
      tracking.stop();
      renderLoop.stop();
      applyObjectPose(trackedModel, { visible: false });
    };
  }, [renderLoop, trackedModel, tracking]);

  const updatePointer = (clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const rect = stage.getBoundingClientRect();
    pointerRef.current = {
      x: clamp((clientX - rect.left) / rect.width, 0, 1),
      y: clamp((clientY - rect.top) / rect.height, 0, 1)
    };
  };

  const toggleTracking = () => {
    setTrackingEnabled((previous) => !previous);
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="hero__eyebrow">WebAR starter kit</p>
        <h1>Build image-tracked Three.js scenes without fighting your stack.</h1>
        <p className="hero__lede">
          This demo wires AetherAR&apos;s engine shell, image tracking cadence, and a new Three.js
          renderer into one flow. Tap the marker card to simulate target lock and watch the model
          snap into place.
        </p>
        <div className="hero__status-row">
          <span className={`signal signal--${trackingEnabled ? 'live' : 'muted'}`}>
            {trackingEnabled ? 'Image target locked' : 'Target hidden'}
          </span>
          <span className="signal signal--glass">Engine: {engineState}</span>
          <span className="signal signal--glass">
            WebXR: {xrSupported === null ? 'checking' : xrSupported ? 'supported' : 'unavailable'}
          </span>
        </div>
      </section>

      <section className="workspace">
        <div
          className="demo-stage"
          ref={stageRef}
          onPointerMove={(event) => updatePointer(event.clientX, event.clientY)}
          onPointerLeave={() => {
            pointerRef.current = { x: 0.5, y: 0.5 };
          }}
        >
          <div className="demo-stage__aurora" />
          <div className="demo-stage__hud">
            <span className="signal signal--live">tracking @ 24 FPS</span>
            <button className="ghost-button" onClick={toggleTracking} type="button">
              {trackingEnabled ? 'Lose target' : 'Lock target'}
            </button>
          </div>

          <button
            className={`marker-card ${trackingEnabled ? 'marker-card--active' : ''}`}
            onClick={toggleTracking}
            ref={markerRef}
            type="button"
          >
            <span className="marker-card__eyebrow">AetherAR image target</span>
            <strong className="marker-card__title">Tap or hover to simulate detection</strong>
            <span className="marker-card__body">
              Swap this card for a real poster or product label once your CV target pipeline is in
              place.
            </span>
          </button>
        </div>

        <aside className="control-panel">
          <section className="panel">
            <div className="panel__header">
              <h2>Runtime</h2>
              <span>{renderStats.effectiveFPS || 0} FPS</span>
            </div>
            <p className="panel__copy">
              The stage uses <code>ThreeSceneRenderer</code> with AetherAR&apos;s adaptive render
              loop, so you can keep visuals smooth while the tracking loop runs at its own cadence.
            </p>
            <label className="slider-field">
              <span>Render budget</span>
              <strong>{targetFPS} FPS</strong>
            </label>
            <input
              className="slider-field__input"
              max={60}
              min={24}
              onChange={(event) => setTargetFPS(Number(event.currentTarget.value))}
              step={6}
              type="range"
              value={targetFPS}
            />
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Image Tracking</h2>
              <span>
                {activeTargets.length} active target{activeTargets.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="metric-grid">
              <div className="metric">
                <span className="metric__label">State</span>
                <strong>{trackingState}</strong>
              </div>
              <div className="metric">
                <span className="metric__label">Confidence</span>
                <strong>{Math.round(trackingConfidence * 100)}%</strong>
              </div>
              <div className="metric">
                <span className="metric__label">Frames</span>
                <strong>{trackingFrame}</strong>
              </div>
              <div className="metric">
                <span className="metric__label">Avg frame</span>
                <strong>{renderStats.averageFrameMs} ms</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Drop In Your Model</h2>
              <span>glTF ready</span>
            </div>
            <p className="panel__copy">
              The demo shows a generated hologram, but the renderer can load your product or
              character model directly.
            </p>
            <pre className="code-block">{`const model = await renderer.loadGLTFModel('/models/product.glb');
renderer.add(model);`}</pre>
          </section>
        </aside>
      </section>
    </main>
  );
}

export function App() {
  return (
    <AetherAR performance="balanced">
      <Dashboard />
    </AetherAR>
  );
}
