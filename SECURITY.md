# Security Policy

## Supported versions

Security fixes are provided for the latest Stable release and, when practical, the current Preview release.

## Reporting a vulnerability

Do **not** open a public GitHub issue for a vulnerability that could expose credentials, enable arbitrary command execution, bypass destructive-operation confirmation, or escape the Electron privilege boundary.

Preferred reporting method:

1. Use GitHub **Private Vulnerability Reporting** after it is enabled in repository settings.
2. Include affected version, reproduction steps, impact, and a minimal proof of concept.
3. Do not include real secrets or personal data.

If Private Vulnerability Reporting is not enabled yet, contact the repository owner privately through the contact method on the GitHub profile.

## Security model

High-risk boundaries include:

- Electron Main / Preload IPC
- Docker and Compose command construction
- filesystem access
- `node-pty`
- updater/install flow
- SQLite secret persistence
- AI provider API keys and diagnostic evidence
- VHDX / WSL operations

Please read `docs/SECURITY-REVIEW.md` before modifying these areas.

## Disclosure

Please allow maintainers reasonable time to investigate and prepare a fix before public disclosure.
