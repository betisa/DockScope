# About / Updates / Release Channel

## Objective

Provide a production-grade application lifecycle workspace:

- About
- Current application version
- Electron / Node / Chromium runtime versions
- Docker Engine / Docker Compose / Docker Context versions
- Bundled current release notes
- Available update release notes
- Check for updates
- Stable / Preview release channel
- Explicit update download
- Download progress
- Explicit Install & Restart

## Architecture

```text
React AboutPage
      ↓
Typed Preload
      ↓
Validated IPC
      ↓
UpdateService
      ↓
electron-updater
      ↓
Generic release feed
```

Renderer cannot execute installers or select an arbitrary updater provider.

## Dependency

```text
electron-updater 6.8.9
```

The updater is managed in Electron Main.

## Update Source

The product does not hard-code a fake production URL.

The release feed can be provided using:

```text
DSM_UPDATE_BASE_URL
```

or:

```text
build/update-config.json
```

Example:

```json
{
  "baseUrl": "https://downloads.example.com/dockscope",
  "releasePageUrl": "https://example.com/dockscope/releases"
}
```

Environment variables take precedence:

```text
DSM_UPDATE_BASE_URL
DSM_RELEASE_PAGE_URL
```

## Channels

User-facing channels:

```text
Stable
Preview
```

Updater mapping:

```text
Stable  → latest
Preview → beta
```

Stable receives production releases.

Preview enables prerelease updates and can receive beta releases plus newer stable releases.

The selected channel is persisted in SQLite:

```text
app_state
└── application.releaseChannel
```

## Current Version / Runtime Information

About reads:

```text
Application      app.getVersion()
Electron         process.versions.electron
Node.js          process.versions.node
Chromium         process.versions.chrome
Platform         process.platform
Architecture     process.arch
Docker Engine    docker version
Docker Compose   docker compose version
Docker Context   active Docker context
```

The values are read from the actual running application/runtime rather than duplicated UI constants.

## Release Notes

Current release notes are bundled as:

```text
resources/release-notes.json
```

Source:

```text
build/release-notes.json
```

Available-update notes are taken from electron-updater `UpdateInfo.releaseNotes`.

Remote release notes are bounded before being sent to Renderer.

## Update Lifecycle

Automatic download is intentionally disabled:

```text
autoDownload = false
```

Flow:

```text
Check for updates
      ↓
update-available
      ↓
Download update
      ↓
download-progress
      ↓
update-downloaded
      ↓
Install & Restart
      ↓
quitAndInstall()
```

This ensures a check does not unexpectedly download an installer.

## Update Statuses

```text
idle
checking
available
not-available
downloading
downloaded
error
unsupported
```

Renderer receives update state changes via event-driven IPC.

## Download Progress

The UI displays:

- percent;
- transferred bytes;
- total bytes;
- bytes per second.

## Install Guard

Install is available only after:

```text
update-downloaded
```

The user must explicitly choose:

```text
Install & Restart
```

and confirm application restart.

The renderer cannot call a generic process execution API.

## Portable Build

Portable Windows packages do not offer self-install.

Detection:

```text
PORTABLE_EXECUTABLE_DIR
PORTABLE_EXECUTABLE_FILE
```

About displays:

```text
Portable — manual update
```

and disables update check/download/install.

For self-update, install the NSIS target.

## Development Build

Updater actions are disabled when:

```text
app.isPackaged === false
```

This prevents confusing development behavior and accidental installation attempts.

## NSIS

The existing Windows targets remain:

```text
NSIS
Portable
```

Only NSIS is the self-update target.

## Channel Metadata

`electron-builder` is configured with:

```json
"generateUpdatesFilesForAllChannels": true
```

Release infrastructure should publish metadata/artifacts produced by the same build.

Typical Windows release feed:

```text
latest.yml
beta.yml
DockScope-1.1.0-x64.exe
DockScope-1.1.0-x64.exe.blockmap
DockScope-1.2.0-beta.1-x64.exe
...
```

Exact filenames depend on the final electron-builder artifact configuration.

Never mix an updater YAML file from one build with an installer from another build.

## Stable Release Versioning

Example:

```text
1.1.0
```

channel:

```text
latest
```

## Preview Release Versioning

Example:

```text
1.2.0-beta.1
```

channel:

```text
beta
```

Preview users can receive preview releases. Stable users remain on the latest stable channel.

## Build Update Artifacts

For an update-capable Windows build, set the real generic feed URL and run:

```powershell
$env:DSM_UPDATE_BASE_URL = "https://downloads.example.com/dockscope"
npm run package:update:win
```

This uses:

```text
electron-builder.update.cjs
```

which adds a Generic publish configuration only for the updater build and limits the target to NSIS.

`--publish never` is intentional for a Generic server: electron-builder creates update metadata/artifacts, while your CI/deployment system uploads the generated files to the configured server.

The normal `package:win` script can continue producing NSIS + Portable without requiring an update URL.

## Release Server Checklist

1. Set the application version.
2. Update `build/release-notes.json`.
3. Build/sign the NSIS release.
4. Generate matching electron-builder update metadata.
5. Upload installer, blockmap and channel metadata together.
6. Verify SHA-512 metadata belongs to the uploaded installer.
7. Configure `DSM_UPDATE_BASE_URL` / packaged `update-config.json`.
8. Install the previous NSIS version on a clean Windows machine.
9. Check for update from About & Updates.
10. Download the update.
11. Verify download progress.
12. Choose Install & Restart.
13. Verify the new `app.getVersion()`.
14. Repeat Stable and Preview channel tests independently.

## Security Boundary

```text
Renderer
   ↓ typed intent
Main
   ↓ validated Stable/Preview channel
electron-updater
   ↓ release metadata + checksum verification
NSIS updater
```

The Renderer cannot:

- set arbitrary feed URLs;
- switch provider type;
- download arbitrary executable URLs;
- launch arbitrary installers;
- call `quitAndInstall` before the update is downloaded.

## SQLite Persistence

Release channel uses the existing Knex/SQLite persistence layer.

No JSON/localStorage state is introduced.

## Acceptance Criteria

- [x] About & Updates top-level page exists.
- [x] Current application version is runtime-derived.
- [x] Electron version is displayed.
- [x] Node version is displayed.
- [x] Chromium version is displayed.
- [x] Docker Engine version is displayed.
- [x] Docker Compose version is displayed.
- [x] Docker Context is displayed.
- [x] Current release notes are bundled.
- [x] Available release notes are displayed.
- [x] Stable channel exists.
- [x] Preview channel exists.
- [x] Channel persists in SQLite.
- [x] Update check is explicit.
- [x] Auto-download is disabled.
- [x] Download is explicit.
- [x] Download progress is visible.
- [x] Install requires update-downloaded.
- [x] Install & Restart has explicit confirmation.
- [x] Development builds disable updater actions.
- [x] Portable builds disable self-update.
- [x] NSIS remains the Windows self-update target.
- [x] Renderer cannot set arbitrary update feed URLs.
