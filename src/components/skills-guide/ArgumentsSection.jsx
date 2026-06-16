import { useState } from 'react'
import { motion } from 'framer-motion'
import { SectionWrapper, SectionLabel, SectionTitle, Lead, CodeBlock, Callout, FadeIn } from './shared'

const variables = [
  {
    name: '$ARGUMENTS',
    desc: 'All arguments as a single string',
    example: '/deploy staging --force',
    resolves: 'staging --force',
    color: 'var(--accent)',
  },
  {
    name: '$0',
    desc: 'First argument (0-based indexing)',
    example: '/deploy staging --force',
    resolves: 'staging',
    color: 'var(--green)',
  },
  {
    name: '$1',
    desc: 'Second argument',
    example: '/deploy staging --force',
    resolves: '--force',
    color: 'var(--green)',
  },
  {
    name: '$name',
    desc: 'Named arg (from arguments: frontmatter)',
    example: '/migrate Button React Vue',
    resolves: 'Button (if arguments: [component, from, to])',
    color: 'var(--orange)',
  },
  {
    name: '${CLAUDE_SKILL_DIR}',
    desc: 'Absolute path to the skill\'s directory',
    example: 'n/a (always resolved)',
    resolves: '/path/to/.claude/skills/deploy',
    color: '#ec4899',
  },
  {
    name: '${CLAUDE_SESSION_ID}',
    desc: 'Current session identifier',
    example: 'n/a (always resolved)',
    resolves: 'sess_abc123...',
    color: '#ec4899',
  },
]

function ArgDemo() {
  const [input, setInput] = useState('staging --dry-run')
  const parts = input.trim().split(/\s+/).filter(Boolean)
  const arg0 = parts[0] || ''
  const arg1 = parts[1] || ''

  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 24, marginBottom: 24,
    }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
        Type arguments to see how variables resolve:
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: '#0d1117', borderRadius: 8, border: '1px solid var(--border)',
        overflow: 'hidden', marginBottom: 20,
      }}>
        <div style={{
          padding: '10px 14px', fontFamily: 'monospace', fontSize: 14,
          color: 'var(--text-muted)', background: 'var(--surface)', flexShrink: 0,
          borderRight: '1px solid var(--border)',
        }}>
          /deploy
        </div>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="staging --dry-run"
          style={{
            flex: 1, padding: '10px 14px', fontFamily: 'monospace', fontSize: 14,
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)',
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        {[
          { var: '$ARGUMENTS', val: input || '(empty)' },
          { var: '$0', val: arg0 || '(empty)' },
          { var: '$1', val: arg1 || '(empty)' },
        ].map(({ var: v, val }) => (
          <div key={v} style={{
            background: 'var(--surface)', borderRadius: 8,
            border: '1px solid var(--border)', padding: '12px 14px',
          }}>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)', fontWeight: 700, marginBottom: 6 }}>
              {v}
            </div>
            <div style={{
              fontFamily: 'monospace', fontSize: 13, color: 'var(--text)',
              wordBreak: 'break-all',
            }}>
              {val}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ArgumentsSection() {
  const [activeVar, setActiveVar] = useState(0)

  return (
    <SectionWrapper id="arguments" style={{ background: 'var(--bg)' }}>
      <FadeIn>
        <SectionLabel>Intermediate</SectionLabel>
        <SectionTitle>Arguments & Variables</SectionTitle>
        <Lead>
          Skills receive arguments from the user and have access to built-in variables.
          Understanding how these work unlocks dynamic, context-aware skill behavior.
        </Lead>
      </FadeIn>

      <FadeIn delay={0.1}>
        <ArgDemo />
      </FadeIn>

      {/* Variable reference table */}
      <FadeIn delay={0.15}>
        <div style={{ marginBottom: 40 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '160px 1fr 1fr',
            background: 'var(--surface2)', padding: '10px 16px',
            borderRadius: '8px 8px 0 0', border: '1px solid var(--border)',
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            letterSpacing: 0.8, textTransform: 'uppercase', gap: 12,
          }}>
            <span>Variable</span>
            <span>Description</span>
            <span>Example value</span>
          </div>
          {variables.map((v, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '160px 1fr 1fr',
              padding: '12px 16px',
              border: '1px solid var(--border)', borderTop: 'none',
              background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)',
              gap: 12, alignItems: 'start',
            }}>
              <code style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: v.color }}>
                {v.name}
              </code>
              <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{v.desc}</span>
              <code style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                {v.resolves}
              </code>
            </div>
          ))}
        </div>
      </FadeIn>

      {/* Named arguments */}
      <FadeIn delay={0.2}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          Named Arguments
        </h3>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
          When positional indices are confusing, declare named arguments in the frontmatter.
          They map positionally: first argument → first name, second → second name, etc.
        </p>
        <CodeBlock
          filename=".claude/skills/migrate-component/SKILL.md"
          code={`---
name: migrate-component
description: Migrate a UI component from one framework to another
arguments: [component, from, to]
argument-hint: "<component> <from-framework> <to-framework>"
---

Migrate the $component component from $from to $to.

1. Read the current $component implementation
2. Create an equivalent in $to syntax
3. Update all imports that reference $component
4. Remove the old $from version

Usage: /migrate-component SearchBar React Vue`}
        />

        <Callout type="tip" icon="💡">
          Multi-word arguments use shell quoting:{' '}
          <code style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(99,102,241,0.15)', padding: '1px 5px', borderRadius: 4 }}>
            /deploy "my feature branch" staging
          </code>{' '}
          → <code style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(99,102,241,0.15)', padding: '1px 5px', borderRadius: 4 }}>$0 = "my feature branch"</code>
        </Callout>
      </FadeIn>

      {/* Missing arguments */}
      <FadeIn delay={0.25}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          When $ARGUMENTS Is Not in the Skill Body
        </h3>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
          If you don't reference <code style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(16,185,129,0.12)', padding: '1px 5px', borderRadius: 4 }}>$ARGUMENTS</code> anywhere in SKILL.md,
          the arguments are automatically appended at the end as{' '}
          <code style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(16,185,129,0.12)', padding: '1px 5px', borderRadius: 4 }}>ARGUMENTS: &lt;value&gt;</code>.
          This means simple skills that just receive context still work correctly.
        </p>
        <CodeBlock
          filename="Simple skill — $ARGUMENTS not referenced explicitly"
          code={`---
name: explain
description: Explain a concept clearly
---

Explain the concept in simple terms. Use analogies.
Be concise — under 3 paragraphs.

# When user runs /explain closures
# Claude receives: "Explain the concept..."
# + "ARGUMENTS: closures" appended at the end`}
        />
      </FadeIn>
    </SectionWrapper>
  )
}
