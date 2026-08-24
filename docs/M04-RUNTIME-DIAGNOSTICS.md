# M04 — Runtime & Diagnostics

Status: Implemented

## Objectives

- cancellable, owner-scoped streaming IPC
- live container logs with search, regex, pause and auto-scroll
- live container stats with bounded history and sparklines
- xterm.js interactive terminal backed by node-pty / Windows ConPTY
- multi-tab container diagnostics workspace
- process viewer
- health status and recent health-check output
- ports, mounts, networks and environment viewers
- secret-aware environment masking
- raw inspect viewer
- real-time Docker Events activity page
- automatic stream / PTY cleanup when views or windows close
- container inventory includes Docker-reported start timestamps so running-container uptime can update live in the renderer

## Safety / architecture

- renderer has no Node.js access
- stream and PTY processes live in Electron Main
- every session has an owner WebContents ID
- renderer receives opaque UUID session IDs
- session close requests are owner checked
- all live sessions are terminated when the owning WebContents is destroyed
- environment values are not persisted; likely secrets are masked by default

## Acceptance evidence

- `docker logs --follow` is launched as a cancellable stream.
- `docker stats --format {{json .}}` supplies live JSON-lines samples.
- `docker events --format {{json .}}` supplies daemon activity.
- terminal uses `docker container exec -it` through a PTY.
- tab unmount stops the associated stream or PTY.
- Escape stops live logs/stats/events streams.
