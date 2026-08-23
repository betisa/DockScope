# Unified Images & Image Intelligence

## Objective

Merge the previously separate **Images** and **Image Intelligence** experiences into one operational workspace.

The Images page is now the canonical location for:

- image inventory;
- repository/tag/ID/age/size search;
- dangling/unused image cleanup;
- per-image removal;
- layer-history inspection;
- optimization analysis;
- deep links from Resource Graph and Command Palette.

## User Flow

```text
Images
  ↓
Select Analyze on an image
  ↓
Image Intelligence modal
  ├── summary
  ├── optimization advisor
  ├── largest layer command
  ├── recommendations
  └── searchable/paginated layer history
```

The inventory remains visible behind the modal, preserving context.

## Standalone Page Removal

The standalone navigation item and route:

```text
Image Intelligence
```

are removed.

`PageId` no longer contains:

```text
image-intelligence
```

The old `ImageIntelligencePage.tsx` is removed.

## Modal Analysis

The modal loads in parallel:

```text
imageInsights.history(image.id)
imageInsights.analyze(image.id)
```

The analysis displays:

- total image size;
- total layer count;
- largest layer size;
- large-layer count;
- recommendation count;
- largest-layer command;
- optimization recommendations;
- layer ID;
- layer age;
- layer size;
- `CreatedBy`;
- layer comment.

Layer search/pagination remains bounded to 10 rows per page.

## Deep Links

### Command Palette

Image resources now target:

```text
page: images
resourceId: <image id>
resourceName: <repository:tag>
```

### Resource Graph

Image nodes now navigate to:

```text
Images
```

and write an image intent.

### Images Intent Consumption

When Images loads it checks:

```text
dsm.m08.intent
```

If the intent references an image, the matching row is resolved by:

1. image ID;
2. repository:tag fallback.

The Image Intelligence modal opens automatically.

## Accessibility

The modal:

- uses `role="dialog"`;
- sets `aria-modal="true"`;
- moves focus to the Close button;
- traps Tab / Shift+Tab;
- closes with Escape;
- restores previous focus;
- supports backdrop close.

## Safety

Image Intelligence remains read-only.

It never:

- removes an image;
- prunes images;
- modifies Dockerfiles;
- runs builds.

Removal remains a separate Images action with explicit confirmation.

## Interpretation

Image recommendations are heuristic.

Docker `image history` / `CreatedBy` metadata:

- is useful for layer analysis;
- does not guarantee reconstruction of the original Dockerfile;
- may include generated/intermediate command text.

## Acceptance Criteria

- [x] Images and Image Intelligence share one page.
- [x] Standalone Image Intelligence navigation is removed.
- [x] Standalone route is removed.
- [x] Old page component is removed.
- [x] Analyze action exists per image row.
- [x] Analysis opens in modal.
- [x] History + insight load together.
- [x] Layer search/pagination is retained.
- [x] Optimization recommendations are retained.
- [x] Resource Graph image deep-link opens Images modal.
- [x] Command Palette image deep-link opens Images modal.
- [x] Modal is keyboard accessible.
- [x] Image removal remains separately confirmed.
