---
title: 'The Definitive Guide to Every Claude Code Configuration File'
description: 'CLAUDE.md, CLAUDE.local.md, rules, skills, agents, hooks, memory, settings — Claude Code has dozens of configuration files. This guide explains each one, where to put it, when to use it, and how they all relate to each other.'
pubDate: 2026-04-13
tags: ['Claude Code', 'AI', 'Developer Tools', 'Configuration', 'Workflow']
lang: 'en'
---

You start using Claude Code, create a `CLAUDE.md`, and everything works. Then you discover `CLAUDE.local.md` exists. Then `.claude/rules/`. Then `settings.json`. Then auto memory. Then skills, agents, hooks...

Suddenly there are a dozen markdown and JSON files influencing Claude's behavior — and no clarity about what goes where.

This guide fixes that. We will cover **every** configuration file that Claude Code supports, explain the purpose of each one, and give clear rules for when to use each option.

---

## The Big Picture

Before diving into the details, here is the complete map of everything that exists:

```
# System level (managed by IT/organization)
/Library/Application Support/ClaudeCode/    # macOS
/etc/claude-code/                           # Linux
  managed-settings.json
  CLAUDE.md

# User level (personal, all projects)
~/.claude/
  CLAUDE.md              # Personal global instructions
  settings.json          # Global settings
  rules/*.md             # Personal rules
  skills/*/SKILL.md      # Personal skills
  agents/*.md            # Personal agents
  commands/*.md          # Commands (legacy)
  projects/*/memory/     # Auto memory per project
    MEMORY.md
    *.md

~/.claude.json           # App state, personal MCP servers

# Project level (shared with the team)
<project>/
  CLAUDE.md              # Project instructions
  CLAUDE.local.md        # Personal project instructions (gitignored)
  .mcp.json              # Project MCP servers
  .worktreeinclude       # Gitignored files for worktrees
  .claude/
    CLAUDE.md            # Alternative to root CLAUDE.md
    settings.json        # Project settings (shared)
    settings.local.json  # Local settings (gitignored)
    rules/*.md           # Project rules
    skills/*/SKILL.md    # Project skills
    agents/*.md          # Project agents
    commands/*.md        # Commands (legacy)
```

Looks like a lot? That is because there are two orthogonal dimensions:

1. **File type** — what it does (instructions, configuration, automation, extension)
2. **Scope** — who it applies to (organization, user, project, local)

Let's understand each dimension — but first, it helps to see how it all comes together in what Claude actually receives.

---

## How Claude Code Builds the Context

Before detailing each file, it is useful to understand **the full structure of what reaches the model**. This picture comes from reverse-engineering Claude Code's source: in March 2026, it was discovered that npm releases included source maps with the full TypeScript source. This led to two reference projects:

- **[OpenClaude](https://github.com/Gitlawb/openclaude)** — open-source fork of Claude Code built from the leaked source, with multi-provider support (OpenAI, Gemini, Ollama, etc.)
- **[Claude Code From Source](https://claude-code-from-source.com/)** — technical book in 18 chapters analyzing every part of the codebase ([GitHub](https://github.com/alejandrobalderas/claude-code-from-source/tree/main/book))

### The System Prompt Architecture

According to [Chapter 4 (API Layer)](https://github.com/alejandrobalderas/claude-code-from-source/blob/main/book/ch04-api-layer.md), the system prompt is built in **two major sections**, separated by an internal marker. The reason is economic: Anthropic's API offers prompt caching — identical prefixes across requests are reused on the server, saving latency and cost.

```
┌──────────────────────────────────────────────────────────────┐
│  STATIC SECTION  (global cache — identical for all Claude    │
│                   Code users worldwide)                      │
│                                                              │
│  1. Claude's identity and introduction                       │
│  2. System behavior rules                                    │
│  3. Task execution instructions                              │
│  4. Action and caution guidelines                            │
│  5. Tool usage instructions                                  │
│  6. Tone and style                                           │
│  7. Output efficiency                                        │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│        === DYNAMIC BOUNDARY ===                              │
├──────────────────────────────────────────────────────────────┤
│  DYNAMIC SECTION  (per-session cache — user-specific)        │
│                                                              │
│  8. Session guidance                                         │
│  9. Instructions: CLAUDE.md files (in order below)           │
│ 10. Environment info (date, OS, model, session ID)           │
│ 11. Language preference                                      │
│ 12. MCP instructions (when servers are configured)           │
│ 13. Output style                                             │
│                                                              │
│  + MEMORY.md (always present, first 200 lines)               │
│  + Up to 5 memory files (selected by side-query)             │
└──────────────────────────────────────────────────────────────┘
```

Everything **before** the boundary is identical for all users — it shares a global server-side cache. Everything **after** is specific to your session. Any dynamic condition placed before the boundary multiplies cache variations (the 2^N problem), which is why the source code uses an explicit naming pattern: cache-breaking sections are named `DANGEROUS_uncachedSystemPromptSection`.

### Where Each File Fits

**CLAUDE.md files** — all go to item 9 of the dynamic section, concatenated in this order:

| Order | File | When |
|---|---|---|
| 1 | Managed `CLAUDE.md` | Always |
| 2 | `~/.claude/CLAUDE.md` | Always |
| 3 | `CLAUDE.md` from parent directories | Always |
| 4 | `./CLAUDE.md` / `.claude/CLAUDE.md` | Always |
| 5 | `./CLAUDE.local.md` | Always |

**Other files:**

| File | Where it appears | When |
|---|---|---|
| `MEMORY.md` (index) | Dynamic section | Always (max 200 lines / 25KB) |
| Memory files (topics) | Dynamic section | On demand (up to 5 per turn) |
| Rules without `paths:` | Dynamic section | Always |
| Rules with `paths:` | Injected into conversation | When Claude accesses matching files |
| Skills (frontmatter) | Dynamic section | Always (descriptions in menu) |
| Skills (full content) | Injected into conversation | When invoked |
| Hooks | Not in the prompt | Execute external code on events |
| Settings | Not in the prompt | Control permissions and behavior |
| MCP servers | Dynamic section, item 12 | When servers are configured |

### Memory Selection via LLM

According to [Chapter 11 (Memory)](https://github.com/alejandrobalderas/claude-code-from-source/blob/main/book/ch11-memory.md), the selection of which memory files to load is **not keyword-based or embedding-based** — it is done by a Sonnet model in a parallel side-query:

1. User submits a prompt
2. An **async side-query** fires in parallel with the main model
3. The system reads the frontmatter of every memory `.md` file (max 30 lines each)
4. It formats a manifest with each file's type, name, date, and description
5. **Sonnet** receives the manifest + the user's prompt
6. Sonnet returns up to **5 filenames** via structured JSON output
7. Selected files are read in full and injected into context, with a staleness warning if old

The `MEMORY.md` index is always loaded. Full topic content is selected by relevance. Files older than 1 day receive an automatic warning — "this memory is X days old, verify it is still valid" — because models reason better with "47 days ago" than with an ISO timestamp.

### Practical Implications

Understanding this structure makes some configuration decisions clearer:

1. **Long CLAUDE.md = tokens wasted every session.** The entire file goes to item 9 of the dynamic section in every conversation. Use rules with `paths:` to load instructions only when relevant.

2. **MCP breaks the global cache.** When you configure MCP servers, item 12 injects user-specific tool definitions — this prevents global caching of the system prompt.

3. **Rules without `paths:` = always in the prompt.** They sit in the dynamic section just like CLAUDE.md files — only rules with `paths:` are loaded conditionally.

4. **Skills have two-phase loading.** The frontmatter (name, description) goes into the system prompt so Claude knows they exist. Full content is only injected when the skill is invoked.

5. **`MEMORY.md` has a hard limit.** 200 lines or 25KB — whichever comes first. Beyond that, the system injects a warning asking to condense.

With this mental map, the sections below will make more sense — each file has a precise place in this structure.

---

## Part 1: Instruction Files (Markdowns)

These are the files that tell Claude **how to behave**. They are all markdown, loaded into the conversation context, and directly influence Claude's responses.

### CLAUDE.md — Project Instructions

| Property | Value |
|---|---|
| **Path** | `./CLAUDE.md` or `./.claude/CLAUDE.md` |
| **Scope** | Project (entire team) |
| **Git** | Yes, committed |
| **Loading** | Start of every session |
| **Context** | Always present in the context window |

This is the most important file. It defines the project's rules — code conventions, build commands, architecture, what Claude should or should not do.

**Example:**

```markdown
# Newsletter App

## Stack
- Backend: FastAPI + Python 3.12
- Frontend: Next.js 15
- DB: PostgreSQL via SQLAlchemy

## Commands
- Tests: `uv run pytest`
- Lint: `uv run ruff check .`
- Dev server: `uv run uvicorn app.main:app --reload`

## Conventions
- Always use type hints in Python
- Endpoints must return Pydantic models
- Tests go in tests/ mirroring the src/ structure
```

**Tips:**
- Keep it **under 200 lines** — longer files reduce Claude's adherence
- Use the `@path/to/file` syntax to import other files (resolves relative to the CLAUDE.md)
- Imports are recursive (maximum 5 levels)
- HTML comments (`<!-- note -->`) are stripped before injection into context
- Can be placed at `.claude/CLAUDE.md` to keep the project root clean

**Hierarchical discovery:**
Claude searches for `CLAUDE.md` in all parent directories up to the root. In a monorepo, this enables layered instructions:

```
monorepo/
  CLAUDE.md              # General monorepo rules
  packages/
    api/
      CLAUDE.md          # API-specific rules
    frontend/
      CLAUDE.md          # Frontend-specific rules
```

Subdirectory CLAUDE.md files are loaded **on demand** — only when Claude reads files in that directory.

---

### CLAUDE.local.md — Personal Project Instructions

| Property | Value |
|---|---|
| **Path** | `./CLAUDE.local.md` |
| **Scope** | Personal (only you, in this project) |
| **Git** | No (automatically gitignored) |
| **Loading** | Start of every session, after CLAUDE.md |
| **Precedence** | Higher than CLAUDE.md when there is a conflict |

Use this for personal preferences that only apply to this project.

**Example:**

```markdown
# Local Preferences

- My staging environment: https://staging-fernando.example.com
- Always run tests with -v (verbose)
- I prefer docker compose over running locally
```

**When to use:**
- Personal sandbox URLs
- Machine-specific paths
- Personal test preferences
- Any instruction that does not make sense for the team

---

### ~/.claude/CLAUDE.md — Personal Global Instructions

| Property | Value |
|---|---|
| **Path** | `~/.claude/CLAUDE.md` |
| **Scope** | Personal (all your projects) |
| **Git** | N/A (not inside any repo) |
| **Loading** | Start of every session, in every project |
| **Precedence** | Lower than project instructions |

This is your global profile. Rules that apply to **any** project.

**Example:**

```markdown
# Python Environment
- Always use `uv` for Python package management
- Always use `.venv` for virtual environments
- Install packages with `uv pip install`, never `pip install`

# Git
- Commit messages in English
- Use conventional commits (feat:, fix:, etc.)

# Style
- Short and direct responses
- No emojis
```

**Tip:** Keep it short. This file is loaded in **every** session of **every** project. Each line consumes tokens.

---

### Summary: Which CLAUDE.md to Use?

| Question | File |
|---|---|
| Rule applies to the whole team on this project? | `CLAUDE.md` (root) |
| Rule is just mine, specific to this project? | `CLAUDE.local.md` |
| Rule is mine and applies to any project? | `~/.claude/CLAUDE.md` |
| Rule is for the entire organization? | Managed `CLAUDE.md` |

Loading order (all are concatenated, not replaced):

1. Managed CLAUDE.md (organization)
2. `~/.claude/CLAUDE.md` (user global)
3. CLAUDE.md from parent directories (monorepo)
4. `./CLAUDE.md` or `./.claude/CLAUDE.md` (project)
5. `./CLAUDE.local.md` (personal project)

---

## Part 2: Rules — Conditional Instructions

### .claude/rules/*.md

| Property | Value |
|---|---|
| **Path** | `.claude/rules/*.md` |
| **Scope** | Project (team) or personal (`~/.claude/rules/`) |
| **Git** | Yes (project) / N/A (personal) |
| **Loading** | Conditional (with `paths:`) or always (without `paths:`) |

Rules solve a specific problem: your CLAUDE.md gets too large. Instead of a monolithic 500-line file, you split it into topic-specific files — which can be loaded **always** or **only when relevant**, depending on whether they have a `paths:` field in their frontmatter.

**Unconditional rule** (always loaded):

```markdown
# .claude/rules/code-quality.md

- All new code needs tests
- Public functions need docstrings
- Maximum 50 lines per function
```

**Conditional rule** (loaded only when Claude works with files matching the glob):

```markdown
---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
---

# Testing Rules

- Use `describe` to group by functionality
- Test names: "should [expected] when [condition]"
- Mock external dependencies, never internal modules
- Prefer `toEqual` over `toBe` for objects
```

```markdown
---
paths:
  - "src/api/**/*.py"
  - "src/routes/**/*.py"
---

# API Rules

- Every endpoint must have input validation via Pydantic
- Return 422 for validation errors, never 400
- Always include pagination on endpoints that return lists
```

**When to use rules vs CLAUDE.md:**

| Situation | Choice |
|---|---|
| Rule applies to all files, always | CLAUDE.md |
| Rule applies to a specific file type | `.claude/rules/` with `paths:` |
| CLAUDE.md exceeded 200 lines | Migrate topics to `.claude/rules/` |
| Personal rule specific to certain files | `~/.claude/rules/` with `paths:` |

**Symlink support:** You can create symlinks in `.claude/rules/` pointing to shared directories, useful for common rules across projects.

---

## Part 3: Settings — Technical Configuration

Settings control **permissions, automation, and technical behavior** of Claude Code. They are JSON, not markdown.

### .claude/settings.json — Project Configuration

| Property | Value |
|---|---|
| **Path** | `.claude/settings.json` |
| **Scope** | Project (team) |
| **Git** | Yes |
| **Format** | JSON |

```json
{
  "permissions": {
    "allow": [
      "Bash(npm test *)",
      "Bash(npm run *)",
      "Read",
      "Glob",
      "Grep"
    ],
    "deny": [
      "Bash(rm -rf *)"
    ]
  },
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "npx prettier --write $CLAUDE_FILE_PATH"
      }]
    }]
  },
  "model": "claude-opus-4-6"
}
```

### .claude/settings.local.json — Local Configuration

| Property | Value |
|---|---|
| **Path** | `.claude/settings.local.json` |
| **Scope** | Personal (this project) |
| **Git** | No (gitignored) |

Same format as `settings.json`, but for personal overrides.

### ~/.claude/settings.json — Global Configuration

| Property | Value |
|---|---|
| **Path** | `~/.claude/settings.json` |
| **Scope** | Personal (all projects) |

Preferences that apply across any project: default permissions, preferred model, global hooks.

### Settings Precedence

From strongest to weakest:

1. **Managed settings** (organization — cannot be overridden)
2. **CLI arguments** (`--model`, `--permission-mode`)
3. **settings.local.json** (personal project)
4. **settings.json** (shared project)
5. **~/.claude/settings.json** (personal global)

**Merge rule:** Arrays (like `permissions.allow`) are **combined** across scopes. Scalar values use the most specific one.

---

## Part 4: Auto Memory

### ~/.claude/projects/*/memory/

| Property | Value |
|---|---|
| **Path** | `~/.claude/projects/<project>/memory/` |
| **Scope** | Per project, personal |
| **Git** | N/A (outside the repo) |
| **Loading** | MEMORY.md at start (first 200 lines / 25KB), topic files on demand |
| **Who writes** | Claude automatically + you can edit |

Auto memory is where Claude **stores what it has learned** across sessions. Unlike CLAUDE.md (which you write), memory is maintained by Claude based on interactions.

**Structure:**

```
~/.claude/projects/<project>/memory/
  MEMORY.md              # Index (loaded automatically)
  user_preferences.md    # Topic file
  project_context.md     # Topic file
  feedback_testing.md    # Topic file
```

**MEMORY.md** is a concise index — each entry one line with a link to the detail file:

```markdown
- [User role](user_preferences.md) — data scientist, prefers verbose output
- [Testing approach](feedback_testing.md) — always use real DB, never mocks
```

**Topic files** have frontmatter:

```markdown
---
name: testing approach
description: User preference for integration tests over mocks
type: feedback
---

Integration tests must hit a real database, not mocks.

**Why:** Prior incident where mock/prod divergence masked a broken migration.
**How to apply:** When writing or suggesting tests for DB operations, always use the real test database.
```

**Memory types:**
- `user` — about the person (role, preferences, knowledge)
- `feedback` — corrections and confirmed approaches
- `project` — ongoing work context
- `reference` — pointers to external resources

**Memory vs CLAUDE.md:**

| | CLAUDE.md | Memory |
|---|---|---|
| Who writes | You | Claude (automatically) |
| Loading | Always, fully | Index at start, details on demand |
| Scope | Team or personal | Personal |
| Content | Rules, instructions | Learnings, context, preferences |
| Version control | Git | Outside the repo |

**Manage:** Use the `/memory` command to view, edit, or disable. Or configure `autoMemoryEnabled: false` in settings.

---

## Part 5: Extensions — Skills, Agents, Commands

### .claude/skills/ — Reusable Workflows

| Property | Value |
|---|---|
| **Path** | `.claude/skills/<name>/SKILL.md` |
| **Scope** | Project or personal (`~/.claude/skills/`) |
| **Git** | Yes (project) |
| **Loading** | Two phases: frontmatter always in prompt, full content when invoked |

Skills are the most powerful extension mechanism. Each skill is a directory with a `SKILL.md` and optionally supporting files (checklists, scripts, templates).

**Example:**

```
.claude/skills/
  deploy/
    SKILL.md
    checklist.md
    scripts/deploy.sh
  review-pr/
    SKILL.md
```

**SKILL.md:**

```markdown
---
name: deploy
description: Deploy the application to production
allowed-tools: Bash(npm run deploy) Bash(git push)
---

Deploy $ARGUMENTS to production:

1. Run the full test suite
2. Build the application
3. Check the deployment checklist in checklist.md
4. Execute the deploy script
5. Verify health checks pass
```

**Key frontmatter fields:**

| Field | Description |
|---|---|
| `name` | Skill name (becomes the `/command`) |
| `description` | Description (Claude uses it to decide when to auto-invoke) |
| `allowed-tools` | Pre-approved tools that skip permission prompts |
| `disable-model-invocation` | `true` = only the user can invoke |
| `user-invocable` | `false` = hidden from menu, only Claude invokes |
| `model` | Model override |
| `context` | `fork` = runs in isolated subagent |
| `paths` | Globs for auto-activation |

**Available variables:** `$ARGUMENTS`, `$0`, `$1`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_SKILL_DIR}`.

**Dynamic context:** Use `` !`command` `` to inject shell output before Claude processes the skill.

---

### .claude/agents/ — Custom Subagents

| Property | Value |
|---|---|
| **Path** | `.claude/agents/<name>.md` |
| **Scope** | Project or personal (`~/.claude/agents/`) |
| **Git** | Yes (project) |
| **Loading** | When invoked |

Agents are isolated specialists. Each one has its own context, allowed tools, and can use a different model.

**Example:**

```markdown
---
name: security-reviewer
description: Reviews code for security vulnerabilities
tools: Read, Grep, Glob
model: claude-opus-4-6
---

You are a senior security engineer. Review code for:

1. Injection vulnerabilities (SQL, command, XSS)
2. Authentication/authorization bypasses
3. Data exposure risks
4. Insecure dependencies

Report findings with severity (critical/high/medium/low) and fix recommendations.
```

**Key frontmatter fields:**

| Field | Description |
|---|---|
| `name` | Unique identifier |
| `description` | When Claude should delegate to this agent |
| `tools` | Allowed tools list (restricts if specified) |
| `model` | `sonnet`, `opus`, `haiku`, or full model ID |
| `memory` | `user`, `project`, or `local` — its own persistent memory |
| `maxTurns` | Turn limit |
| `isolation` | `worktree` to isolate in a git worktree |

---

### .claude/commands/ — Commands (Legacy)

| Property | Value |
|---|---|
| **Path** | `.claude/commands/<name>.md` |
| **Status** | **Deprecated** — use skills instead |

Commands are the old version of skills. They still work, but if a skill and a command share the same name, the skill takes priority. To migrate, move the file to `.claude/skills/<name>/SKILL.md`.

---

## Part 6: Automation — Hooks

Hooks are defined inside `settings.json` (any scope). They execute automatic actions in response to lifecycle events.

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "npx prettier --write $CLAUDE_FILE_PATH"
      }]
    }],
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "echo 'Claude finished' | say"
      }]
    }]
  }
}
```

**Available events:**

| Event | When |
|---|---|
| `SessionStart` | Session starts |
| `UserPromptSubmit` | User submits prompt |
| `PreToolUse` | Before using a tool (can block) |
| `PostToolUse` | After using a tool |
| `Stop` | Claude finishes responding |
| `SessionEnd` | Session ends |
| `FileChanged` | A watched file changes |
| `WorktreeCreate` | Worktree created |

**Hook types:**

| Type | Description |
|---|---|
| `command` | Executes shell script |
| `http` | POST to a URL |
| `prompt` | Single-turn LLM evaluation |
| `agent` | Subagent with tool access |

**Exit codes (for `command`):** `0` = allow, `2` = block action, other = non-blocking error.

---

## Part 7: Other Files

### .mcp.json — Project MCP Servers

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

Shared with the team (committed). Personal MCP servers go in `~/.claude.json`.

### .worktreeinclude — Files for Worktrees

Lists gitignored files that should be copied into new worktrees:

```
.env
.env.local
config/secrets.json
```

### ~/.claude/keybindings.json — Keyboard Shortcuts

Custom keybinding configuration. Manage with `/keybindings`.

---

## Part 8: Decision Tree

Not sure where to put something? Use this flow:

**Is it an instruction about how Claude should behave?**
- Yes → Is it for the whole team? → `CLAUDE.md`
- Yes → Is it personal, for this project? → `CLAUDE.local.md`
- Yes → Is it personal, for all projects? → `~/.claude/CLAUDE.md`
- Yes → Does it only apply to certain files? → `.claude/rules/*.md` with `paths:`

**Is it technical configuration (permissions, model, variables)?**
- For the team → `.claude/settings.json`
- Personal for this project → `.claude/settings.local.json`
- Personal for all projects → `~/.claude/settings.json`

**Is it a reusable workflow (deploy, review, etc.)?**
- → `.claude/skills/*/SKILL.md`

**Is it an isolated specialist (reviewer, researcher)?**
- → `.claude/agents/*.md`

**Is it automation that runs in response to events?**
- → `hooks` inside `settings.json`

**Is it something Claude learned about you or the project?**
- → Auto memory (managed by Claude, editable by you)

---

## Final Summary

| File | Purpose | Scope | Git | Loading |
|---|---|---|---|---|
| `CLAUDE.md` | Project instructions | Team | Yes | Always |
| `CLAUDE.local.md` | Personal project instructions | Personal | No | Always |
| `~/.claude/CLAUDE.md` | Personal global instructions | Personal | N/A | Always |
| `.claude/rules/*.md` | Topic-based instructions | Team/Personal | Yes/N/A | No `paths:` = always; with `paths:` = conditional |
| `.claude/settings.json` | Permissions, hooks, model | Team | Yes | Always |
| `.claude/settings.local.json` | Personal settings override | Personal | No | Always |
| `~/.claude/settings.json` | Personal global settings | Personal | N/A | Always |
| `~/.claude/projects/*/memory/` | Learned memory | Personal | N/A | On demand |
| `.claude/skills/*/SKILL.md` | Reusable workflows | Team/Personal | Yes/N/A | Frontmatter always; content on demand |
| `.claude/agents/*.md` | Specialized subagents | Team/Personal | Yes/N/A | On demand |
| `.claude/commands/*.md` | Commands (legacy) | Team/Personal | Yes/N/A | On demand |
| `hooks` (in settings) | Event-driven automation | Team/Personal | Depends | Per event |
| `.mcp.json` | MCP servers | Team | Yes | Always |
| `.worktreeinclude` | Files for worktrees | Team | Yes | On creation |

The system is extensive, but the logic is consistent: **scope** (team vs personal vs global) crossed with **type** (instruction vs configuration vs extension vs automation). Once you understand these two dimensions, any new file that Anthropic adds will naturally fit into the mental model.

---

## References

- **Official Claude Code docs** — [code.claude.com/docs](https://code.claude.com/docs)
- **Claude Code From Source** — Technical book in 18 chapters based on reverse-engineering the source code. [Website](https://claude-code-from-source.com/) | [GitHub](https://github.com/alejandrobalderas/claude-code-from-source/tree/main/book). Most relevant chapters for this guide:
  - [Ch. 4: API Layer](https://github.com/alejandrobalderas/claude-code-from-source/blob/main/book/ch04-api-layer.md) — system prompt construction, caching, dynamic boundary
  - [Ch. 11: Memory](https://github.com/alejandrobalderas/claude-code-from-source/blob/main/book/ch11-memory.md) — memory system, Sonnet selection, staleness
  - [Ch. 12: Extensibility](https://github.com/alejandrobalderas/claude-code-from-source/blob/main/book/ch12-extensibility.md) — skills, hooks, security snapshot
- **OpenClaude** — Open-source Claude Code fork with multi-provider support. [GitHub](https://github.com/Gitlawb/openclaude)
