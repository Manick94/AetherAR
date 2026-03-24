import { useEffect, useMemo, useState } from 'react';
import { AetherAR, useAetherEngine } from '@aetherar/react';
import { createImageTrackingLoop } from '@aetherar/tracking';
import { createAdaptiveRenderLoop, NoopRenderer } from '@aetherar/rendering';
import { BrowserXRRuntime } from '@aetherar/xr';

function Dashboard() {
  const engine = useAetherEngine();
  const [trackingFrames, setTrackingFrames] = useState(0);
  const [xrSupported, setXrSupported] = useState<boolean | null>(null);
  const [renderStats, setRenderStats] = useState({ frames: 0, averageFrameMs: 0, effectiveFPS: 0 });

  const tracking = useMemo(() => createImageTrackingLoop({ detectionFPS: 24 }), []);
  const xrRuntime = useMemo(() => new BrowserXRRuntime(), []);
  const renderLoop = useMemo(
    () =>
      createAdaptiveRenderLoop({
        renderer: new NoopRenderer(),
        targetFPS: 60,
        viewport: {
          width: () => window.innerWidth,
          height: () => window.innerHeight
        }
      }),
    []
  );

  useEffect(() => {
    void xrRuntime.isSupported().then(setXrSupported);

    const unsubscribeTick = tracking.onTick(() => {
      setTrackingFrames((previous) => previous + 1);
    });

    const statsTimer = window.setInterval(() => {
      setRenderStats(renderLoop.getStats());
    }, 500);

    tracking.start();
    renderLoop.start();

    return () => {
      unsubscribeTick();
      window.clearInterval(statsTimer);
      tracking.stop();
      renderLoop.stop();
    };
  }, [tracking, xrRuntime, renderLoop]);

  return (
    <main style={{ fontFamily: 'Inter, Arial, sans-serif', margin: '0 auto', maxWidth: 900, padding: 24 }}>
      <h1>AetherAR Demo Console</h1>
      <p>Use this app for demos, investor presentations, and integration smoke checks.</p>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2>Engine</h2>
        <p>State: <strong>{engine.getState()}</strong></p>
        <button onClick={() => void engine.start()} style={{ marginRight: 8 }}>Start Engine</button>
        <button onClick={() => void engine.stop()}>Stop Engine</button>
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2>Tracking Loop</h2>
        <p>Frames Processed: <strong>{trackingFrames}</strong></p>
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2>Rendering</h2>
        <p>Frames Rendered: <strong>{renderStats.frames}</strong></p>
        <p>Average Frame Time: <strong>{renderStats.averageFrameMs} ms</strong></p>
        <p>Effective FPS: <strong>{renderStats.effectiveFPS}</strong></p>
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
        <h2>XR Runtime</h2>
        <p>WebXR Supported: <strong>{xrSupported === null ? 'checking…' : xrSupported ? 'yes' : 'no'}</strong></p>
      </section>
    </main>
  );
}

export function App() {
  return (
    <AetherAR autoStart={false} performance="balanced">
      <Dashboard />
    </AetherAR>
  );
}
