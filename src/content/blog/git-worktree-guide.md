---
title: 'Git Worktree: Work on Multiple Branches at the Same Time'
description: 'Stop stashing, switching, and losing context. Git worktree lets you check out multiple branches simultaneously, each in its own directory, all backed by a single repository. Here is the complete, step-by-step guide.'
pubDate: 2026-03-28
tags: ['Git', 'Developer Tools', 'Workflow', 'Productivity']
lang: 'en'
---

You are deep into a feature — files restructured, half-done refactor, three browser tabs open, mental model finally loaded — and then Slack pings: *production is down, can you take a look?*

You know what comes next. `git stash`, pray nothing gets lost, switch to `main`, create a hotfix branch, fix the issue, merge, push, switch back, `git stash pop`, and then spend ten minutes remembering where you were.

There is a better way. It has been built into Git since 2015. It is called **git worktree**, and most developers have never heard of it.

---

## What Is Git Worktree?

A worktree is a working directory linked to your repository. You already have one — it was created when you ran `git init` or `git clone`. Git calls it the **main worktree**.

`git worktree` lets you create additional working directories — **linked worktrees** — each checked out on a different branch, all sharing the same `.git` database.

```
my-project/           ← main worktree (feature branch)
my-project-hotfix/    ← linked worktree (hotfix branch)
my-project-review/    ← linked worktree (PR review branch)
```

All three directories share one object database. No duplication. No syncing. Commits made in any worktree are immediately visible in the others.

---

## Why Not Just Use Git Stash?

`git stash` is fine for quick, five-minute context switches. It falls apart when:

- You have **untracked files** (`git stash` ignores them by default)
- You need to **run a server or tests** in both branches simultaneously
- You want to **keep your terminal history, IDE state, and focus** intact
- The interruption turns into an hour-long rabbit hole

And `git clone` is worse — it duplicates the entire `.git` directory, wastes disk space, and leaves your branches out of sync.

| | `git stash` | `git clone` | `git worktree` |
|---|---|---|---|
| Disk usage | Minimal | Doubles `.git` | Minimal (shared DB) |
| Untracked files preserved | No (by default) | N/A | Yes |
| Work on two branches at once | No | Yes | Yes |
| Shared refs / commits | N/A | No (manual sync) | Yes, automatic |
| Risk of losing work | Medium | Low | Low |

---

## Prerequisites

Check your Git version. Worktree was added in Git 2.5 (2015) and stabilized further in 2.7+.

```bash
git --version
# git version 2.39.0 ✓
```

If you are below 2.5, update Git. On macOS: `brew upgrade git`. On Ubuntu: `sudo apt update && sudo apt upgrade git`.

---

## Step 1 — Add Your First Linked Worktree

The core command is `git worktree add`. Its simplest form takes a path and a branch name:

```bash
git worktree add <path> [<branch>]
```

Let's say you are on a `feature/dashboard` branch and need to fix a bug on `main`:

```bash
git worktree add ../my-project-hotfix main
```

This creates a new directory `../my-project-hotfix` with `main` checked out. Your current directory — and your feature branch — is untouched.

Now open a second terminal tab, navigate to the new directory, and work there:

```bash
cd ../my-project-hotfix
# fix the bug
git commit -am "Fix null pointer on login redirect"
git push origin main
```

Your feature branch is still exactly where you left it in the original directory.

---

## Step 2 — Create a New Branch in a New Worktree

Most of the time you will not check out an existing branch — you will create a new one. Use the `-b` flag:

```bash
git worktree add -b hotfix/login-redirect ../hotfix main
```

Breaking this down:
- `-b hotfix/login-redirect` — creates a new branch named `hotfix/login-redirect`
- `../hotfix` — the directory to create
- `main` — the starting commit (branch this off of `main`)

If the branch already exists and you want to force-reset it, use `-B` (uppercase):

```bash
git worktree add -B hotfix/login-redirect ../hotfix main
```

---

## Step 3 — List All Worktrees

See all your active worktrees at any time:

```bash
git worktree list
```

Example output:

```
/Users/fernando/my-project          abc1234 [feature/dashboard]
/Users/fernando/hotfix              def5678 [hotfix/login-redirect]
/Users/fernando/review-pr-42        9abcdef [teammate/auth-refactor]
```

For more detail, use `--verbose`:

```bash
git worktree list --verbose
```

This shows locked worktrees and ones that can be pruned.

---

## Step 4 — Remove a Worktree When You Are Done

Once you have committed and pushed your hotfix, clean up:

```bash
git worktree remove ../hotfix
```

This removes the directory and cleans up the administrative files in `.git/worktrees/`. Git will refuse to remove a worktree with uncommitted changes — use `--force` to override:

```bash
git worktree remove --force ../hotfix
```

---

## Step 5 — Prune Stale Worktrees

If you manually deleted a worktree directory with `rm -rf` instead of `git worktree remove`, the administrative files in `.git/worktrees/` remain as stale entries. Clean them up with:

```bash
git worktree prune
```

To preview what would be removed without actually removing anything:

```bash
git worktree prune --dry-run
```

Git also auto-prunes stale entries during `git gc`, controlled by the `gc.worktreePruneExpire` setting (default: 3 months).

---

## Real-World Workflows

### Workflow 1: Emergency Hotfix

The canonical use case.

```bash
# You're on feature/dashboard, mid-work
git worktree add -b hotfix/crash ../hotfix main

cd ../hotfix
# investigate, fix the bug
git commit -am "Fix crash on empty cart checkout"
git push origin hotfix/crash
# open PR, get it merged

cd ../my-project           # back to your feature, untouched
git worktree remove ../hotfix
```

Total disruption to your feature work: zero.

### Workflow 2: Reviewing a Colleague's Pull Request

Instead of stashing, switching, and then restoring:

```bash
git worktree add ../review-pr-42 origin/teammate/auth-refactor

cd ../review-pr-42
npm install && npm test    # run their tests
# read the code, leave comments

cd ../my-project
git worktree remove ../review-pr-42
```

### Workflow 3: Running Tests on Two Branches Simultaneously

Your CI pipeline is slow and you want to run tests on `main` while you keep developing:

```bash
git worktree add ../main-test main

# Terminal 1 (main-test)
cd ../main-test && npm test

# Terminal 2 (my-project)
cd ../my-project && continue coding
```

Both processes run in parallel, independently.

### Workflow 4: Addressing PR Review Comments

You pushed a PR and started a new task. Review comments arrive.

```bash
# You're now on feature/new-task
git worktree add ../pr-fixes feature/dashboard

cd ../pr-fixes
# address the review comments
git push origin feature/dashboard

cd ../my-project
git worktree remove ../pr-fixes
```

---

## Advanced: Bare Repository Pattern

For teams or power users who want to keep all worktrees under one clean directory, a bare clone is elegant:

```bash
# Clone as a bare repo (no working directory, just the .git data)
git clone --bare https://github.com/you/my-project.git .bare

# Create a .git file pointing to the bare repo (makes tools like git log work)
echo "gitdir: ./.bare" > .git

# Fix remote tracking (bare clones don't set this by default)
git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
git fetch

# Add your worktrees
git worktree add main main
git worktree add feature/dashboard -b feature/dashboard origin/main
```

Your directory now looks like:

```
my-project/
├── .bare/            ← the actual git database
├── .git              ← file: gitdir: ./.bare
├── main/             ← worktree for main branch
└── feature/
    └── dashboard/    ← worktree for your feature
```

Everything in one place, neatly organized.

---

## Locking a Worktree

If a worktree lives on a removable drive, network share, or is otherwise temporarily unavailable, you can lock it to prevent accidental pruning:

```bash
git worktree lock --reason "on USB drive" ../hotfix
```

To unlock it later:

```bash
git worktree unlock ../hotfix
```

Locked worktrees appear in `git worktree list --verbose` with a `locked` status.

---

## Moving a Worktree

You can move a linked worktree to a new location without breaking anything:

```bash
git worktree move ../hotfix ../new-location/hotfix
```

If you moved a directory manually (with `mv`), Git's internal links will be broken. Fix them with:

```bash
git worktree repair
```

---

## Common Gotchas

**You cannot check out the same branch in two worktrees.**

```bash
git worktree add ../duplicate main
# fatal: 'main' is already checked out at '/path/to/my-project'
```

Each branch can live in exactly one worktree at a time. This is intentional — two directories sharing the same branch index would produce index conflicts.

**Submodule support is limited.**

The Git docs explicitly warn that multiple worktrees for repos with submodules is "not recommended." Submodule support in worktrees is still experimental. If your project relies heavily on submodules, test carefully before adopting this workflow.

**IDEs still re-index per directory.**

VS Code and JetBrains treat each worktree directory as a new project and will index it separately. You still benefit from not switching branches, but expect some IDE startup cost when you open a new worktree.

---

## Quick Reference

```bash
# Add a worktree (existing branch)
git worktree add <path> <branch>

# Add a worktree (new branch, based on another)
git worktree add -b <new-branch> <path> <base-branch>

# List all worktrees
git worktree list
git worktree list --verbose

# Remove a worktree
git worktree remove <path>
git worktree remove --force <path>   # even with uncommitted changes

# Clean up stale entries
git worktree prune
git worktree prune --dry-run

# Lock / unlock
git worktree lock --reason "<reason>" <path>
git worktree unlock <path>

# Move a worktree
git worktree move <old-path> <new-path>

# Fix broken links after a manual move
git worktree repair
```

---

## When Should You Use Worktrees?

Use `git stash` when the interruption is genuinely short (under 5 minutes) and your working tree is clean.

Use `git worktree` when:

- You need to **run both branches** (servers, tests, builds) at the same time
- The interruption is substantial — a full bug fix, a PR review, addressing review comments
- You have **untracked files** you don't want to manage with stash flags
- You want to **stay focused** in your original directory without any branch-switching noise

Once you start using worktrees, the stash dance starts to feel like the wrong tool for most interruptions. The mental overhead of "create, work, remove" is lower than you'd expect — and the payoff in uninterrupted focus is real.
