# Security Review

## Electron boundary
- [x] `nodeIntegration: false`
- [x] `contextIsolation: true`
- [x] renderer sandbox enabled
- [x] Renderer does not receive `child_process`
- [x] Renderer does not receive unrestricted filesystem APIs
- [x] External window creation denied
- [x] External HTTPS links opened with the system browser
- [x] IPC methods are explicitly enumerated in preload
- [x] Docker identifiers validated before commands
- [x] Persistent-data operations require explicit confirmation
- [x] Audit snapshots mask secret-like environment keys
- [x] Monitoring never triggers cleanup automatically

## Packaging
- [x] ASAR enabled
- [x] `node-pty` explicitly unpacked
- [x] package is marked private
- [x] installer and portable targets are explicit
- [ ] Production code-signing certificate configured
- [ ] Publisher identity configured
- [ ] Signed installer verification executed on release host

## Remaining pre-GA items
Code signing is intentionally not fabricated. A real organization/publisher certificate must be supplied by the release owner before public distribution.
