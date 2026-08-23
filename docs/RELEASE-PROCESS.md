# Release Process

DockScope releases are built by GitHub Actions and published to GitHub Releases.

## Update channels

| Product channel | electron-updater channel | Version example | GitHub release type |
|---|---|---|---|
| Stable | `latest` | `1.2.0` | Release |
| Preview | `beta` | `1.3.0-beta.1` | Prerelease |

Preview users can receive Preview plus newer Stable releases. Stable users receive Stable only.

## Why GitHub Releases

`electron-builder` publishes:

- NSIS installer
- blockmap
- auto-update metadata such as `latest.yml` / channel metadata
- release assets

The installed app reads the GitHub provider from the generated `resources/app-update.yml`. Application code does not accept an arbitrary feed URL.

## Prepare release

1. Ensure `develop` CI is green.
2. Create `release/<version>`.
3. Update `package.json`.
4. Update `CHANGELOG.md`.
5. Update `build/release-notes.json`.
6. Run:

```powershell
npm run repo:check
npm run release:verify
npm run test:e2e
```

7. PR the release branch to `main`.
8. Merge only after review/checks.

## Tag

Stable:

```bash
git switch main
git pull --ff-only
git tag -a v1.2.0 -m "DockScope 1.2.0"
git push origin v1.2.0
```

Preview:

```bash
git tag -a v1.3.0-beta.1 -m "DockScope 1.3.0 beta 1"
git push origin v1.3.0-beta.1
```

The release workflow verifies that the tag exactly matches `package.json`.

## GitHub Actions permissions

The release workflow uses the repository-provided `GITHUB_TOKEN` with:

```yaml
permissions:
  contents: write
```

No PAT should be committed.

## Windows code signing

Public distribution should be code-signed.

Recommended repository secrets:

```text
WINDOWS_CSC_LINK
WINDOWS_CSC_KEY_PASSWORD
```

Never commit certificate material.

Until a real signing certificate is configured, releases are technically publishable but Windows SmartScreen trust will be weaker. Treat signing as a release-readiness requirement for broad public distribution.

## Auto-update test

Before announcing a release:

1. Install the previous NSIS version.
2. Open **About & Updates**.
3. Select Stable or Preview.
4. Check for updates.
5. Download.
6. Verify progress.
7. Install & Restart.
8. Confirm the new version.
9. Repeat for Preview if publishing beta.

Do not validate update behavior with Portable builds; self-install is intentionally disabled there.

## Rollback

Do not overwrite an existing GitHub release asset with a different binary under the same version.

If a release is broken:

1. stop promoting it;
2. publish a higher patch version;
3. document the regression;
4. never mutate the checksum/installer pairing for an already-published version.
