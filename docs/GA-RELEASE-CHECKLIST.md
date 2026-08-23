# DockScope 1.0 — GA Release Checklist

## Automated gate
- [ ] `npm install`
- [ ] Commit generated `package-lock.json`
- [ ] Switch Windows CI dependency install to `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm run test:coverage`
- [ ] `npm run build`
- [ ] `npm run ga:budget`
- [ ] `npm run test:e2e`
- [ ] `npm run package:win`

## UX / accessibility
- [ ] 100% keyboard path through primary navigation.
- [ ] Command Palette focus trap verified.
- [ ] Narrator smoke test.
- [ ] Dark / Light / System mode.
- [ ] Windows forced-colors.
- [ ] 125%, 150%, 175%, 200% display scaling.
- [ ] 1024px minimum supported desktop width.
- [ ] Long Container/Image/Volume/Path strings.

## Performance
- [ ] 1,000 Container mock rows.
- [ ] 1,000 Image mock rows.
- [ ] 10-minute log burst test.
- [ ] 30-minute Live Stats test.
- [ ] Repeated Terminal open/close test.
- [ ] Repeated Monaco open/close test.
- [ ] 8-hour tray monitoring soak test.

## Docker acceptance
- [ ] Docker Desktop running.
- [ ] Docker Desktop unavailable startup.
- [ ] Start/stop/restart Container.
- [ ] Live Logs and Stats.
- [ ] Terminal / ConPTY.
- [ ] Health / Ports / Mounts / Networks / Environment.
- [ ] Compose Workspace.
- [ ] Compose validation and guarded save.
- [ ] BuildKit / cache analysis.
- [ ] Images + integrated Image Intelligence modal.
- [ ] Safe Cleanup.
- [ ] Audit / Recovery snapshot.
- [ ] Notifications and Tray.
- [ ] Custom Docker Context.
- [ ] Custom VHDX path.
- [ ] VHDX compaction as Administrator.

## Packaging
- [ ] NSIS install.
- [ ] NSIS uninstall.
- [ ] Portable EXE launch.
- [ ] `node-pty` loads from packaged ASAR-unpacked location.
- [ ] Monaco loads in packaged build.
- [ ] xterm.js loads in packaged build.
- [ ] Version shows 1.0.0.
- [ ] SHA-256 checksums produced.

## Signing
- [ ] Real organization code-signing certificate configured.
- [ ] Installer signed.
- [ ] Portable executable signed.
- [ ] Authenticode verified on a clean Windows machine.
- [ ] SmartScreen reputation plan documented.

## Release
- [ ] `CHANGELOG.md` reviewed.
- [ ] GA release notes reviewed.
- [ ] Known limitations published.
- [ ] Git tag `v1.0.0`.
- [ ] Windows artifacts attached to release.
