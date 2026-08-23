# BuildKit Build History Diagnostics Modal

## Objective

Open Build History diagnostics in a modal instead of inserting an inline workspace between Build History and Build Cache.

## User Flow

```text
BuildKit
  ↓
Build History
  ↓
Diagnostics
  ↓
Build Diagnostics modal
```

The modal retains:

- Overview
- Logs
- Steps
- Cache
- Timing
- Error Analysis
- Copy ref
- Open in Docker Desktop
- Reload

## Why Modal

Build Diagnostics is detail for one Build History row rather than a separate BuildKit section.

The modal:

- keeps Build History context visible behind it;
- avoids pushing Build Cache far down the page;
- provides more vertical space for logs and steps;
- makes closing diagnostics explicit.

## Accessibility

The modal uses:

```text
role=dialog
aria-modal=true
```

Behavior:

- focus moves into the modal;
- Tab / Shift+Tab stay inside it;
- Escape closes it;
- clicking the backdrop closes it;
- closing restores previous focus.

## State

Opening a different build resets:

```text
tab = Overview
log search = empty
```

Diagnostics data itself still comes from the existing Buildx services.

## Safety

Diagnostics remains read-only.

The modal does not:

- rerun a build;
- change BuildKit cache;
- delete build history;
- modify the Dockerfile.

Prune operations remain separate confirmed BuildKit actions.

## Acceptance Criteria

- [x] Diagnostics opens in a modal.
- [x] Inline workspace is removed.
- [x] All six diagnostics tabs remain.
- [x] Buildx reload remains available.
- [x] Open in Docker Desktop remains available.
- [x] Copy ref remains available.
- [x] Escape closes the modal.
- [x] Focus is trapped and restored.
- [x] Opening another build resets to Overview.
