# Smart Cleanup Planning by Target

## Objective

Replace a binary Safe/Balanced cleanup decision with a target-based planner.

Example:

```text
Target:
Reclaim at least 20 GB

Plan:
Build Cache       9.4 GB
Dangling Images   4.1 GB
Unused Images     8.2 GB
------------------------
Potential        21.7 GB
```

The planner selects only as many cleanup categories as needed to reach the requested target.

## Planning Model

Priority is risk-aware:

```text
1. Build Cache        Low risk
2. Dangling Images    Low risk
3. Stopped Containers Low risk
4. Unused Networks    Low risk, not counted toward byte target
5. Unused Images      Medium risk
```

Persistent Volumes are always excluded.

## Estimates

Docker's `system df --format json` provides reclaimable values for:

- Images
- Containers
- Local Volumes
- Build Cache

Dangling image size is estimated from:

```text
docker image ls --filter dangling=true --format json
```

Because image layers can be shared, dangling image size is an estimate rather than a guaranteed reclaim value.

To avoid double counting:

```text
Unused Images Additional
=
Docker Images Reclaimable
-
Dangling Images Estimate
```

The value is clamped at zero.

## Target Selection

Given a target `T`, the planner walks cleanup candidates in priority order.

For each category with meaningful estimated bytes:

```text
selected += category
```

until:

```text
selectedBytes >= targetBytes
```

If lower-risk categories already satisfy the target, broader cleanup is not selected.

## Unreachable Targets

If:

```text
Total Potential < Target
```

the plan reports:

- Total Potential
- Shortfall
- Maximum available selected plan

The user can still run the available plan, lower the target, inspect Volume Intelligence, or review VHDX usage.

Volumes are not automatically added just to satisfy the target.

## Execution

Selected steps are sent to Operation Task Center as:

```text
kind: smart-cleanup
cleanupSteps:
  - build-cache
  - dangling-images
  - ...
targetBytes: ...
```

Electron Main validates every cleanup step against an allowlist.

Supported task commands:

```text
build-cache
→ docker builder prune --force

dangling-images
→ docker image prune --force

stopped-containers
→ docker container prune --force

unused-networks
→ docker network prune --force

unused-images
→ docker image prune --all --force
```

No arbitrary command is accepted from Renderer.

## Safety

Smart Cleanup never executes:

```text
docker volume prune
```

Volumes remain protected by Volume Intelligence and its separate typed-confirmation flow.

The UI always warns that estimated and actual reclaimed bytes can differ due to shared Docker layers and changes between analysis and execution.

## Acceptance Criteria

- [x] User can enter a reclaim target in GB.
- [x] 5 / 10 / 20 / 50 GB presets are available.
- [x] Planner returns target, selected amount, potential, headroom/shortfall.
- [x] Lower-risk cleanup is selected before medium-risk unused images.
- [x] Only necessary categories are selected.
- [x] Dangling images have a separate estimate.
- [x] Unused Images does not double-count dangling-image estimate.
- [x] Unreachable target is clearly reported.
- [x] User can run the maximum available plan when target is unreachable.
- [x] Selected plan is queued through Operation Task Center.
- [x] Main validates selected cleanup steps against an allowlist.
- [x] Volumes are never included automatically.
- [x] In-page Cleanup Guide documents planning and estimate limitations.
