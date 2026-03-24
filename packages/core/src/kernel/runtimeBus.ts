export type Unsubscribe = () => void;

export type RuntimeEventMap = {
  stateChanged: {
    previous: string;
    next: string;
    timestamp: number;
  };
  tick: {
    frameId: number;
    deltaMs: number;
    timestamp: number;
  };
};

type EventKey = keyof RuntimeEventMap;

type Handler<K extends EventKey> = (payload: RuntimeEventMap[K]) => void;

export class RuntimeBus {
  private readonly handlers = new Map<EventKey, Set<Handler<EventKey>>>();

  public emit<K extends EventKey>(event: K, payload: RuntimeEventMap[K]): void {
    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers) {
      return;
    }

    for (const handler of eventHandlers) {
      (handler as Handler<K>)(payload);
    }
  }

  public on<K extends EventKey>(event: K, handler: Handler<K>): Unsubscribe {
    const existing = this.handlers.get(event) ?? new Set<Handler<EventKey>>();
    existing.add(handler as Handler<EventKey>);
    this.handlers.set(event, existing);

    return () => {
      existing.delete(handler as Handler<EventKey>);
      if (existing.size === 0) {
        this.handlers.delete(event);
      }
    };
  }
}
