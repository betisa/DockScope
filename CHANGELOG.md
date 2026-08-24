# Changelog

All notable changes to DockScope Desktop are documented here.

## [1.0.0] - 2026-08-21

### Added
- Operational Intelligence now opens from a Dashboard icon in a side drawer; duplicate alert-policy controls were removed from the notification view and Settings is the sole policy source.
- Uptime Reports page inspired by Uptime Kuma: searchable container/Compose monitor list, live status bars, runtime history chart, 24-hour/30-day uptime metrics, and persisted status samples.
- Independent Runtime Uptime dashboard widget combining live Docker container and Compose service uptime with customizable placement and visibility.
- Live uptime for running Docker containers and Compose services, backed by Docker runtime start timestamps and refreshed in the renderer.
- Build History Diagnostics modal: BuildKit Diagnostics now opens in an accessible modal with the existing Overview/Logs/Steps/Cache/Timing/Error Analysis tabs instead of an inline workspace.
- Unified Images & Image Intelligence: removed the standalone Image Intelligence page and moved analysis into an accessible modal launched from each Images row; Resource Graph and Command Palette image deep-links now open that modal.
- About / Updates / Release Channel: runtime app/Electron/Node/Chromium/Docker versions, bundled/remote release notes, Stable/Preview channel, explicit update check/download/progress/install and NSIS/Portable safety handling.
- SQLite persistence via Knex.js: migrated Settings, Monitoring/Notifications, Audit/Recovery, Task Center, Storage Trends, Dashboard and Productivity state from JSON/localStorage into one WAL-enabled SQLite database with one-time legacy import.
- Container File Browser: browse container filesystem, view bounded UTF-8 text, download/copy path, and guarded/audited upload or text overwrite with mount-aware protections.
- Smart Cleanup Planning by Target: user-defined reclaim goal, risk-ordered plan selection, dangling/unused image de-duplication, shortfall reporting, Task Center execution, and permanent Volume exclusion.
- P13.09 Dashboard Customization: persistent widget visibility/order/density, drag/accessibility reorder controls, reset defaults and new Unhealthy/Build/Volume/Alert widgets.
- P13.08 Storage Trends: bounded local 15-minute Docker/VHDX sampling, 24h/7d/30d charts, storage composition, delta/peak analysis, manual sampling and Diagnostics Bundle integration.
- P13.07 Diagnostics Bundle Export: Main-owned Save Dialog, redacted multi-collector support ZIP, manifest/README, bounded container diagnostics/log tails and privacy review guidance.
- P13.06 Operation Task Center: Main-process long-running operation queue, live output/progress, cancellation, persistent/redacted history and resource-page integration.
- P13.05 Resource Dependency Graph: Compose/Service/Container topology with Image, Volume, Network and Port dependencies, shared-resource detection, search/focus and deep links.
- P13.04 Volume Intelligence: volume/container/Compose ownership, mount targets, workload detection, conservative risk scoring, backup guidance and Intelligence workspace.
- P13.03 Port Explorer: global host/container port bindings, Compose ownership, exposure classification, conflict detection, browser endpoints, search/pagination and resource deep links.
- P13.02 Container Diagnostics Advisor: evidence-driven OOM, exit-code, restart, health, log-pattern, memory, and CPU diagnostics inside Container Workspace.
- P13.01 Build Diagnostics Workspace: Buildx inspect/logs/open integration with Overview, Logs, Steps, Cache, Timing, and evidence-based Error Analysis.
- Added a contextual in-page Guide drawer to every top-level page, including workflows, safety notes, and keyboard help.
- GA accessibility pass with skip navigation, live announcements and focus management.
- Renderer ErrorBoundary.
- Heavy workspace code splitting.
- Virtualized Container and Image inventories.
- GA bundle-size budget verification.
- Keyboard-focused Electron E2E coverage.
- High-contrast / forced-colors / high-DPI support.
- M12 GA release documentation.

### Fixed
- Electron E2E reliability: run the mock Docker CLI with `ELECTRON_RUN_AS_NODE=1` when `process.execPath` is Electron, propagate the resolved environment to Task Center commands, and label the actual `<nav>` landmark as Primary navigation.
- Release verification typecheck: fixed strict typings for health-log evidence, Docker stream child processes, Smart Cleanup commands, Task Center IPC events, VHDX discovery, and renderer graphic asset imports.
- Volume Intelligence card-header spacing: restored horizontal padding for compact card headers, aligned badges/actions, and added tighter responsive/nested workload spacing without changing the global compact section rule.
- Dashboard compact navigation & Container Diagnostics fix: replaced long widget links with icon actions/tooltips, shortened Quick Actions, expanded problem-container detection, and made Dashboard → Container Advisor deep-links deterministic.
- Compose editor permanent loading: source-file loading now has explicit loading/error/ready states, 10-second bounded Main reads, retry UX, ConfigFiles normalization, and descriptive ENOENT/EACCES errors.
- Compose Services Switch import crash: fixed missing `Switch` import in `ComposeWorkspace` and added a renderer-wide regression test for all `<Switch>` usages.
- Fixed Buildx History parsing for Docker Desktop snake_case NDJSON (`ref`, `created_at`, `completed_at`, `cached_steps`, `completed_steps`, `total_steps`).
- Build History now derives missing duration and Build ID from timestamps/ref and displays step/cache progress.

- Fixed custom title-bar dragging with a dedicated Windows drag region.
- Added purpose-specific Hugeicons for resource navigation.
- Added Created At and Docker-reported Size columns to Volumes.
- Added reusable search + 10-item pagination to non-Container resource lists.
- Live Logs batch incoming output before updating React state.
- Docker Events batch incoming events before rendering.
- Command Palette search uses deferred rendering and focus trapping.
- Hugeicons wrapper now distinguishes decorative and meaningful icons.
- Product version promoted from 0.11.0 to 1.0.0.

### Security
- No change to destructive-action policy.
- Volumes remain excluded from Safe Cleanup.
- Renderer retains `nodeIntegration: false`, `contextIsolation: true`, and sandboxing.

## [0.11.0] - 2026-08-21
- Settings, Profiles & Advanced Configuration.

## [0.10.0] - 2026-08-21
- Testing, Packaging & Release Readiness.

## [0.9.0] - 2026-08-21
- Audit, Cleanup History & Recovery Metadata.

## [0.8.0] - 2026-08-21
- Command Palette, Global Search & Productivity.

## [0.7.0] - 2026-08-21
- Notifications, Tray & Operational Intelligence.

## [0.6.0] - 2026-08-21
- BuildKit & Image Intelligence.

## [0.5.0] - 2026-08-21
- Compose Workspace.

## [0.4.0] - 2026-08-21
- Runtime & Diagnostics.

### Added
- AI-assisted Build Error Analysis with OpenAI-compatible Chat Completions, Settings configuration, encrypted API-key persistence, redacted bounded evidence, connection test, and explicit Analyze with AI flow.

### Added
- Container AI Failure Analysis in Container Workspace → Advisor for stopped/failed, OOM/restart, unhealthy, and configured-but-unavailable health evidence; reuses the OpenAI-compatible provider with Main-owned redaction and bounded logs.

### Added
- Colored Workspace Logs: Container and Compose live logs now highlight severity, timestamps, stderr, HTTP status, exceptions and Compose service prefixes while preserving streaming/filtering behavior.

### Changed
- DockScope rebrand: product/package/app identity, installer/tray/About/sidebar/title and graphic assets now use the supplied DockScope brand sheet; legacy local database migration is included.

### Fixed
- Release verification regression suite: aligned stale source-contract tests with the current GitHub updater, unified AI Diagnostics settings, canonical container file paths, current page inventory/navigation metadata, Smart Cleanup/Task Center formatting, and the unified paginated Images workspace.
