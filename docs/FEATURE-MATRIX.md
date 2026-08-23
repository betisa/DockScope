# Feature Matrix

## Core implemented in v0.1

| Area | Capability | Status |
|---|---|---|
| Engine | Status/version/context | Implemented |
| Dashboard | `docker system df` summary | Implemented |
| Containers | list/start/stop/restart/remove | Implemented |
| Containers | logs/stats/inspect/exec command | Implemented |
| Compose | list/start/stop/restart/down/logs | Implemented |
| Images | list/remove/prune | Implemented |
| Volumes | list/reference detection/remove/prune bridge | Implemented |
| Networks | list/prune | Implemented |
| Cleanup | advisor/safe/balanced | Implemented |
| VHDX | discovery/size/compact | Implemented |
| Security | contextIsolation/sandbox/typed IPC | Implemented |
| UI | dark/light/responsive/Hugeicons | Implemented |

## Next milestones

- Live streaming logs/events/stats over cancellable IPC — Implemented in M04
- xterm.js PTY interactive terminal — Implemented in M04
- Docker Events page — Implemented in M04
- health history / ports / mounts / processes detail tabs — Implemented in M04
- BuildKit/buildx disk usage page
- image layer history visualization
- Monaco read-only Compose editor, then guarded write support
- notification center + Windows notifications
- system tray
- command palette
- cleanup audit/history persisted locally
- recovery metadata before destructive actions
- custom VHDX path selector
- automated tests + Playwright Electron smoke tests


## M05 — Compose Workspace

- [x] Project workspace tabs
- [x] Service-level lifecycle controls
- [x] Pull / Build / Up / Up + Build
- [x] Aggregated live logs with service filters
- [x] Live Compose stats
- [x] Resolved Compose topology
- [x] Networks / volumes / environment views
- [x] Monaco YAML editor
- [x] `docker compose config` validation
- [x] Monaco diff before save
- [x] Guarded save + backup + stale-file protection

## M06 — BuildKit & Image Intelligence
- Buildx builders: Implemented
- Buildx build history: Implemented
- Build cache records: Implemented
- Safe/all build cache prune: Implemented
- Image layer/history explorer: Implemented
- Large-layer advisor: Implemented

## M07 — Notifications, Tray & Operational Intelligence

- Background health monitoring: Implemented
- Container unhealthy alerts: Implemented
- Unexpected exit alerts: Implemented
- Restart-loop heuristic: Implemented
- VHDX threshold alerts: Implemented
- Build-cache threshold alerts: Implemented
- Persistent Notification Center: Implemented
- Windows native notifications: Implemented
- System Tray: Implemented
- Monitoring preferences: Implemented

## M08 — Command Palette, Global Search & Productivity

- Global Command Palette: Implemented
- Fuzzy global resource search: Implemented
- Container quick actions: Implemented
- Deep-link Logs / Compose / Images Intelligence modal: Implemented
- Safe Cleanup / Build Cache quick actions: Implemented
- Favorites / pinning: Implemented
- Recent Resources: Implemented
- Action History: Implemented
- Keyboard navigation: Implemented
- Productivity workspace: Implemented


## M09 — Audit, Cleanup History & Recovery

- Central action audit: Implemented
- Pre-delete recovery metadata: Implemented
- Cleanup history: Implemented
- Secret-masked snapshots: Implemented
- Audit report export: Implemented
- Recovery snapshot viewer: Implemented


## M10 — Testing, Packaging & Release Readiness
- Unit tests: Implemented
- Mock Docker CLI: Implemented
- Docker integration tests: Implemented
- React component tests: Implemented
- Electron Playwright smoke tests: Implemented
- Coverage configuration: Implemented
- Windows CI: Implemented
- NSIS/Portable packaging: Implemented
- Security review: Implemented
- Release checklist: Implemented
- Production code signing: Requires release-owner certificate


## M11 — Settings, Profiles & Advanced Configuration
- Persistent settings engine: Implemented
- Development profile: Implemented
- Conservative profile: Implemented
- CI / Build Heavy profile: Implemented
- Low Disk Space profile: Implemented
- Custom profile: Implemented
- Docker CLI/context configuration: Implemented
- Monitoring policy synchronization: Implemented
- Cleanup defaults: Implemented
- Terminal/log defaults: Implemented
- Storage preferences: Implemented
- Security/retention policy: Implemented
- Windows startup preference: Implemented


## M12 — UX Polish, Performance & GA Release
- React lazy loading / code splitting: Implemented
- Renderer ErrorBoundary: Implemented
- Container/Image virtualization: Implemented
- Deferred large-list search: Implemented
- Live Logs render batching: Implemented
- Docker Events render batching: Implemented
- Skip navigation / live announcements: Implemented
- Command Palette focus trap/restoration: Implemented
- Forced-colors/high-contrast/high-DPI CSS: Implemented
- Hugeicons accessibility wrapper: Implemented
- Bundle-size GA budget: Implemented
- Keyboard-focused E2E checks: Implemented
- GA changelog/release notes/checklists: Implemented
- Public Windows code signing: Requires real publisher certificate

## M13 Advanced Diagnostics

- Build Diagnostics Workspace: Implemented (P13.01)
- Buildx history inspect JSON: Implemented
- Buildx history logs / step parsing: Implemented
- Cache and timing diagnostics: Implemented
- Evidence-based build error analysis: Implemented
- Open build record in Docker Desktop: Implemented

- Container Diagnostics Advisor: Implemented (P13.02) — OOM/exit/restart/health/log-pattern/resource-pressure analysis with evidence and recommended actions.

- Port Explorer — global Docker binding inventory, Compose ownership, exposure classification, conflict detection, copy/open and deep links: Implemented

- Volume Intelligence — ownership, Compose references, mount targets, workload detection, risk score, backup hints and typed-delete safety: Implemented

- Resource Dependency Graph — Compose→Service→Container→Image/Volume/Network/Port topology, shared-resource detection, search/focus and deep links: Implemented

- Operation Task Center — persistent long-running Docker operations, live progress/output, cancellation, history, launcher and resource integration: Implemented

- Diagnostics Bundle Export — redacted troubleshooting ZIP with manifest, bounded logs, Docker/BuildKit/Volume/Graph/Monitoring/Task/Audit collectors and Save Dialog: Implemented

- Storage Trends — local 15-minute Docker/VHDX sampling, 24h/7d/30d charts, composition, deltas/peaks, bounded retention and Diagnostics Bundle integration: Implemented

- Dashboard Customization — persistent widget visibility/order/density, accessible reorder, reset, Unhealthy Containers, Recent Builds, Top Volumes and Recent Alerts: Implemented

- Smart Cleanup Planning by Target — target GB input, risk-aware minimal plan, potential/shortfall, Task Center execution, Volumes excluded: Implemented

- Container File Browser — filesystem browse, bounded text view, download/copy path, guarded upload/write, mount-aware write blocking and audit: Implemented

- SQLite / Knex Persistence — unified Main-process SQLite state store for settings, histories, monitoring, trends, dashboard/productivity preferences plus one-time legacy import: Implemented

- About / Updates / Release Channel — runtime versions, bundled/remote release notes, Stable/Preview channel persisted in SQLite, explicit check/download/progress/install with NSIS updater: Implemented

- Unified Images / Image Intelligence modal — image inventory plus layer history/optimization advisor in one page; standalone Intelligence route removed: Implemented

- Container AI Failure Analysis — explicit OpenAI-compatible second opinion for stopped/failed, OOM/restart, unhealthy and configured-health-unavailable states with redacted bounded evidence: Implemented
