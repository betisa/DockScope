# M06 — BuildKit & Image Intelligence

> **Current UX note:** Image Intelligence capabilities are now integrated into the Images page and open in a per-image analysis modal. The underlying M06 analysis services remain unchanged.

## Objective
Make Docker disk usage explainable by exposing builder/cache state and image-layer composition.

## Delivered
- Buildx builder inventory
- BuildKit disk-usage records
- Reclaimable-only cache view
- Safe and aggressive build-cache prune
- Image history/layer explorer
- Large-layer detection
- Optimization advisor heuristics for package managers, JS dependencies, .NET multi-stage builds and oversized layers

## Safety
- Build-cache prune never removes volumes.
- Aggressive prune requires confirmation.
- Image analysis is read-only.
- Renderer has no direct process/filesystem access.
