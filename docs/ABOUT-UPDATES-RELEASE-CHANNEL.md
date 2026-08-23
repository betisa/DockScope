# About / Updates / Release Channel

DockScope uses `electron-updater` with **GitHub Releases**.

## Channels

```text
Stable  → latest
Preview → beta
```

The selected product channel is persisted in SQLite as `application.releaseChannel`.

## Packaging

The GitHub release build uses:

```text
electron-builder.github.cjs
```

Provider:

```text
github.com/mohikan1986/DockScope
```

`electron-builder` generates the internal `resources/app-update.yml` plus channel metadata. Runtime code does not call `setFeedURL`.

## Update flow

```text
Check for updates
  ↓
GitHub Releases
  ↓
Update available
  ↓
Explicit Download
  ↓
Progress
  ↓
Downloaded
  ↓
Explicit Install & Restart
```

Automatic download remains disabled.

## Stable release

```text
package version: 1.2.0
tag:             v1.2.0
channel:         latest
release type:    release
```

## Preview release

```text
package version: 1.3.0-beta.1
tag:             v1.3.0-beta.1
channel:         beta
release type:    prerelease
```

## Constraints

- Development builds do not self-update.
- Portable builds do not self-install.
- The Windows self-update target is NSIS.
- Public distribution should use a real Windows code-signing certificate.
- Installer, blockmap and update metadata must come from the same build.

See `docs/RELEASE-PROCESS.md`.
