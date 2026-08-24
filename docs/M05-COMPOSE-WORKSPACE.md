# M05 — Compose Workspace

## Objective

Turn Docker Compose management from a flat lifecycle table into a project-centric developer workspace.

## Delivered

### Project workspace
- Project cards and selected project workspace
- Overview / Services / Logs / Stats / Topology / Volumes / Networks / Compose / Environment tabs
- Project actions: Pull, Build, Up, Up + Build, Start, Stop, Restart, Down

### Service management
- Service inventory from `docker compose ps --all --format json`
- State / health / image / container / publisher information
- Per-service uptime based on Docker-reported start timestamps, plus the oldest running service uptime in the project overview
- Service-level Start / Stop / Restart
- Multi-service selection for logs and stats filters

### Runtime
- Aggregated `docker compose logs --follow`
- Service-filtered live logs
- `docker compose stats --format json` stream
- Cancellable UUID stream sessions reused from M04
- Stream cleanup when tabs/windows are closed

### Topology
- Resolved model from `docker compose config --format json`
- Services and declared `depends_on` relationships
- Declared networks and volumes
- Resolved environment viewer with secret masking

### Compose editor
- Monaco Editor for YAML
- Monaco Diff Editor before save
- `docker compose config --quiet` validation
- Unsaved-content validation using a temporary Compose file in the same project directory
- Guarded write limited to files already declared by the Compose project
- Optimistic concurrency: refuses to overwrite a file changed externally since load
- Automatic `.dsm.bak` backup before save
- Redeploy action after editing

## Safety properties

- Renderer never accesses Node.js filesystem or `child_process` directly.
- Compose writes run in Electron Main through typed IPC.
- Arbitrary file paths are rejected; editor writes are restricted to project config files.
- Validation occurs before save.
- External modifications cause save refusal rather than silent overwrite.
- `docker compose down --volumes` is not part of ordinary workspace actions.

## Acceptance criteria

- [x] Project workspace replaces the old flat Compose action table.
- [x] Project and service lifecycle operations are distinct.
- [x] Live Compose logs can be cancelled without orphan processes.
- [x] Live Compose stats can be cancelled without orphan processes.
- [x] Topology uses the canonical resolved Compose model.
- [x] Environment values mask likely secrets by default.
- [x] Compose YAML can be edited with Monaco.
- [x] Validation occurs against unsaved YAML before save.
- [x] Diff can be reviewed before save.
- [x] Save refuses stale/external modifications.
- [x] Backup is created before replacing the Compose file.
- [x] Persistent volumes remain outside the normal Down path.
