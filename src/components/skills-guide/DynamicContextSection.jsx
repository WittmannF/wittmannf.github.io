import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, RefreshCw } from 'lucide-react'
import { SectionWrapper, SectionLabel, SectionTitle, Lead, CodeBlock, Callout, FadeIn } from './shared'

const examples = [
  {
    id: 'inline',
    title: 'Inline shell injection',
    description: 'Inject command output directly into skill text.',
    skill: `---
name: review-pr
description: Review the current pull request
allowed-tools: Bash(git *) Read Grep
---

Review the current PR.

## Changed files
!\`git diff --name-only HEAD~1\`

## PR description
!\`gh pr view --json title,body --jq '.title + "\\n\\n" + .body'\`

Check each changed file for correctness, style, and tests.`,
    output: [
      '## Changed files',
      'src/api/users.ts',
      'src/api/users.test.ts',
      '',
      '## PR description',
      'feat: add user search endpoint',
      '',
      'Adds GET /users?q=<query> for searching users by name',
    ],
    explanation: 'The !`...` blocks run before Claude sees the skill. Output replaces the placeholder as plain text.',
  },
  {
    id: 'multiline',
    title: 'Multi-line shell block',
    description: 'Run multiple commands in one fenced block.',
    skill: `---
name: env-check
description: Check the current environment before any task
---

## Environment info
\`\`\`!
node --version
npm --version
git log --oneline -5
\`\`\`

Based on the above environment, continue with the task.`,
    output: [
      '## Environment info',
      'v22.3.0',
      '10.8.1',
      'a1b2c3d feat: add search',
      'f9e8d7c fix: null pointer',
      'c3d4e5f refactor: extract utils',
      'b1c2d3e docs: update README',
      '...and 1 more',
    ],
    explanation: 'A fenced ``` block with ! runs all lines and injects combined output. Great for environment setup context.',
  },
  {
    id: 'file-content',
    title: 'Inject file contents',
    description: 'Read project files to give Claude up-to-date context.',
    skill: `---
name: review-schema
description: Review database schema changes
---

## Current schema
!\`cat prisma/schema.prisma\`

## Recent migrations
!\`ls prisma/migrations/ | tail -5\`

Review the schema for normalization, indexes, and naming conventions.`,
    output: [
      '## Current schema',
      'datasource db { provider = "postgresql" }',
      'model User { id Int @id ... }',
      '',
      '## Recent migrations',
      '20240101_create_users',
      '20240215_add_user_roles',
      '20240301_add_audit_log',
    ],
    explanation: 'Use cat, jq, or any shell command to inject file contents. Claude gets fresh data, not stale cached content.',
  },
]

function SimulatedOutput({ lines }) {
  return (
    <div style={{
      background: '#0d1117', borderRadius: 10, border: '1px solid var(--border)',
      padding: '16px 20px', fontFamily: 'monospace', fontSize: 13,
    }}>
      <div style={{
        fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.8,
        textTransform: 'uppercase', marginBottom: 12, fontFamily: 'sans-serif',
        fontWeight: 700,
      }}>
        → Injected into skill context:
      </div>
      {lines.map((l, i) => (
        <div key={i} style={{
          color: l === '' ? 'transparent' : 'var(--green)',
          lineHeight: 1.6, marginBottom: 2,
          fontSize: 12,
        }}>
          {l || '·'}
        </div>
      ))}
    </div>
  )
}

export default function DynamicContextSection() {
  const [active, setActive] = useState('inline')
  const [showOutput, setShowOutput] = useState(false)
  const example = examples.find(e => e.id === active)

  const handleSelect = (id) => {
    setActive(id)
    setShowOutput(false)
  }

  return (
    <SectionWrapper id="dynamic-context">
      <FadeIn>
        <SectionLabel>Intermediate</SectionLabel>
        <SectionTitle>Dynamic Context Injection</SectionTitle>
        <Lead>
          Skills can run shell commands before Claude sees the content. Use{' '}
          <code style={{ fontFamily: 'monospace', fontSize: 15, background: 'rgba(99,102,241,0.12)', padding: '2px 6px', borderRadius: 4 }}>
            !`command`
          </code>{' '}
          to inject live data — git diffs, file contents, environment info — so Claude
          always works with fresh context, not stale instructions.
        </Lead>
      </FadeIn>

      {/* Example picker */}
      <FadeIn delay={0.1}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {examples.map(e => (
            <button
              key={e.id}
              onClick={() => handleSelect(e.id)}
              style={{
                padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${active === e.id ? 'var(--accent)' : 'var(--border)'}`,
                background: active === e.id ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: active === e.id ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
              }}
            >
              {e.title}
            </button>
          ))}
        </div>
      </FadeIn>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 24, marginBottom: 20,
          }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              {example.title}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              {example.description}
            </p>

            <CodeBlock code={example.skill} filename="SKILL.md" />

            <button
              onClick={() => setShowOutput(!showOutput)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid var(--border)',
                background: showOutput ? 'rgba(16,185,129,0.08)' : 'var(--surface)',
                color: showOutput ? 'var(--green)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: 13, marginBottom: showOutput ? 16 : 0,
                transition: 'all 0.15s',
              }}
            >
              {showOutput ? <RefreshCw size={14} /> : <Play size={14} />}
              {showOutput ? 'Hide output' : 'See what Claude receives'}
            </button>

            <AnimatePresence>
              {showOutput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: 'hidden' }}
                >
                  <SimulatedOutput lines={example.output} />
                  <div style={{
                    marginTop: 12, fontSize: 13, color: 'var(--text-muted)',
                    lineHeight: 1.6, fontStyle: 'italic',
                  }}>
                    {example.explanation}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>

      <FadeIn delay={0.2}>
        <Callout type="warning" icon="⚠️">
          <strong>Shell injection runs once at skill load, not on each message.</strong>{' '}
          If you need truly live data within a conversation, use{' '}
          <code style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(245,158,11,0.12)', padding: '1px 5px', borderRadius: 4 }}>
            allowed-tools: Bash(...)
          </code>{' '}
          and let Claude run the commands explicitly during the conversation.
        </Callout>

        <Callout type="danger" icon="🔒">
          <strong>Org policy note:</strong> Organizations can disable shell injection globally
          with <code style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(239,68,68,0.12)', padding: '1px 5px', borderRadius: 4 }}>disableSkillShellExecution: true</code>{' '}
          in managed settings. If your <code>!`cmd`</code> blocks aren&#39;t running, check this setting.
        </Callout>
      </FadeIn>
    </SectionWrapper>
  )
}
