export interface ImageTarget {
  id: string;
  width: number;
  height: number;
  metadata?: Record<string, string>;
}

export interface TargetStore {
  add(target: ImageTarget): void;
  remove(targetId: string): void;
  get(targetId: string): ImageTarget | undefined;
  list(): readonly ImageTarget[];
  size(): number;
}

export function createTargetStore(maxTargets: number): TargetStore {
  const targets = new Map<string, ImageTarget>();

  return {
    add(target) {
      if (targets.size >= maxTargets && !targets.has(target.id)) {
        throw new Error(`Target store full (max ${maxTargets})`);
      }
      targets.set(target.id, Object.freeze({ ...target }));
    },
    remove(targetId) {
      targets.delete(targetId);
    },
    get(targetId) {
      return targets.get(targetId);
    },
    list() {
      return Object.freeze(Array.from(targets.values()));
    },
    size() {
      return targets.size;
    }
  };
}
