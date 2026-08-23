# Colored Workspace Logs

Container Workspace and Compose Workspace live logs now use a shared colored log renderer.

## Highlighting

- ERROR / ERR / FATAL / CRITICAL / PANIC
- WARN / WARNING
- INFO / NOTICE
- DEBUG / DBG
- TRACE / TRC / VERBOSE
- timestamps
- `[stderr]`
- exception / traceback / caused-by markers
- HTTP status codes
- Docker Compose service/container prefixes

Compose prefixes use a deterministic hash bucket so the same service name keeps the same visual identity during the current UI.

## Safety

Log text is rendered as React text nodes. No `innerHTML` or `dangerouslySetInnerHTML` is used, so ANSI/log text cannot inject HTML into the Renderer.

## Existing behavior retained

- streaming
- pause/resume
- auto-scroll
- clear
- filtering
- Regex filtering in Container Workspace
- bounded retained lines
- Escape stream stop

Color is not the only signal: error/warning/info lines also use borders, typography and a compact legend.
