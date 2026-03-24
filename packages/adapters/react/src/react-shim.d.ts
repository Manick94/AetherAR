declare module 'react' {
  export type PropsWithChildren<P = object> = P & { children?: unknown };
  export function useMemo<T>(factory: () => T, deps: unknown[]): T;
  export function useEffect(effect: () => void | (() => void), deps: unknown[]): void;

  export interface Context<T> {
    Provider: (props: { value: T; children?: unknown }) => unknown;
  }

  export function createContext<T>(defaultValue: T): Context<T>;
  export function useContext<T>(context: Context<T>): T;
}

declare module 'react/jsx-runtime' {
  export const Fragment: unique symbol;
  export function jsx(type: unknown, props: unknown): unknown;
  export function jsxs(type: unknown, props: unknown): unknown;
}
