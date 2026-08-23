# GitHub Repository Setup

Target repository:

```text
https://github.com/mohikan1986/DockScope
```

## 1. Create repository

Create a repository named:

```text
DockScope
```

Recommended:

- Visibility: Public
- Initialize with README: **No** (the project already contains one)
- Add `.gitignore`: **No**
- License: **No** (the project already contains MIT `LICENSE`)

## 2. Push the prepared history

From the prepared working tree:

```bash
git remote add origin https://github.com/mohikan1986/DockScope.git
git push -u origin main
git push -u origin develop
```

## 3. Repository settings

### General

Enable:

- Issues
- Discussions (recommended)
- Preserve this repository (optional)

Merge options:

- Allow squash merging: **On**
- Default commit message: PR title
- Allow merge commits: **Off** for normal contribution flow
- Allow rebase merging: optional
- Automatically delete head branches: **On**

### Security

Enable:

- Private vulnerability reporting
- Dependabot alerts
- Dependabot security updates
- Secret scanning
- Push protection

### Actions

Workflow permissions:

```text
Read repository contents
Allow GitHub Actions to create/approve release assets through explicit workflow permissions
```

The release workflow declares `contents: write`.

## 4. Branch rules

Create a ruleset for:

```text
main
develop
```

Require:

- pull requests;
- 1 approval;
- resolved conversations;
- required status checks;
- no force push;
- no deletion.

Suggested required checks:

```text
Repository Policy / validate
Windows CI / verify
```

For `main`, prevent direct pushes.

## 5. Environments

Create:

```text
production
preview
```

Optional production protection:

- required reviewer before publishing a Stable release.

## 6. Secrets

For unsigned internal testing, no release PAT is required; `GITHUB_TOKEN` is provided by Actions.

For Windows signing, add:

```text
WINDOWS_CSC_LINK
WINDOWS_CSC_KEY_PASSWORD
```

## 7. First release

After `main` is ready:

```bash
git tag -a v1.0.0 -m "DockScope 1.0.0"
git push origin v1.0.0
```

The release workflow publishes GitHub Release assets and update metadata.
