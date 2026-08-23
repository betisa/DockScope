# M08 — Command Palette, Global Search & Productivity

## Objective
Make DockScope keyboard-first and reduce navigation/action latency for daily developer workflows.

## Delivered
- Global Command Palette: `Ctrl+K` and `Ctrl+Shift+P`
- Fuzzy search across pages, containers, Compose projects and images
- Quick actions from the palette
- Container start / stop / restart commands
- Container Logs deep-link into Runtime & Diagnostics
- Safe Cleanup quick action
- Build Cache prune quick action
- Operational Health refresh quick action
- Recent Resources
- Favorite / pinned palette entries
- Productivity workspace
- Local Action History for commands launched from the palette
- Deep-link intent for Container, Compose and Images/Image Intelligence modal workspaces
- Keyboard navigation: Up / Down / Enter / Esc
- M07 `notifications` route typing inconsistency fixed

## Safety
- Palette actions call only existing typed `window.dockerApi` APIs.
- No Docker CLI, filesystem or Node API is exposed to the Renderer.
- Stop and cleanup operations retain explicit confirmation.
- Volume deletion and VHDX compaction are not offered as one-keystroke palette actions.
- Action History stores summaries only and does not persist environment secrets.

## Persistence
M08 productivity data uses local application storage for:
- pinned item IDs
- recent resources
- the last 100 palette action results

This data is UI metadata only; Docker credentials and environment-variable values are not persisted.

## Acceptance Criteria
- `Ctrl+K` opens the palette from any app page.
- Search can locate a container, Compose project, image or page.
- Keyboard-only selection and execution work.
- `logs <container>` opens the matching container workspace on Logs.
- Favorite entries rank ahead of equivalent non-favorites.
- Recent Resources are updated after opening palette resources.
- Quick actions write success/failure entries to Action History.
- Safe Cleanup continues to exclude volumes.
