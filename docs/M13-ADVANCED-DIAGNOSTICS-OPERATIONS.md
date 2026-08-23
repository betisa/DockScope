# M13 — Advanced Diagnostics & Operations

## Goal

Evolve DockScope from a resource-management UI into a Docker troubleshooting workbench.

## Planned tasks

| Task | Capability | Status |
|---|---|---|
| P13.01 | Build Diagnostics Workspace | ✅ Implemented |
| P13.02 | Container Diagnostics Advisor | Planned |
| P13.03 | Port Explorer | Planned |
| P13.04 | Volume Intelligence | Planned |
| P13.05 | Resource Dependency Graph | Planned |
| P13.06 | Operation Task Center | Planned |
| P13.07 | Diagnostics Bundle Export | Planned |
| P13.08 | Storage Trends | Planned |
| P13.09 | Dashboard Customization | Planned |
| P13.10 | Security / Performance / Milestone Review | Planned |

## M13 success criteria

- Diagnostic features must cite observable runtime evidence.
- Renderer privilege boundaries remain unchanged.
- Destructive automation requires preview/confirmation.
- High-volume diagnostics remain bounded and performant.
- Every new top-level or workspace capability includes contextual user guidance.


## P13.03 — Port Explorer

Implemented global published-port inventory, Compose ownership, exposure classification, conflict detection, copy/open actions, search/pagination, and resource deep links. See [P13.03-PORT-EXPLORER.md](./P13.03-PORT-EXPLORER.md).


## P13.04 — Volume Intelligence

Implemented volume ownership correlation, Compose relationships, mount destinations, labels/options, workload detection, conservative risk scoring, backup guidance, filters, and a detail workspace. See [P13.04-VOLUME-INTELLIGENCE.md](./P13.04-VOLUME-INTELLIGENCE.md).


## P13.05 — Resource Dependency Graph

Implemented global Compose/container/image/volume/network/port topology with shared-resource detection, search, type filtering, focused neighborhoods, details, and resource deep links. See [P13.05-RESOURCE-DEPENDENCY-GRAPH.md](./P13.05-RESOURCE-DEPENDENCY-GRAPH.md).


## P13.06 — Operation Task Center

Implemented persistent Main-process task execution, live output/progress, cancellation, bounded/redacted history and migration of long-running Compose, BuildKit, Cleanup and VHDX actions into Task Center. See [P13.06-OPERATION-TASK-CENTER.md](./P13.06-OPERATION-TASK-CENTER.md).


## P13.07 — Diagnostics Bundle Export

Implemented redacted support ZIP export with independent collectors, manifest, bounded container log/diagnostic capture, Docker/BuildKit/Volume/Graph/Monitoring/Task/Audit metadata, and Main-owned Save Dialog. See [P13.07-DIAGNOSTICS-BUNDLE-EXPORT.md](./P13.07-DIAGNOSTICS-BUNDLE-EXPORT.md).


## P13.08 — Storage Trends

Implemented bounded local storage sampling with 24h/7d/30d history, Docker allocation/VHDX comparison, composition trends, growth/peak analysis, manual sample capture and Diagnostics Bundle integration. See [P13.08-STORAGE-TRENDS.md](./P13.08-STORAGE-TRENDS.md).


## P13.09 — Dashboard Customization

Implemented persistent widget visibility/order/density, drag-and-drop plus accessible reorder controls, reset behavior, and new operational widgets for unhealthy containers, Buildx history, top volumes and recent alerts. See [P13.09-DASHBOARD-CUSTOMIZATION.md](./P13.09-DASHBOARD-CUSTOMIZATION.md).
