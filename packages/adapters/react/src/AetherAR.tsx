import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type PropsWithChildren
} from 'react';
import { AetherEngine, type AetherEngineOptions } from '@aetherar/core';

const EngineContext = createContext<AetherEngine | null>(null);

export interface AetherARProps extends PropsWithChildren {
  performance?: AetherEngineOptions['performance'];
  debug?: boolean;
  autoStart?: boolean;
  onInitialized?: (engine: AetherEngine) => void;
}

export function AetherAR({
  children,
  performance = 'balanced',
  debug = false,
  autoStart = true,
  onInitialized
}: AetherARProps) {
  const engine = useMemo(() => new AetherEngine({ performance, debug }), [performance, debug]);

  useEffect(() => {
    void engine.initialize().then(async () => {
      onInitialized?.(engine);
      if (autoStart) {
        await engine.start();
      }
    });

    return () => {
      if (engine.getState() === 'running') {
        void engine.stop();
      }
    };
  }, [autoStart, engine, onInitialized]);

  return <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>;
}

export function useAetherEngine(): AetherEngine {
  const engine = useContext(EngineContext);
  if (!engine) {
    throw new Error('useAetherEngine must be used within <AetherAR />');
  }

  return engine;
}
