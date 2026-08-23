# Performance Budget — GA

## Bundle budgets
Checked by `npm run ga:budget` after build:

| Surface | Maximum uncompressed output |
|---|---:|
| Renderer | 14 MiB |
| Main | 5 MiB |
| Preload | 3 MiB |

The Renderer budget intentionally accounts for Monaco and xterm.js while still detecting accidental large dependency/import regressions.

## Runtime budgets
- Resource inventory virtualization begins at 100 rows.
- Live Logs render flush: 100 ms.
- Docker Events render flush: 200 ms.
- Live log retention: configurable, bounded by Settings.
- Docker Event retention: 500 events.
- Stats history: 60 samples.
- Command Palette result cap: 40.
- Audit retention: bounded by Settings.
- Recovery snapshot retention: bounded by Settings.

## Performance principles
- Do not memoize blindly; optimize measured hot paths.
- Keep Docker process streaming outside Renderer.
- Cancel streams/PTYs on unmount.
- Do not render thousands of resource rows at once.
- Use deferred filtering for large lists.
- Lazy-load heavy workspace code.
- Keep Hugeicons imports explicit for tree shaking.

## Manual profiling before public GA
- [ ] React Profiler: Containers with 1,000 mock rows.
- [ ] React Profiler: Images with 1,000 mock rows.
- [ ] Live Logs: sustained high-throughput stream for 10 minutes.
- [ ] Live Stats: 30-minute container session.
- [ ] Compose Monaco editor memory after open/close cycles.
- [ ] xterm.js PTY open/close cycles.
- [ ] Electron process memory after 8-hour tray monitoring.
