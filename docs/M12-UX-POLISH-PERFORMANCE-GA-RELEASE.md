# M12 — UX Polish, Performance & GA Release

## Objective
Freeze major feature work and harden DockScope Desktop for a Windows 1.0 GA candidate.

## UX / UI changes
- Applied UI UX Pro Max developer-tool guidance.
- Added skip navigation.
- Added visible focus behavior.
- Added live screen-reader announcements for navigation and command results.
- Added command-palette focus trap and focus restoration.
- Added loading skeletons, inline error states and renderer ErrorBoundary.
- Added stronger long-token/path wrapping.
- Added high-contrast and Windows forced-colors support.
- Added explicit high-DPI treatment.
- Preserved `prefers-reduced-motion`.
- Refined compact controls without relying on color alone.

## Hugeicons
- Kept the app-level Hugeicons wrapper.
- Icons inherit `currentColor`.
- Decorative icons are hidden from assistive technology.
- Meaningful icons can be exposed through wrapper labels.
- Imports remain explicit from `@hugeicons/core-free-icons` for tree shaking.
- Runtime controls now use Hugeicons for search, pause/play, refresh and clear actions.

## Performance
- React.lazy code splitting for heavy workspaces.
- Suspense loading fallback.
- Container and image table virtualization at 100+ rows.
- `useDeferredValue` for large inventory filtering and command-palette search.
- Live Logs use a buffered 100 ms render flush instead of one render per Docker output chunk.
- Docker Events use a buffered 200 ms render flush.
- Resource stream sessions continue to terminate on unmount.
- Content visibility/containment added for high-frequency console/event surfaces.
- GA bundle-size budgets added.

## Failure isolation
- Renderer ErrorBoundary prevents one render exception from blanking the entire desktop app.
- Async resource pages surface errors instead of silently failing.
- Docker-unavailable startup remains a supported state.

## GA version
`1.0.0`

## Release blockers outside source control
Public GA distribution still requires:
1. A committed `package-lock.json` generated from the approved Node 22 environment.
2. A real Windows code-signing certificate / publisher identity.
3. Full Windows 11 + Docker Desktop acceptance run.
