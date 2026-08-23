# Git Workflow

DockScope uses a lightweight Git Flow optimized for a desktop application with Stable and Preview release channels.

## Long-lived branches

### `main`

- production history;
- every commit must be releasable;
- Stable releases are tagged from here;
- protected: no direct pushes.

### `develop`

- integration branch for the next release;
- feature/fix/refactor/docs/test PRs target this branch;
- protected: no direct pushes.

## Short-lived branches

| Prefix | Start from | PR target | Purpose |
|---|---|---|---|
| `feature/*` | `develop` | `develop` | New behavior |
| `fix/*` | `develop` | `develop` | Non-production bug fix |
| `refactor/*` | `develop` | `develop` | Internal restructuring |
| `docs/*` | `develop` | `develop` | Documentation |
| `test/*` | `develop` | `develop` | Test-only changes |
| `release/*` | `develop` | `main` | Stabilize a release |
| `hotfix/*` | `main` | `main` | Urgent production fix |

## Typical feature

```bash
git switch develop
git pull --ff-only
git switch -c feature/compose-diagnostics

# work
git add .
git commit -m "feat(compose): add service diagnostics modal"

git push -u origin feature/compose-diagnostics
```

Open PR:

```text
feature/compose-diagnostics → develop
```

After squash merge, delete the branch.

## Stable release

```text
develop
  ↓
release/1.2.0
  ↓ PR
main
  ↓
v1.2.0
```

Steps:

1. Create `release/1.2.0` from `develop`.
2. Change `package.json` version to `1.2.0`.
3. Update `CHANGELOG.md` and `build/release-notes.json`.
4. Run release verification.
5. PR `release/1.2.0` → `main`.
6. Squash/merge after required checks.
7. Tag the merge commit `v1.2.0`.
8. Push the tag; GitHub Actions publishes the release.
9. Merge/backport `main` into `develop`.

## Preview release

Use SemVer prerelease versions:

```text
1.3.0-beta.1
1.3.0-beta.2
```

Tag:

```text
v1.3.0-beta.1
```

GitHub Actions publishes these as `prerelease` with the `beta` update channel.

## Hotfix

```text
main
  ↓
hotfix/1.2.1
  ↓ PR
main
  ↓
v1.2.1
```

After release, merge/backport `main` into `develop`.

## Merge policy

Preferred merge method: **Squash merge**.

Why:

- target branches stay readable;
- each merged PR maps to one Conventional Commit;
- release notes can be derived from commit history;
- temporary fixup commits do not pollute `main`/`develop`.

Avoid merge commits for normal feature PRs.

## Conventional Commit format

```text
type(scope): summary
```

Examples:

```text
feat(images): merge intelligence into image workspace
fix(dashboard): restore container diagnostics deep-link
security(ai): encrypt provider API key with safeStorage
ci(release): publish stable artifacts to GitHub Releases
```

## Branch protection

Recommended rules for both `main` and `develop`:

- Require pull request before merging
- Require at least 1 approval
- Dismiss stale approvals
- Require conversation resolution
- Require status checks
- Require branch to be up to date
- Block force pushes
- Block branch deletion

For `main`, additionally:

- restrict direct pushes;
- require release CI to pass before tagging;
- do not bypass protections except for emergency recovery.

See `docs/GITHUB-SETUP.md`.
