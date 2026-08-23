# Dependency Baseline — GA

Verified during M12:

- Electron: `43.4.0`
- React: `19.2.8`
- React DOM: `19.2.8`
- electron-vite: `5.0.0`
- Vite: `7.3.6`
- `@hugeicons/react`: `1.1.9`
- `@hugeicons/core-free-icons`: `4.2.3`

## Rationale

Electron 43.4.0 is the current stable Electron package at the M12 review date.

React/React DOM were updated from 19.2.7 to the current 19.2.8 patch for the GA candidate.

The project intentionally remains on Vite 7.3.6 while using stable electron-vite 5.0.0. Vite 8 is newer, but moving the desktop toolchain to the electron-vite 6 beta line is not appropriate during a GA hardening milestone.

Hugeicons packages are already on their current stable versions and keep explicit tree-shakeable imports.
