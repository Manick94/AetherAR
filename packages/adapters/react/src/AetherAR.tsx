import { useEffect, useMemo, type PropsWithChildren } from 'react';
import { AetherEngine, type AetherEngineOptions } from '@aetherar/core';

export interface AetherARProps extends PropsWithChildren {
  performance?: AetherEngineOptions['performance'];
  debug?: boolean;
  onInitialized?: (engine: AetherEngine) => void;
}

export function AetherAR({
  children,
  performance = 'balanced',
  debug = false,
  onInitialized
}: AetherARProps) {
  const engine = useMemo(() => new AetherEngine({ performance, debug }), [performance, debug]);

  useEffect(() => {
    void engine.initialize().then(() => {
      onInitialized?.(engine);
    });

    return () => {
      if (engine.getState() === 'running') {
        void engine.stop();
      }
    };
  }, [engine, onInitialized]);

  return <>{children}</>;
}
