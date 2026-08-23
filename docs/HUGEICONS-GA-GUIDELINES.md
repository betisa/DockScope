# Hugeicons React — GA Guidelines

DockScope uses:
- `@hugeicons/react`
- `@hugeicons/core-free-icons`

## Rules
1. Import individual icons; never wildcard-import the icon package.
2. Render all application icons through `AppIcon`.
3. Use `currentColor` so icons inherit theme/semantic state.
4. Decorative icons are `aria-hidden`.
5. Meaningful standalone icons receive a wrapper label.
6. Do not use emoji as icon substitutes.
7. Keep stroke weight consistent through the wrapper.
8. Prefer text + icon for destructive or operational actions where clarity is more important than density.

## M12 examples
- Search
- Refresh
- Pause / Resume
- Clear / Delete
- Notifications
- Navigation
- Error recovery
