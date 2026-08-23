# M10 — Testing, Packaging & Release Readiness

## Objective
Establish reproducible release gates for DockScope Desktop.

## Delivered
- Vitest unit tests
- Docker service integration tests
- React Testing Library component tests
- Mock Docker CLI with deterministic scenarios
- Playwright Electron smoke tests
- Coverage configuration
- Windows GitHub Actions pipeline
- NSIS + Portable packaging gate
- Release verification script
- Security review
- Performance/readiness checklist
- Release checklist

## Test scenarios
- Docker CLI success
- Docker command failure
- Docker daemon unavailable
- command timeout
- `docker system df` JSON parsing
- container inventory parsing
- secret masking
- destructive confirmation behavior
- Electron startup with Docker available
- Electron startup with Docker unavailable

## Release gate
A release candidate should not be packaged until:
1. `npm ci`
2. `npm run typecheck`
3. `npm run test:coverage`
4. `npm run build`
5. `npm run test:e2e`
6. `npm run package:win`

all pass on Windows.


## Defects found during M10
The release-readiness pass detected and fixed a missing Main-process import for the Operational Intelligence and Audit services. This is exactly the class of integration defect M10 is intended to catch before packaging.

E2E test launches set `NODE_ENV=test`, which disables the System Tray while preserving the Main → Preload → Renderer pipeline.
