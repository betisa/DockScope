# Release Checklist

## Dependency reproducibility
- [ ] Generate and commit `package-lock.json` from the approved Windows/Node 22 environment
- [ ] After lockfile is committed, switch CI dependency install from `npm install` to `npm ci`

## Quality gates
- [ ] `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm run test:coverage`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] No unreviewed critical/high security findings

## Windows validation
- [ ] Windows 11 + Docker Desktop WSL2
- [ ] Docker Engine unavailable startup
- [ ] Docker Desktop restart
- [ ] Container logs/stats/terminal
- [ ] Compose workspace
- [ ] Safe Cleanup
- [ ] VHDX analyze
- [ ] VHDX compact as Administrator
- [ ] Notification center
- [ ] Tray close/reopen behavior
- [ ] Light/dark mode
- [ ] 125%, 150%, 200% display scaling

## Packaging
- [ ] NSIS installer generated
- [ ] Portable EXE generated
- [ ] Install/uninstall smoke test
- [ ] Portable launch test
- [ ] Native `node-pty` loads after packaging
- [ ] Artifact names contain version and architecture

## Signing
- [ ] Configure Windows code-signing certificate
- [ ] Sign installer
- [ ] Sign portable executable
- [ ] Verify Authenticode chain

## Release
- [ ] Update changelog
- [ ] Tag release
- [ ] Attach SHA-256 checksums
- [ ] Publish known issues

## M11 Settings validation
- [ ] Settings/profile migration from missing/partial JSON
- [ ] Docker Context change applies without app restart
- [ ] Custom Docker CLI path smoke test
- [ ] Start-with-Windows packaged test
- [ ] Start-minimized + close-to-tray test
- [ ] Development/Conservative/CI-Build Heavy/Low Disk Space profile smoke tests
- [ ] Custom VHDX path discovery test
