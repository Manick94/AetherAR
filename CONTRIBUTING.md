# Contributing to AetherAR

## Setup

1. Install Node.js 22+
2. Run `npm install`
3. Run `npm run typecheck`

## Development rules

- Keep package boundaries clean (`core` should not import adapter code).
- Add strict TypeScript types for all exported APIs.
- Prefer interface-first design for runtime modules (tracking, xr, rendering).

## Pull Requests

- Include architecture notes for non-trivial changes.
- Add tests/type checks for new APIs.
- Keep changes scoped per package when possible.
