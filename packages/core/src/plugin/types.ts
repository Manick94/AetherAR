import type { RuntimeContext } from '../kernel/types';

export interface AetherPlugin {
  name: string;
  setup?(context: RuntimeContext): void | Promise<void>;
  onStart?(context: RuntimeContext): void | Promise<void>;
  onStop?(context: RuntimeContext): void | Promise<void>;
}
