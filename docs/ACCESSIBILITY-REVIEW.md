# Accessibility Review — GA

## Keyboard
- [x] Primary navigation uses native buttons.
- [x] Command Palette opens with Ctrl+K / Ctrl+Shift+P.
- [x] Command Palette supports Arrow Up/Down, Enter and Escape.
- [x] Command Palette traps focus while open.
- [x] Closing Command Palette restores previous focus.
- [x] Skip-to-content link is present.
- [x] Visible `:focus-visible` outline is global.
- [x] Live console can receive keyboard focus.

## Semantics
- [x] Primary navigation has an accessible name.
- [x] Current navigation item exposes `aria-current=page`.
- [x] Docker Engine status uses status semantics.
- [x] Command Palette is a modal dialog/listbox.
- [x] Dynamic navigation/action results have an ARIA live region.
- [x] Tables keep native table semantics.
- [x] Hugeicons decorative/meaningful behavior is centralized.

## Visual resilience
- [x] Long paths, image names, IDs and badges reflow.
- [x] Reduced-motion preference is respected.
- [x] `prefers-contrast: more` receives stronger borders/text.
- [x] Windows forced-colors receives explicit border fallback.
- [x] Layout has 640 / 780 / 1080 / 1180 / 1280 responsive behavior.
- [x] High-DPI rendering receives reduced shadow/border noise.
- [ ] Manual Windows Narrator acceptance.
- [ ] Manual 200% Windows text/display scaling acceptance.

## Contrast
The palette uses semantic text/background tokens in both light and dark modes. Manual contrast verification remains in the release checklist because final contrast depends on the packaged Chromium rendering environment and Windows display configuration.
