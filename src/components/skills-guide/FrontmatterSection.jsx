import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SectionWrapper, SectionLabel, SectionTitle, Lead, CodeBlock, Callout, FadeIn, Badge } from './shared'


const fields = [
  {
    id: 'name',
    field: 'name',
    type: 'string',
    required: false,
    label: 'name',
    tier: 'basic',
    color: 'var(--blue)',
    summary: 'Display label (not the slash command name)',
    detail: 'The name field is for display purposes only. The actual /command-name comes from the directory name. Use name for human-readable labels in help menus.',
    example: `---
name: Deploy to Production
description: Deploy the app to production
---`,
    note: 'The directory is .claude/skills/deploy/, so the command is /deploy regardless of what name says.',
  },
  {
    id: 'description',
    field: 'description',
    type: 'string (max 1,536 chars)',
    required: true,
    label: 'description ★',
    tier: 'basic',
    color: 'var(--accent)',
    summary: 'The activation engine — Claude reads this to decide when to auto-invoke',
    detail: 'This is the most critical field. Claude loads all skill descriptions into context at startup. When the conversation matches, Claude auto-invokes the skill. Write it in third person, include specific trigger phrases users would actually say.',
    example: `---
description: |
  This skill deploys the application. Use when the user says
  "deploy", "ship to prod", "release", or asks to push to
  production or staging. Handles build, tests, and deployment.
---`,
    note: 'Combined with when_to_use, the hard cap is 1,536 characters. After that, Claude silently truncates.',
  },
  {
    id: 'when_to_use',
    field: 'when_to_use',
    type: 'string',
    required: false,
    label: 'when_to_use',
    tier: 'basic',
    color: 'var(--accent)',
    summary: 'Additional trigger text, appended to description',
    detail: 'Overflow for description when you need more trigger phrases. Counts toward the same 1,536-char limit.',
    example: `---
description: Reviews code for quality issues.
when_to_use: Also invoke when the user asks to "check my PR",
  "look at this diff", or "give me feedback on the code".
---`,
    note: 'Think of description as "what it does" and when_to_use as "extra situations where it should fire".',
  },
  {
    id: 'allowed-tools',
    field: 'allowed-tools',
    type: 'space-separated list',
    required: false,
    label: 'allowed-tools',
    tier: 'intermediate',
    color: 'var(--green)',
    summary: 'Pre-approve tools — no permission prompt while this skill runs',
    detail: 'Specify which tools Claude can use without asking. Supports patterns like Bash(git *) to allow only git subcommands. The permission is only active while the skill is running.',
    example: '---\nallowed-tools: Bash(git *) Bash(npm test) Read Glob Grep\n---\n\nRun tests with !`npm test`, check git status, read files.\nClaude won\'t ask for permission for any of the listed tools.',
    note: 'Use Bash(command *) to restrict which bash commands are allowed. Bash(*) allows all bash — use with care.',
  },
  {
    id: 'disallowed-tools',
    field: 'disallowed-tools',
    type: 'space-separated list',
    required: false,
    label: 'disallowed-tools',
    tier: 'intermediate',
    color: 'var(--red)',
    summary: 'Block tools during this skill (resets after next message)',
    detail: 'Prevent Claude from using specific tools while the skill is running. Useful for read-only audit skills where you never want writes.',
    example: `---
name: audit
description: Read-only security audit skill
disallowed-tools: Write Edit WebFetch
---

Review the codebase for security issues. Only read — never write.`,
    note: 'Restrictions clear after the next user message, not after the skill finishes.',
  },
  {
    id: 'argument-hint',
    field: 'argument-hint',
    type: 'string',
    required: false,
    label: 'argument-hint',
    tier: 'intermediate',
    color: 'var(--text-muted)',
    summary: 'Shown in autocomplete when the user types /skill-name',
    detail: 'Pure UX sugar. Displayed in the command palette to help users know what arguments to pass.',
    example: `---
argument-hint: "[environment] [--dry-run]"
---

# Shows as: /deploy [environment] [--dry-run]`,
    note: 'Square brackets conventionally mean optional, angle brackets mean required. This is just a hint — not enforced.',
  },
  {
    id: 'disable-model-invocation',
    field: 'disable-model-invocation',
    type: 'boolean',
    required: false,
    label: 'disable-model-invocation',
    tier: 'advanced',
    color: 'var(--orange)',
    summary: 'Prevent Claude from auto-invoking — only the user can trigger it',
    detail: 'By default, Claude auto-invokes skills whose description matches the conversation. Set this to true to require explicit /skill-name invocation. The description is NOT loaded into context when this is true.',
    example: `---
disable-model-invocation: true
description: Destructive cleanup — removes all Docker containers
---

# Only runs when user explicitly types /cleanup-docker
# Claude will never auto-trigger this`,
    note: 'Use for destructive operations where you never want accidental auto-invocation.',
  },
  {
    id: 'user-invocable',
    field: 'user-invocable',
    type: 'boolean',
    required: false,
    label: 'user-invocable',
    tier: 'advanced',
    color: 'var(--orange)',
    summary: 'Hide from / menu — Claude can auto-invoke but user can\'t type it',
    detail: 'Hidden skills are invisible to the user but their description stays in context so Claude can trigger them. Useful for background knowledge or assistant behaviors you want active but not surfaced.',
    example: `---
user-invocable: false
description: When the user asks about database queries, always
  remind them to use parameterized queries for SQL injection safety.
---

Remind the user to use parameterized queries.`,
    note: 'Think of user-invocable: false as "Claude-only" behaviors — ambient rules that look like Claude personality.',
  },
  {
    id: 'model',
    field: 'model',
    type: 'string',
    required: false,
    label: 'model',
    tier: 'advanced',
    color: '#ec4899',
    summary: 'Use a specific model for this skill',
    detail: 'Override the session model for this skill. Useful when a skill needs more power (use Opus for complex analysis) or less cost (use Haiku for simple formatting tasks).',
    example: `---
model: claude-opus-4-8
description: Deep architectural review — uses Opus for best analysis
---

Perform a thorough architectural review of $ARGUMENTS.`,
    note: 'Use full model IDs (claude-opus-4-8, claude-sonnet-4-6, claude-haiku-4-5-20251001) or shorthand (opus, sonnet, haiku).',
  },
  {
    id: 'context',
    field: 'context',
    type: 'fork',
    required: false,
    label: 'context: fork',
    tier: 'advanced',
    color: '#ec4899',
    summary: 'Run in an isolated subagent — no conversation history',
    detail: 'The skill runs in a fresh subagent with no memory of the current conversation. Results are returned to the main conversation. Combine with agent: to specify the subagent type.',
    example: `---
context: fork
agent: Explore
description: Deep codebase search — runs in isolated context
---

Search the codebase for: $ARGUMENTS

Return a structured report with file paths and line numbers.`,
    note: 'Useful for long-running searches that would bloat the main context, or for tasks that should be unbiased by conversation history.',
  },
  {
    id: 'paths',
    field: 'paths',
    type: 'glob patterns',
    required: false,
    label: 'paths',
    tier: 'advanced',
    color: 'var(--green)',
    summary: 'Auto-activate only when Claude touches matching files',
    detail: 'The skill description is only added to context when Claude reads or edits files matching the glob patterns. Great for language-specific or layer-specific skills.',
    example: `---
paths: "**/*.test.ts,**/*.spec.ts,**/*.test.tsx"
description: When working with test files, use jest conventions
  and follow our testing standards in testing-guide.md
---

Testing standards to follow:
- describe() for grouping
- it() not test()
- One assertion per test ideally`,
    note: 'Without paths:, the description is always in context. With paths:, it only loads when Claude touches matching files — saves tokens.',
  },
]

const tiers = [
  { id: 'basic', label: 'Basic', color: 'var(--blue)' },
  { id: 'intermediate', label: 'Intermediate', color: 'var(--green)' },
  { id: 'advanced', label: 'Advanced', color: '#ec4899' },
]

export default function FrontmatterSection() {
  const [active, setActive] = useState('description')
  const [filterTier, setFilterTier] = useState(null)

  const field = fields.find(f => f.id === active)
  const filtered = filterTier ? fields.filter(f => f.tier === filterTier) : fields

  return (
    <SectionWrapper id="frontmatter">
      <FadeIn>
        <SectionLabel>Intermediate</SectionLabel>
        <SectionTitle>Frontmatter Reference</SectionTitle>
        <Lead>
          The YAML frontmatter at the top of SKILL.md controls how the skill behaves.
          Click any field to see what it does, when to use it, and a real example.
        </Lead>
      </FadeIn>

      {/* Tier filter */}
      <FadeIn delay={0.1}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterTier(null)}
            style={{
              padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${!filterTier ? 'var(--accent)' : 'var(--border)'}`,
              background: !filterTier ? 'rgba(99,102,241,0.12)' : 'transparent',
              color: !filterTier ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            All fields
          </button>
          {tiers.map(t => (
            <button
              key={t.id}
              onClick={() => setFilterTier(t.id)}
              style={{
                padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${filterTier === t.id ? t.color : 'var(--border)'}`,
                background: filterTier === t.id ? `${t.color}18` : 'transparent',
                color: filterTier === t.id ? t.color : 'var(--text-muted)',
                fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </FadeIn>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20 }}>
        {/* Field list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map(f => (
            <button
              key={f.id}
              onClick={() => setActive(f.id)}
              style={{
                textAlign: 'left', padding: '10px 14px', borderRadius: 8,
                border: `1px solid ${active === f.id ? f.color : 'transparent'}`,
                background: active === f.id ? `${f.color}12` : 'transparent',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <div style={{
                fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
                color: active === f.id ? f.color : 'var(--text)',
              }}>
                {f.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                {f.summary}
              </div>
            </button>
          ))}
        </div>

        {/* Field detail */}
        <AnimatePresence mode="wait">
          {field && (
            <motion.div
              key={active}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 24, alignSelf: 'flex-start',
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <code style={{
                  fontFamily: 'monospace', fontSize: 16, fontWeight: 700,
                  color: field.color,
                }}>
                  {field.field}:
                </code>
                <Badge color={field.color}>{field.type}</Badge>
                {field.required && <Badge color="var(--red)">required</Badge>}
                <Badge color={tiers.find(t => t.id === field.tier)?.color}>{field.tier}</Badge>
              </div>

              <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, marginBottom: 20 }}>
                {field.detail}
              </p>

              <CodeBlock code={field.example} filename="example" />

              <div style={{
                padding: '10px 14px', background: 'rgba(99,102,241,0.07)',
                borderRadius: 8, borderLeft: '3px solid var(--accent)',
                fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6,
              }}>
                <strong style={{ color: 'var(--accent)' }}>Note:</strong> {field.note}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SectionWrapper>
  )
}
