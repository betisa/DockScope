# Contributing to DockScope

Thanks for helping improve DockScope. This project is a security-sensitive Electron desktop application that manages Docker resources, so contributions should be small, reviewable, evidence-based, and explicit about privilege boundaries.

## Before you start

1. Read `README.md`.
2. Read `docs/SECURITY-REVIEW.md` and the architecture/security sections in `README.md`.
3. Read `docs/GIT-WORKFLOW.md`.
4. Search existing issues and pull requests.
5. For large changes, open an issue before implementation.

## Development requirements

- Windows 10/11
- Docker Desktop
- Node.js 22+
- Visual Studio 2022 Build Tools with C++ workload when native modules need rebuilding
- Python available to `node-gyp`
- Git 2.40+

Install and verify:

```powershell
npm install
npm run typecheck
npm test
npm run build
```

For native Electron dependencies, `npm install` runs:

```text
electron-builder install-app-deps
```

## Branch model

DockScope uses a lightweight Git Flow:

```text
main
  ↑
release/*
  ↑
develop
  ↑
feature/* | fix/* | refactor/* | docs/* | test/*

main
  ↑
hotfix/*
```

Do not commit directly to `main` or `develop`.

Create branches from:

- `feature/*`, `fix/*`, `refactor/*`, `docs/*`, `test/*` → `develop`
- `release/*` → `develop`, then PR to `main`
- `hotfix/*` → `main`, then back-merge to `develop`

Examples:

```text
feature/container-ai-diagnostics
fix/compose-loading-state
refactor/docker-service-boundaries
docs/contribution-guide
release/1.2.0
hotfix/1.2.1
```

## Commit convention

Use Conventional Commits:

```text
<type>(<optional-scope>): <summary>
```

Allowed types:

```text
feat
fix
docs
refactor
perf
test
build
ci
chore
style
security
revert
```

Examples:

```text
feat(buildkit): add AI-assisted error analysis
fix(compose): prevent editor from remaining in loading state
docs(contributing): document Git Flow
security(ipc): reject unsafe container paths
ci(release): publish NSIS assets to GitHub Releases
```

Keep the subject imperative, lower-case where natural, and under 100 characters.

Breaking changes:

```text
feat(api)!: replace legacy updater contract

BREAKING CHANGE: update configuration now comes from GitHub Releases.
```

Enable the local commit hook once after cloning:

```powershell
npm run git:setup
```

## Pull requests

A pull request should:

- target the correct base branch;
- use a Conventional Commit-style PR title;
- describe the problem and solution;
- include tests or explain why tests are not applicable;
- include screenshots for visible UI changes;
- include security impact for Main/IPC/preload changes;
- avoid unrelated refactors;
- update docs when behavior changes.

PRs should normally be squash-merged. The squash commit title becomes the canonical Conventional Commit on the target branch.

## Security-sensitive changes

Changes involving any of the following need explicit review:

- `src/main/**`
- `src/preload/**`
- Docker/Compose command construction
- filesystem writes
- `node-pty`
- SQLite persistence
- updater/release code
- AI provider requests or secret handling
- destructive cleanup
- VHDX / WSL operations

Rules:

- no `shell: true`;
- no arbitrary shell command IPC;
- validate IDs/paths/URLs in Main;
- Renderer must not receive raw API keys or privileged filesystem access;
- keep confirmations around destructive operations;
- preserve the invariant that persistent volumes are excluded from automatic safe cleanup.

## Testing expectations

At minimum:

```powershell
npm run repo:check
npm run typecheck
npm test
npm run build
```

For release-sensitive changes:

```powershell
npm run test:e2e
npm run ga:budget
npm run release:verify
```

Do not claim an Electron runtime/package test passed unless it was actually executed.

## Documentation

Update the relevant files under `docs/` and `CHANGELOG.md` when behavior changes.

For a new feature, document:

- goal;
- user workflow;
- security boundary;
- constraints/non-goals;
- validation/evidence.

## Releases

Releases are produced by GitHub Actions from version tags.

Stable:

```text
package.json: 1.2.0
tag:          v1.2.0
channel:      latest
```

Preview:

```text
package.json: 1.3.0-beta.1
tag:          v1.3.0-beta.1
channel:      beta
```

See `docs/RELEASE-PROCESS.md`.

## Questions

Use GitHub Discussions when enabled, or open an issue using the Question template only when the topic needs repository-level tracking.
