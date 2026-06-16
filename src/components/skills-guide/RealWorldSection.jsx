import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Rocket, Shield, FileSearch, GitPullRequest, Database, Wrench } from 'lucide-react'
import { SectionWrapper, SectionLabel, SectionTitle, Lead, CodeBlock, Callout, FadeIn, Badge } from './shared'

const skills = [
  {
    id: 'deploy',
    icon: <Rocket size={18} />,
    color: 'var(--accent)',
    name: '/deploy',
    category: 'DevOps',
    difficulty: 'intermediate',
    tagline: 'Deploy with safety checks and checklist',
    description: 'A deploy skill that runs tests, checks a safety checklist, and deploys to the specified environment. Includes shell injection to get the current branch and last commit.',
    files: {
      'SKILL.md': `---
name: deploy
description: Deploy the application to staging or production.
  Use when user says "deploy", "ship", "release", or "push to prod".
argument-hint: "[staging|production] [--dry-run]"
allowed-tools: Bash(npm *) Bash(git *) Bash(gh *)
---

Deploy $0 for branch !\`git branch --show-current\`.
Last commit: !\`git log -1 --oneline\`

## Pre-deploy checks
Review the checklist in checklist.md before proceeding.

## Steps
1. Run \`npm test\` — abort if any test fails
2. Run \`npm run build\`
3. If $0 is "production", ask for final confirmation
4. Run \`npm run deploy:$0\`
5. Verify health check at the deployed URL
6. Report result with deployment URL

$1 flag: if "--dry-run", simulate only — don't deploy.`,
      'checklist.md': `# Pre-deploy Checklist

- [ ] All tests pass locally
- [ ] No console.error in the browser
- [ ] Environment variables set in target env
- [ ] Database migrations are backwards-compatible
- [ ] Rollback plan identified
- [ ] Feature flags configured (if applicable)`,
    },
  },
  {
    id: 'security',
    icon: <Shield size={18} />,
    color: 'var(--red)',
    name: '/security-audit',
    category: 'Security',
    difficulty: 'advanced',
    tagline: 'Isolated OWASP-based security review',
    description: 'Runs in an isolated forked context so previous conversation doesn\'t bias the audit. Checks OWASP Top 10, reports findings with severity levels.',
    files: {
      'SKILL.md': `---
name: security-audit
description: Run a security audit on the codebase or a specific file.
  Use when user asks for security review, vulnerability check, or OWASP audit.
context: fork
model: claude-opus-4-8
argument-hint: "[path or 'all']"
allowed-tools: Read Glob Grep
---

Perform a security audit on: $ARGUMENTS (default: entire codebase)

Use the OWASP checklist in owasp-checklist.md as your guide.

## Report format
For each finding:
- **Severity**: Critical / High / Medium / Low
- **Location**: file:line
- **Issue**: what the vulnerability is
- **Fix**: concrete remediation

Be conservative — only report actual issues, not theoretical risks.
Sort by severity (Critical first).`,
      'owasp-checklist.md': `# OWASP Top 10 Checklist

## A01 - Broken Access Control
- Check for missing authorization on sensitive endpoints
- Look for insecure direct object references (IDOR)
- Verify CORS configuration

## A02 - Cryptographic Failures
- Look for hardcoded secrets/API keys
- Check for weak hashing (MD5, SHA1 for passwords)
- Verify TLS is enforced

## A03 - Injection
- SQL injection in query builders
- Command injection via exec/spawn
- XSS via unescaped user content

## A04 - Insecure Design
- Missing rate limiting on sensitive endpoints
- No input validation at boundaries
- Lack of output encoding

## A07 - Authentication Failures
- Weak session management
- Missing brute-force protection
- JWT vulnerabilities`,
    },
  },
  {
    id: 'pr-review',
    icon: <GitPullRequest size={18} />,
    color: 'var(--green)',
    name: '/review',
    category: 'Code Quality',
    difficulty: 'basic',
    tagline: 'PR review with project conventions loaded',
    description: 'Reviews the current diff against your project\'s coding conventions. Injects the actual diff via shell so Claude always has fresh content.',
    files: {
      'SKILL.md': `---
name: review
description: Review the current diff or PR for code quality.
  Use when user says "review", "check my code", "look at this PR".
allowed-tools: Bash(git *) Bash(gh *) Read
---

Code review for: !\`git log -1 --oneline\`

## Diff
\`\`\`!
git diff HEAD~1
\`\`\`

## Open PR (if any)
!\`gh pr view --json title,body,comments --jq '.title' 2>/dev/null || echo "No PR"\`

Review against the standards in conventions.md.

Focus on:
1. Correctness — does it do what it says?
2. Tests — are edge cases covered?
3. Conventions — follows project patterns?
4. Performance — obvious inefficiencies?

Be direct. "This has a null pointer on line 42" not "Consider checking for null".`,
      'conventions.md': `# Project Conventions

## TypeScript
- Use strict mode (strict: true in tsconfig)
- Prefer type over interface for simple types
- Avoid any — use unknown and narrow

## React
- Functional components only
- useMemo/useCallback only when profiler shows need
- Extract hooks for shared logic, not for abstraction

## Tests
- Unit test for pure functions
- Integration test for API endpoints
- E2E for critical user flows only

## Naming
- Components: PascalCase
- Hooks: useXxx
- Utils: camelCase
- Constants: SCREAMING_SNAKE`,
    },
  },
  {
    id: 'db-migrate',
    icon: <Database size={18} />,
    color: 'var(--orange)',
    name: '/db-migrate',
    category: 'Database',
    difficulty: 'intermediate',
    tagline: 'Generate safe, reversible migrations',
    description: 'Helps create database migrations that are safe under concurrent writes. Reads current schema and produces both up and down migrations.',
    files: {
      'SKILL.md': `---
name: db-migrate
description: Generate a database migration. Use when user wants to add
  a column, create a table, add an index, or change the schema.
argument-hint: "<description of change>"
allowed-tools: Bash(npx prisma *) Read Glob
---

Generate a migration for: $ARGUMENTS

## Current schema
!\`cat prisma/schema.prisma\`

## Existing migrations
!\`ls prisma/migrations/ | tail -10\`

## Requirements (MUST follow)
1. All migrations must be reversible — include a down migration
2. Adding NOT NULL columns: always provide a DEFAULT for backfill
3. Removing columns: two-step (nullable first, remove later)
4. Adding indexes: use CONCURRENTLY on Postgres to avoid table locks
5. Never rename columns — add new + copy + remove old

Output both the migration file and the Prisma schema change.`,
    },
  },
  {
    id: 'docs',
    icon: <FileSearch size={18} />,
    color: '#ec4899',
    name: '/docs',
    category: 'Documentation',
    difficulty: 'basic',
    tagline: 'Generate or update documentation',
    description: 'Reads the code and generates or updates documentation. Supports JSDoc, README sections, and API docs. Uses file-conditional activation for docs files.',
    files: {
      'SKILL.md': `---
name: docs
description: Generate or update documentation for a file, function,
  or module. Use when user asks to "document", "add JSDoc", "write README".
argument-hint: "[file or function name]"
allowed-tools: Read Glob Write Edit
---

Generate documentation for: $ARGUMENTS

## Doc style guide
- JSDoc for TypeScript/JavaScript functions
- Use @param, @returns, @throws, @example
- One-line summary, then detail paragraph only if non-obvious
- Never describe WHAT the code does — only WHY and non-obvious behavior
- For READMEs: lead with usage, not installation

## Example output style
\`\`\`typescript
/**
 * Finds users by search query across name and email fields.
 * Case-insensitive. Returns empty array if no matches.
 *
 * @param query - Search term (minimum 2 characters)
 * @returns Matching users ordered by relevance
 * @throws {ValidationError} If query is less than 2 characters
 */
\`\`\``,
    },
  },
  {
    id: 'debug',
    icon: <Wrench size={18} />,
    color: 'var(--blue)',
    name: '/debug',
    category: 'Debugging',
    difficulty: 'intermediate',
    tagline: 'Structured debugging with hypothesis tracking',
    description: 'A debugging skill that forces a structured approach: form hypotheses, test them, report findings. Prevents the aimless "try stuff" debugging pattern.',
    files: {
      'SKILL.md': `---
name: debug
description: Debug a bug or unexpected behavior. Use when user says
  "this is broken", "not working", "getting an error", or pastes a stack trace.
argument-hint: "<description of the bug>"
---

Debug: $ARGUMENTS

## Structured debugging protocol

### Step 1: Reproduce
Can you reliably reproduce it? If not, identify the conditions.

### Step 2: Form 3 hypotheses
Before touching any code, list exactly 3 possible causes,
from most to least likely. Explain your reasoning.

### Step 3: Test the top hypothesis first
Use logs, breakpoints, or code inspection to confirm/deny.
Do NOT test all hypotheses at once.

### Step 4: Report
- Root cause (confirmed, not guessed)
- Fix
- Why the fix is correct
- Any regression risk

IMPORTANT: Never "try" a fix without first confirming the root cause.`,
    },
  },
]

function FileTabViewer({ files }) {
  const tabs = Object.keys(files)
  const [active, setActive] = useState(tabs[0])

  return (
    <div style={{ background: '#0d1117', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            style={{
              padding: '8px 16px', cursor: 'pointer',
              border: 'none',
              borderBottom: `2px solid ${active === tab ? 'var(--accent)' : 'transparent'}`,
              background: 'transparent',
              color: active === tab ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'monospace', fontSize: 12, fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      <pre style={{
        margin: 0, padding: '16px 20px',
        fontFamily: 'monospace', fontSize: 12.5, lineHeight: 1.7,
        color: 'var(--text)', overflowX: 'auto',
        maxHeight: 360, overflowY: 'auto',
      }}>
        <code>{files[active]}</code>
      </pre>
    </div>
  )
}

const difficultyColors = {
  basic: 'var(--green)',
  intermediate: 'var(--orange)',
  advanced: 'var(--red)',
}

export default function RealWorldSection() {
  const [active, setActive] = useState('deploy')
  const skill = skills.find(s => s.id === active)

  return (
    <SectionWrapper id="real-world" style={{ background: 'var(--bg)' }}>
      <FadeIn>
        <SectionLabel>Examples</SectionLabel>
        <SectionTitle>Real-World Skills</SectionTitle>
        <Lead>
          Six production-ready skills you can copy and adapt. Each one demonstrates
          a different pattern — from simple commands to isolated auditors with multi-file layouts.
        </Lead>
      </FadeIn>

      {/* Skill selector */}
      <FadeIn delay={0.1}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 32 }}>
          {skills.map(s => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              style={{
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${active === s.id ? s.color : 'var(--border)'}`,
                background: active === s.id ? `${s.color}10` : 'var(--surface)',
                textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <div style={{ color: active === s.id ? s.color : 'var(--text-muted)', marginBottom: 6 }}>
                {s.icon}
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace', color: active === s.id ? s.color : 'var(--text)' }}>
                {s.name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                {s.category}
              </div>
            </button>
          ))}
        </div>
      </FadeIn>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <code style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: skill.color }}>
              {skill.name}
            </code>
            <Badge color={difficultyColors[skill.difficulty]}>{skill.difficulty}</Badge>
            <Badge color="var(--text-muted)">{skill.category}</Badge>
            {Object.keys(skill.files).length > 1 && (
              <Badge color="var(--accent)">{Object.keys(skill.files).length} files</Badge>
            )}
          </div>

          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 20 }}>
            {skill.description}
          </p>

          <FileTabViewer files={skill.files} />
        </motion.div>
      </AnimatePresence>
    </SectionWrapper>
  )
}
