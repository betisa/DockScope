# M09 — Audit, Cleanup History & Recovery

## Objective
Provide durable traceability for destructive Docker operations and capture enough metadata before deletion to support manual recovery/reconstruction.

## Delivered
- Central audit engine in Electron Main
- Persistent audit history (up to 2,000 records)
- Persistent recovery metadata snapshots (up to 1,000 records)
- Container pre-delete snapshot with secret-masked environment
- Compose pre-down snapshot with service/network/volume metadata
- Image pre-delete metadata and history snapshot
- Volume metadata snapshot before deletion
- Audit wrapping for image/volume/network/build-cache cleanup, Safe/Balanced Cleanup and VHDX compaction
- Cleanup before/after reclaimable context
- Audit & Recovery UI with filters
- Exportable JSON audit report
- Snapshot viewer

## Important recovery boundary
Recovery snapshots are metadata, not backups. They do not preserve volume contents, deleted image layers, databases, uploads, object storage or files inside removed writable layers.

## Safety
- Secret-like environment keys are masked before persistence.
- No destructive operation is automatically reversed.
- Volume contents are never copied or exposed by the audit service.
- Audit export is user-initiated.
