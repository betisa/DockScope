# DockScope Desktop 1.0

DockScope Desktop 1.0 is the first GA candidate of the Windows Docker Desktop companion built across M01–M12.

## Highlights
- Docker Engine and disk dashboard
- Container lifecycle and diagnostics
- Live Logs / Live Stats / Health / Processes / Ports / Mounts / Networks
- Interactive xterm.js + node-pty terminal
- Docker Events
- Compose project workspace and Monaco editor
- BuildKit cache analysis
- Image layer intelligence
- Safe Cleanup Advisor
- Docker VHDX analysis and compaction workflow
- Notifications and System Tray
- Command Palette and global search
- Audit history and Recovery Metadata
- Settings and workload profiles
- Windows installer and portable packaging pipeline

## 1.0 hardening
- Heavy pages are lazy-loaded.
- Large Container/Image inventories are virtualized.
- Live logs and Docker events are batched to reduce Renderer churn.
- Command Palette now traps/restores keyboard focus.
- ErrorBoundary isolates unexpected Renderer errors.
- Loading/error states are more explicit.
- High-contrast, forced-colors, reduced-motion and high-DPI CSS are included.
- Hugeicons usage is centralized and accessibility-aware.
- GA bundle budgets and keyboard E2E tests are included.

## Safety
Volumes remain excluded from Safe Cleanup. Critical persistent-data operations remain separate and confirmation-driven. Recovery Metadata is not a backup of volume contents.

## Known release requirements
Public binaries should not be distributed until Windows code signing and final Windows acceptance are complete.
