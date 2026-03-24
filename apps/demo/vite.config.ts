import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@aetherar/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@aetherar/react': fileURLToPath(new URL('../../packages/adapters/react/src/index.ts', import.meta.url)),
      '@aetherar/tracking': fileURLToPath(new URL('../../packages/tracking/src/index.ts', import.meta.url)),
      '@aetherar/rendering': fileURLToPath(new URL('../../packages/rendering/src/index.ts', import.meta.url)),
      '@aetherar/xr': fileURLToPath(new URL('../../packages/xr/src/index.ts', import.meta.url))
    }
  }
});
