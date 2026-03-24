declare module 'react' {
  export type PropsWithChildren<P = object> = P & { children?: unknown };
  export function useMemo<T>(factory: () => T, deps: unknown[]): T;
  export function useEffect(effect: () => void | (() => void), deps: unknown[]): void;
}

declare module 'react/jsx-runtime' {
  export const Fragment: unique symbol;
  export function jsx(type: unknown, props: unknown): unknown;
  export function jsxs(type: unknown, props: unknown): unknown;
}
