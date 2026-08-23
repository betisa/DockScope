# M07 — Notifications, Tray & Operational Intelligence

## Objective
Turn DockScope into an always-on operational companion instead of a dashboard that must be watched manually.

## Delivered
- Background Operational Intelligence service in Electron Main
- Persistent notification history
- Monitoring settings persistence
- Windows native notifications
- System Tray status and quick actions
- Docker Engine disconnect detection
- Container unhealthy transition detection
- Unexpected container exit detection
- Restart-loop heuristic
- VHDX threshold monitoring
- Build-cache reclaimable threshold monitoring
- Notification Center UI with severity filtering and read/unread state
- Background monitoring survives main window close

## Safety
- Monitoring is read-only.
- Cleanup is never triggered automatically.
- Volume removal is never triggered automatically.
- VHDX compaction is never triggered automatically.
- User can disable individual alert classes or all monitoring.
- Poll interval has a lower bound to avoid excessive Docker CLI activity.

## Defaults
- VHDX warning: 70 GB
- Build Cache warning: 15 GB reclaimable
- Poll interval: 30 seconds

## Acceptance Criteria
- An unhealthy transition produces one deduplicated alert.
- Running → stopped produces an unexpected-exit warning.
- Repeated restarting state produces a restart-loop warning.
- Large VHDX and reclaimable Build Cache produce warnings.
- Notifications persist across application restarts.
- Tray remains available while the main window is closed.
