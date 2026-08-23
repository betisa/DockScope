# Container File Browser

## Objective

Add a guarded filesystem workspace inside **Container Workspace → Files**.

Supported operations:

- Browse directories
- View UTF-8 text
- Download files
- Upload files
- Copy container paths
- Guarded text overwrite

## Security Boundary

Renderer never receives Node.js filesystem access.

```text
Renderer
  ↓ typed Preload API
IPC
  ↓ validates container ID + absolute container path
Electron Main
  ↓
Docker CLI / System Open-Save Dialog
```

Before write operations, Main resolves the requested container target with `readlink -f` and evaluates mount risk against the canonical path. This prevents a symlinked path from bypassing read-only/persistent-mount safeguards.

Container paths must:

- be absolute;
- contain no null bytes;
- stay under 2048 characters;
- contain no `..` parent-traversal segment.

## Directory Browse

Directory listing uses a fixed shell script executed through:

```text
docker container exec -e DSM_PATH=<validated path> <container> sh -c <fixed script>
```

The requested path is passed as an environment variable rather than interpolated into shell source.

The script reports:

- file name;
- type;
- size;
- permissions;
- owner/group;
- modification time;
- symlink target.

Directories are shown before other entries.

### Runtime Requirement

Directory enumeration requires a running Linux container with `sh` and basic POSIX utilities.

The UI reports this limitation when the container is stopped.

## Text Viewer

Regular files can be previewed as UTF-8 text.

Limit:

```text
1 MB preview
```

If a file exceeds that limit:

- only the first 1 MB is displayed;
- the UI marks the preview as truncated;
- editing is disabled.

This prevents accidentally overwriting unseen content from a partial preview.

## Download

Download flow:

```text
Files → Download
  ↓
Main-owned Save Dialog
  ↓
docker cp container:/path <selected host destination>
```

Renderer does not submit a host output path.

Downloads are audit-recorded.

## Upload

Upload flow:

```text
Files → Upload
  ↓
Main-owned Open File Dialog
  ↓
Validate local file
  ↓
Mount/write-risk check
  ↓
Main-owned warning confirmation
  ↓
docker cp <selected file> container:/destination/file
```

Safety constraints:

- regular files only;
- 100 MB maximum;
- read-only mounts are blocked;
- existing files may be overwritten only after explicit confirmation;
- persistent mount writes are classified as critical audit severity;
- container writable-layer writes are classified as warning severity.

## Guarded Text Save

Text editing is available only when:

- preview is not truncated;
- path is not inside a read-only mount;
- content size is at most 1 MB.

Save flow:

```text
Edited Renderer text
  ↓
IPC validates path and size
  ↓
Main determines mount persistence risk
  ↓
Main warning confirmation
  ↓
temporary UTF-8 file in OS temp directory
  ↓
docker cp temp file container:/target
  ↓
temporary directory removed
```

The existing container file is fully replaced.

## Mount Awareness

The browser compares the current path against Docker inspect Mounts.

Three states are surfaced:

### Container Layer

The path is not under a Docker mount.

Warning:

```text
Changes may disappear when the container is recreated.
```

### Read/Write Mount

The path is under a writable bind mount or volume.

Warning:

```text
Changes can modify persistent application data.
```

### Read-Only Mount

The path is under a read-only mount.

Upload and Save Text are blocked.

## Audit

The following operations create Audit entries:

- Download container file
- Upload container file
- Write container text file

Audit command summaries intentionally mask host-side file paths as placeholders.

## Non-goals

This feature does not provide:

- recursive directory download;
- recursive directory upload;
- chmod/chown;
- delete;
- rename;
- symlink creation;
- arbitrary shell execution;
- binary hex editing.

Those operations would increase destructive risk and are intentionally excluded from the first implementation.

## Acceptance Criteria

- [x] Files tab exists in Container Workspace.
- [x] Directory browse supports absolute paths and breadcrumbs.
- [x] File metadata is shown.
- [x] Text preview supports regular files.
- [x] Preview is limited to 1 MB.
- [x] Truncated previews cannot be saved.
- [x] Copy Path is available.
- [x] Download uses Main-owned Save Dialog.
- [x] Upload uses Main-owned Open Dialog.
- [x] Upload is limited to regular files ≤ 100 MB.
- [x] Upload requires confirmation.
- [x] Text overwrite requires confirmation.
- [x] Read-only mounts block writes.
- [x] Read/write mounts surface persistent-data risk.
- [x] Container-layer writes surface ephemeral-data warning.
- [x] Container path traversal is rejected.
- [x] File transfer/write operations are audited.
