# In-App Page Guides

Every top-level DockScope page exposes contextual help directly from its page header.

## Access

Use the **Guide** button next to the page title.

The guide opens as a right-side drawer without navigating away from the current resource or workspace.

## Guide coverage

| Page | Guide focus |
|---|---|
| Dashboard | Engine/context checks, charts, storage triage |
| Notifications | Operational alerts and monitoring behavior |
| Activity | Docker daemon event stream |
| Productivity | Recents, Command Palette, local action history |
| Audit & Recovery | Audit records, metadata snapshots, backup limitation |
| Containers | Lifecycle, Logs, Stats, Health, Ports, Mounts, Networks, Terminal |
| Compose | Project operations, service diagnostics, guarded YAML editing |
| Images & Image Intelligence | Inventory and prune/remove safety |
| BuildKit | Builders, real Buildx History fields, steps/cache, prune |
| Volumes | Created time, disk usage, references, persistent-data warnings |
| Networks | Inventory, prune behavior, connectivity troubleshooting |
| Cleanup Advisor | Risk model, Safe/Balanced workflow, volume exclusion |
| VHDX Manager | When and how to compact Docker Desktop VHDX |
| Settings | Profiles plus every configuration section |

## Interaction

The guide drawer:
- uses `role="dialog"` and `aria-modal="true"`;
- moves keyboard focus into the guide when opened;
- traps `Tab` / `Shift+Tab` inside the drawer;
- closes with `Esc`;
- restores focus to the previous control when closed;
- closes when the backdrop is clicked;
- supports responsive full-width layout on narrow windows.

## Content structure

Each page guide contains:
1. a concise page purpose;
2. task-oriented sections;
3. recommended workflows;
4. safety notes where relevant;
5. keyboard shortcuts when useful.

Guide content is defined centrally in:

```text
src/renderer/src/pageGuides.ts
```

The access button is provided by the shared:

```text
src/renderer/src/components/PageTitle.tsx
```

and the drawer UI by:

```text
src/renderer/src/components/PageGuideDrawer.tsx
```
