# SQLite Persistence with Knex.js

## Objective

DockScope no longer stores application state in JSON files or new Renderer `localStorage` writes.

Persistent application data is stored in one SQLite database managed by **Knex.js** in Electron Main:

```text
Electron userData/
└── dockscope.sqlite3
```

Renderer never opens SQLite directly.

## Dependencies

```json
{
  "knex": "3.3.0",
  "better-sqlite3": "13.0.3"
}
```

Knex uses:

```ts
client: 'better-sqlite3'
```

`better-sqlite3` is included in `asarUnpack` because it contains a native Node addon and must be rebuilt for the Electron ABI during installation/package preparation.

## SQLite Runtime Configuration

Each connection is configured with:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
```

The pool is intentionally bounded to a single SQLite connection:

```text
min: 1
max: 1
```

## Tables

### app_state

Key/value JSON state used for:

- Application Settings
- Monitoring Settings
- Dashboard layout
- Productivity favorites
- Productivity recents
- Productivity command history
- Future bounded UI/application preferences

Columns:

```text
key
payload
updated_at
```

### audit_entries

Persistent Audit history.

Indexed by:

- completed_at
- severity
- status

### recovery_snapshots

Recovery metadata snapshots.

Indexed by:

- created_at
- resource_type

### operation_tasks

Operation Task Center history.

Indexed by:

- created_at
- status
- kind

Task output updates use a per-task SQLite UPSERT rather than rewriting the full history.

### storage_trends

Historical Storage Trend samples.

Indexed by:

- captured_at

Also stores numeric:

- docker_allocated_bytes
- vhdx_bytes

for future SQL analytics without reparsing JSON.

### operational_notifications

Operational Intelligence notifications.

Indexed by:

- created_at
- severity
- read

### legacy_imports

Records one-time migration of legacy persistent JSON files.

## Legacy Migration

On first startup after upgrading, existing JSON data is imported automatically.

Supported legacy files:

```text
application-settings.json
monitoring-settings.json
notifications.json
audit-history.json
recovery-snapshots.json
operation-tasks.json
storage-trends.json
```

Migration flow:

```text
SQLite table/state check
      ↓
Legacy JSON exists?
      ↓ yes
Parse
      ↓
Insert into SQLite
      ↓
Record legacy_imports row
      ↓
Delete legacy JSON file
```

If the legacy file does not exist, the import is still marked complete so the application does not repeatedly probe for it.

## Renderer localStorage Migration

Persistent Renderer state from older releases is migrated through the typed `preferences` IPC API.

Legacy keys:

```text
dsm.dashboard.layout.v1
dsm.m08.favorites
dsm.m08.recents
dsm.m08.history
```

New SQLite-backed keys:

```text
ui.dashboard.layout.v1
ui.productivity.favorites
ui.productivity.recents
ui.productivity.history
```

Flow:

```text
Renderer asks Main SQLite for preference
      ↓
No DB row
      ↓
Read legacy localStorage once
      ↓
Write through preferences IPC to SQLite
      ↓
Remove legacy localStorage key
```

There are no new `localStorage.setItem(...)` calls.

## UI Preferences IPC

Renderer uses:

```text
preferences.get(key)
preferences.set(key, value)
preferences.remove(key)
```

Main validates:

```text
key prefix: ui.
allowed key characters
maximum key length
maximum serialized payload: 500 KB
```

Renderer cannot provide SQL.

## Persistence Boundaries

The following filesystem writes remain intentionally because they are not application state persistence:

- User-requested Audit report export
- User-requested Diagnostics Bundle ZIP
- User-requested Compose file save
- Temporary Compose validation files
- Temporary guarded Container File Browser text upload
- Temporary Windows/VHDX helper script

These are exports, source-file mutations requested by the user, or short-lived temporary files.

## Security

The persistence boundary remains:

```text
React Renderer
     ↓
Typed Preload
     ↓
Validated IPC
     ↓
Electron Main
     ↓
Knex
     ↓
SQLite
```

No SQLite/native driver is exposed to the Renderer.

## Packaging

Because `better-sqlite3` is native:

```json
"asarUnpack": [
  "node_modules/node-pty/**/*",
  "node_modules/better-sqlite3/**/*"
]
```

The existing:

```text
electron-builder install-app-deps
```

postinstall step rebuilds native app dependencies for the installed Electron version.

On Windows, Visual Studio Build Tools / MSVC may be required if a matching prebuilt native binary is unavailable.

## Acceptance Criteria

- [x] Knex.js is the only application query/schema layer.
- [x] SQLite uses Better-SQLite3.
- [x] Database lives under Electron userData.
- [x] WAL mode is enabled.
- [x] Foreign keys are enabled.
- [x] Busy timeout is configured.
- [x] Application Settings are stored in SQLite.
- [x] Monitoring Settings are stored in SQLite.
- [x] Notifications are stored in SQLite.
- [x] Audit history is stored in SQLite.
- [x] Recovery snapshots are stored in SQLite.
- [x] Operation tasks are stored in SQLite.
- [x] Storage Trends are stored in SQLite.
- [x] Dashboard layout is stored in SQLite.
- [x] Productivity favorites/recents/history are stored in SQLite.
- [x] Legacy JSON files are imported and removed.
- [x] Legacy localStorage is migrated and removed.
- [x] No new persistent `localStorage.setItem` usage remains.
- [x] Renderer has no direct SQLite access.
