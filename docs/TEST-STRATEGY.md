# Test Strategy

The suite follows a test pyramid.

## Unit
Fast, deterministic tests for process behavior, parsing and secret masking.

## Integration
`dockerService` executes against `tests/mock/docker-cli.mjs`. This preserves the real process boundary while avoiding mutation of the developer's Docker Desktop state.

Set:
- `DSM_DOCKER_MOCK_SCRIPT`
- `DSM_MOCK_SCENARIO`

Supported mock scenarios:
- `success`
- `failure`
- `daemon-down`
- `timeout`

## Renderer
React Testing Library validates user-visible behavior and destructive confirmation semantics.

## Electron E2E
Playwright launches the built Electron main process with the mock Docker CLI injected through environment variables. This verifies the Main → Preload → Renderer path without requiring a Docker daemon.

## Real Docker acceptance
Real destructive tests are intentionally not automated by default. They should run only against disposable CI/QA Docker state.

## CI dependency note
The source snapshot did not contain `package-lock.json`. M10 CI therefore uses `npm install` until the first approved lockfile is generated and committed. The release checklist requires switching CI to `npm ci` afterward.
