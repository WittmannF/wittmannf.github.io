---
title: 'Claude Code Skills: The Complete Guide from Beginner to Advanced'
description: 'Skills are the most powerful Claude Code extension mechanism. This guide covers everything — folder structure, frontmatter, arguments, dynamic context injection, invocation modes, agents, and best practices — with real examples you can copy and adapt.'
pubDate: 2026-06-16
tags: ['Claude Code', 'AI', 'Developer Tools', 'Workflow', 'Automation']
lang: 'en'
---

> **Prefer a visual, hands-on format?** This article has an [interactive version](/guides/claude-skills) with clickable frontmatter explorer, live argument demos, step-by-step tutorials, and a production checklist.

Claude Code starts fresh every session. Without skills, you repeat the same instructions endlessly — re-explaining your deploy pipeline, your code review standards, your SQL conventions, your commit style. Skills solve this by letting you write those instructions once, in a file, and invoke them reliably.

This guide covers everything from your first three-line skill to advanced patterns: multi-file layouts, auto-invocation, shell injection, forked subagents, and custom agents.

---

## What Are Skills?

Skills are reusable workflows — markdown files that Claude loads when you invoke a slash command or when the conversation context matches a trigger phrase. They can contain instructions, step-by-step procedures, shell commands to run, templates, and references to other files.

A minimal skill looks like this:

```markdown
---
name: greet
description: Greet the user warmly
---

Greet the user. If $ARGUMENTS contains a name, use it.
Otherwise use "friend" as a fallback. Keep it to one sentence.
```

Place that at `.claude/skills/greet/SKILL.md` and you get a `/greet` command. That's the whole mechanism — everything else is elaboration.

---

## Where Skills Live

Skills can exist in three places. The location determines who can use them:

| Location | Scope | Git | Command |
|---|---|---|---|
| `~/.claude/skills/<name>/SKILL.md` | You, all projects | N/A | `/name` |
| `.claude/skills/<name>/SKILL.md` | Your team, this project | Yes | `/name` |
| `<plugin>/plugin/skills/<name>/SKILL.md` | Anyone who installs the plugin | Via plugin | `/plugin:name` |

**The directory name becomes the command name.** A skill at `.claude/skills/deploy-prod/SKILL.md` becomes `/deploy-prod`. The `name:` frontmatter field is a display label only — it doesn't affect the slash command.

For legacy compatibility, `.claude/commands/foo.md` still works and creates `/foo`. Skills take priority when names conflict, and they unlock more features.

### Supporting files

Skills can have supporting files alongside SKILL.md:

```
.claude/skills/deploy/
├── SKILL.md          ← instructions (required)
├── checklist.md      ← loaded on demand by Claude
├── references/
│   └── infra.md      ← detailed infrastructure notes
└── scripts/
    └── health-check.sh
```

Claude loads SKILL.md when the skill is invoked. It only reads supporting files when it decides they're relevant — this keeps context lean. Reference the files by name in SKILL.md and Claude will fetch them as needed.

---

## Frontmatter Reference

The YAML block at the top of SKILL.md controls skill behavior. Here are all the significant fields:

### `description` ★ (most important)

```yaml
---
description: |
  Deploy the application to staging or production.
  Use when user says "deploy", "ship", "release",
  "push to staging", or asks to push a new version.
---
```

Claude reads all skill descriptions at session start. When the conversation matches, it auto-invokes the skill. Write it in third person with specific trigger phrases. The hard limit is **1,536 characters** combined with `when_to_use`.

### `allowed-tools`

```yaml
---
allowed-tools: Bash(git *) Bash(npm test) Read Glob Grep
---
```

Pre-approves tools so Claude doesn't prompt for permission during the skill. Use specific patterns — `Bash(npm *)` not `Bash(*)`. Only active while the skill is running.

### `argument-hint`

```yaml
---
argument-hint: "[staging|production] [--dry-run]"
---
```

Shown in autocomplete when the user types `/skill-name`. Square brackets mean optional by convention.

### `disable-model-invocation: true`

Prevents Claude from auto-invoking the skill — only the user can trigger it with `/skill-name`. Use for destructive operations. When set, the description is **not** loaded into context.

### `user-invocable: false`

Hides the skill from the `/` menu but keeps the description in context so Claude can still auto-invoke it. Use for ambient background behaviors you want active but not surfaced.

### `model`

```yaml
---
model: claude-opus-4-8
---
```

Override the session model for this skill. Use `claude-opus-4-8` for complex analysis, `claude-haiku-4-5-20251001` for cheap formatting tasks.

### `context: fork`

Runs the skill in an isolated subagent with no conversation history. Results return to the main conversation as a message. Combine with `agent: Explore` or `agent: general-purpose` to specify the subagent type.

### `paths`

```yaml
---
paths: "**/*.test.ts,**/*.spec.ts"
---
```

Limits auto-activation to when Claude touches files matching the glob patterns. Saves tokens — the description is only injected when relevant.

---

## Arguments and Variables

When the user runs `/deploy staging --dry-run`, here's what's available:

| Variable | Value |
|---|---|
| `$ARGUMENTS` | `staging --dry-run` |
| `$0` | `staging` |
| `$1` | `--dry-run` |
| `${CLAUDE_SKILL_DIR}` | Absolute path to the skill directory |
| `${CLAUDE_SESSION_ID}` | Current session ID |

**Named arguments** — declare them in frontmatter for readable references:

```yaml
---
arguments: [component, from, to]
argument-hint: "<component> <from-framework> <to-framework>"
---

Migrate the $component component from $from to $to.
```

Running `/migrate-component SearchBar React Vue` gives `$component=SearchBar`, `$from=React`, `$to=Vue`.

If `$ARGUMENTS` isn't referenced anywhere in the skill body, the arguments are automatically appended as `ARGUMENTS: <value>` at the end.

---

## Dynamic Context Injection

Use `` !`command` `` to run shell commands before Claude sees the skill. The output is injected as plain text:

```markdown
---
name: review-pr
allowed-tools: Bash(git *) Bash(gh *) Read
---

Review the current PR.

## Changed files
!`git diff --name-only HEAD~1`

## PR description  
!`gh pr view --json title,body --jq '.title'`

Check each changed file for correctness, tests, and conventions.
```

Claude receives the actual diff output, not instructions to go fetch it. This is one of the most powerful features — your skill always has fresh, live data.

Multi-line fenced blocks also work:

````markdown
## Environment
```!
node --version
npm --version
git log --oneline -5
```
````

**Important:** Shell injection runs once at skill load, not on each message. For truly live data within a conversation, use `allowed-tools: Bash(...)` and let Claude run commands explicitly.

Organizations can disable shell injection globally with `disableSkillShellExecution: true` in managed settings.

---

## Four Invocation Modes

### 1. Explicit command (default)

The skill appears in the `/` menu and only runs when the user explicitly invokes it. Best for workflows that should never run automatically — deploys, releases, destructive operations.

### 2. Auto-triggered

Claude reads the description and auto-invokes the skill when the conversation matches. No `/skill-name` needed. Best for background knowledge and coding standards.

```yaml
---
description: |
  When working with SQL queries, always apply parameterized
  query patterns to prevent SQL injection. Auto-invoke when
  user writes database queries or asks about SQL.
---
```

### 3. File-conditional

Like auto-triggered, but only activates when Claude touches files matching `paths:` globs. The description is invisible to Claude when working on non-matching files — great for language-specific rules at zero cost when irrelevant.

```yaml
---
description: Apply our React component conventions
paths: "src/components/**/*.tsx,src/components/**/*.jsx"
---
```

### 4. Forked (isolated subagent)

The skill runs in a completely fresh subagent with no conversation history. Results come back as a message to the main conversation. Use for comprehensive searches, unbiased audits, or long-running analysis that would bloat main context.

```yaml
---
context: fork
agent: Explore
description: Deep codebase search — runs isolated
---
```

---

## Real-World Examples

### /deploy — Safe deploy with checklist

```markdown
---
name: deploy
description: Deploy the application to staging or production.
  Use when user says "deploy", "ship", "release", or "push to prod".
argument-hint: "[staging|production] [--dry-run]"
allowed-tools: Bash(npm *) Bash(git *) Bash(gh *)
---

Deploy $0 for branch !`git branch --show-current`.
Last commit: !`git log -1 --oneline`

Steps:
1. Run `npm test` — abort if any test fails
2. Run `npm run build`
3. If $0 is "production", ask for final confirmation
4. Run `npm run deploy:$0`
5. Verify health check at the deployed URL

$1 flag: if "--dry-run", simulate only — don't deploy.
```

Pair with a `checklist.md` in the same directory for pre-deploy verification.

### /security-audit — Isolated OWASP audit

```markdown
---
name: security-audit
description: Security audit on the codebase. Use when user asks
  for security review, vulnerability check, or OWASP audit.
context: fork
model: claude-opus-4-8
argument-hint: "[path or 'all']"
allowed-tools: Read Glob Grep
---

Perform a security audit on: $ARGUMENTS

Check for OWASP Top 10:
- Injection (SQL, command, XSS)
- Broken access control
- Cryptographic failures (hardcoded secrets, weak hashing)
- Insecure dependencies

For each finding:
- **Severity**: Critical / High / Medium / Low
- **Location**: file:line
- **Issue**: what's wrong
- **Fix**: concrete remediation

Sort by severity. If nothing found, say so clearly.
```

### /review — PR review with project conventions

```markdown
---
name: review
description: Review the current diff for code quality.
  Use when user says "review", "check my code", "look at this PR".
allowed-tools: Bash(git *) Bash(gh *) Read
---

Review for: !`git log -1 --oneline`

## Diff
```!
git diff HEAD~1
```

Review against the standards in conventions.md.

Focus: correctness, tests, style. Be direct — "null pointer on line 42",
not "consider checking for null".
```

### /debug — Structured debugging

```markdown
---
name: debug
description: Debug a bug or unexpected behavior. Use when user
  says "this is broken", "not working", or pastes a stack trace.
---

Debug: $ARGUMENTS

Protocol:
1. **Reproduce** — can you reliably reproduce it?
2. **Form 3 hypotheses** — list from most to least likely
3. **Test the top one first** — confirm/deny before moving on
4. **Report** — root cause (confirmed), fix, and why it's correct

Never "try" a fix without first confirming the root cause.
```

---

## Custom Agents

Agents are different from skills — they're isolated specialists with their own context, tool whitelist, and model. Claude delegates to them based on their description.

```markdown
---
name: security-reviewer
description: |
  Security specialist agent. Delegate to this agent
  when reviewing code that handles authentication,
  authorization, user input, database queries,
  file operations, or cryptography.
tools: Read Glob Grep
model: claude-opus-4-8
---

You are a senior application security engineer.

Review the provided code for security issues only.
Report findings with severity, location, exploit scenario, and fix.
```

Place this at `.claude/agents/security-reviewer.md`. Claude spawns it as needed.

**Skills vs agents:**

| | Skill | Agent |
|---|---|---|
| Context | Shared with main | Own isolated context |
| Tools | Main Claude's tools | Own whitelist |
| Best for | Reusable workflows | Specialist analysis |

---

## Best Practices

**Write descriptions like a detective brief.** The description is how Claude decides when to fire. Include specific trigger phrases users would actually say. Be concrete: "deploy", "ship to prod", "push to staging" — not "deployment operations".

**Keep SKILL.md lean.** Skills have a 5,000-token compaction budget per session. Long monolithic files get truncated. Keep the main file under ~400 lines and move details to `references/` or `examples/` directories.

**Declare `allowed-tools`.** Every tool call without pre-approval triggers a permission dialog. Specifying `Bash(npm run *) Read Glob` for a test runner skill makes it feel seamless. Use specific patterns — `Bash(npm run *)` not `Bash(*)`.

**Use shell injection for live data.** Skills are shared across machines and teammates. Don't assume the Node version, the package manager, or the current branch. Use `` !`...` `` to inject actual state.

**Gate destructive operations.** For irreversible actions, use `disable-model-invocation: true` and require explicit confirmation in the skill body. Never let a destructive skill auto-fire from a vague trigger.

**Use imperative form.** "Run the test suite" is clearer than "You should run the test suite". Saves tokens, reduces ambiguity.

---

## Checklist: Before Shipping a Skill

**Structure**
- [ ] Skill is in its own directory (`.claude/skills/<name>/SKILL.md`)
- [ ] Chose the right scope: personal, project, or plugin
- [ ] Large instruction sets split into supporting files

**Frontmatter**
- [ ] `description` present with specific trigger phrases
- [ ] `allowed-tools` declared for all tools the skill needs
- [ ] `argument-hint` set if the skill takes arguments
- [ ] `disable-model-invocation: true` for destructive operations

**Content**
- [ ] Instructions in imperative form
- [ ] SKILL.md body under ~400 lines
- [ ] Shell injection used instead of static assumptions
- [ ] `$ARGUMENTS` or `$0/$1` used where needed

**Safety**
- [ ] Destructive skills require explicit user confirmation
- [ ] `allowed-tools` uses specific patterns, not `Bash(*)`
- [ ] No secrets hardcoded in SKILL.md

---

## Further Reading

- **[Official skills reference](https://code.claude.com/docs/en/skills)** — frontmatter fields, variables, invocation modes
- **[Claude Code customization](https://docs.anthropic.com/en/docs/claude-code/customization)** — rules, hooks, agents, settings
- **[Claude Code from Source](https://claude-code-from-source.com/)** — technical internals, chapter 12 covers extensibility
- **[Interactive version of this guide](/guides/claude-skills)** — clickable examples and a live checklist
