# DockScope Branding

The application has been rebranded from Docker Space Manager to **DockScope**.

Source of truth for graphic assets: `assets/branding/dockscope-brand-sheet.png`, copied from the user-provided brand sheet.

Generated/extracted assets:

- `dockscope-app-icon-master.png`
- `dockscope-icon-{16,32,48,64,128,256,512}.png`
- `dockscope-logo-horizontal.png`
- `dockscope-banner.png`
- `build/icon.ico`
- `build/icon.png`
- `build/icon-tray.png`
- Renderer `app-icon.png`, horizontal logo and banner assets

Product identity:

- Product name: DockScope
- Tagline: Docker Operations & Intelligence
- Product themes: Inspect · Diagnose · Optimize
- Application ID: `com.dockscope.desktop`
- Package name: `dockscope-desktop`
- SQLite database: `dockscope.sqlite3`

The first startup attempts to copy a legacy `docker-space-manager.sqlite3` database when the DockScope database is not present, preserving existing local state where possible. Legacy `DSM_*` environment-variable names remain supported internally for compatibility.
