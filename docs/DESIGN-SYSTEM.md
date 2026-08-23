# Design System Direction

Derived from the UI UX Pro Max guidance for developer tools.

- Product category: Developer Tool / IDE + dense operations dashboard
- Visual direction: dark-first, restrained Fluent-inspired surfaces, subtle glass only where useful
- Avoid: decorative gradients, excessive glow, emoji-as-icons, low-density marketing layouts
- Information density: compact tables with clear hierarchy and progressive detail drawers
- Accessibility:
  - visible keyboard focus
  - 4.5:1 normal text contrast target
  - status meaning never color-only
  - prefers-reduced-motion
  - responsive at 375 / 768 / 1024 / 1440 widths
  - long Docker IDs, paths and image names must wrap without layout breakage
- Destructive action hierarchy:
  - safe: direct action
  - low risk: confirmation
  - destructive: danger confirmation
  - persistent data/VHDX: typed confirmation
- Icon system: @hugeicons/react + @hugeicons/core-free-icons only
