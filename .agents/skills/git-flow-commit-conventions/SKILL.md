---
name: git-flow-commit-conventions
description: Apply DockScope Git Flow and Conventional Commit rules to every repository task, including branch selection, commit validation, and PR handoff.
---

# Git Flow and commit conventions

Apply this skill to every task in the DockScope repository that inspects, changes, commits, or hands off repository work.

## Start every task

1. Inspect the working tree and branch with `git status --short --branch` before editing. Preserve existing user changes; do not reset, clean, stash, or switch away from them automatically.
2. Treat `main` and `develop` as protected branches. Do not make ordinary task changes directly on either branch.
3. Select a short-lived branch with the correct base and PR target:

   | Branch | Base | PR target | Use for |
   |---|---|---|---|
   | `feature/*` | `develop` | `develop` | New behavior |
   | `fix/*` | `develop` | `develop` | Non-production bug fixes |
   | `refactor/*` | `develop` | `develop` | Internal restructuring |
   | `docs/*` | `develop` | `develop` | Documentation |
   | `test/*` | `develop` | `develop` | Test-only changes |
   | `release/*` | `develop` | `main` | Release stabilization |
   | `hotfix/*` | `main` | `main` | Urgent production fixes |

   If the working tree is dirty or the requested branch transition could risk user changes, stop before switching branches and report the exact condition.

4. For branch, release, or PR details, use [`docs/GIT-WORKFLOW.md`](../../../docs/GIT-WORKFLOW.md) as the repository source of truth.

## Commits

Use this format for every authored commit and PR title:

```text
type(scope): summary
```

Allowed types are `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `style`, `security`, and `revert`. The scope is optional and may contain lowercase letters, digits, `.`, `_`, `/`, or `-`.

The subject must be imperative, concise, at most 100 characters including the type and scope, and must not end with a period. Use `!` before the colon for breaking changes and include a `BREAKING CHANGE:` footer when needed.

Before committing, validate the exact message with:

```powershell
node scripts/validate-commit-message.mjs --message "type(scope): summary"
```

If the local hook is not configured, enable it once with `npm run git:setup`. Do not claim a hook or validation ran unless it actually ran.

Prefer squash merges for ordinary PRs. Release branches merge to `main`; after a release or hotfix, back-merge `main` into `develop` as described in the workflow document.

## Authorization and handoff

Do not create commits, push branches, open PRs, or merge branches unless the user explicitly requests that action. When a commit is requested, make it narrowly scoped, validate its message, and report the branch, commit, and checks performed.

At task completion, report the current branch and whether the working tree has unrelated pre-existing changes. If the task changed files without a requested commit, leave the changes uncommitted and provide a Conventional Commit candidate for the user.
