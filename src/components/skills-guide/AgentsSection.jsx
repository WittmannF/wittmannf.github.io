import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, ArrowRight } from 'lucide-react'
import { SectionWrapper, SectionLabel, SectionTitle, Lead, CodeBlock, Callout, FadeIn, Badge } from './shared'

const comparisons = [
  { aspect: 'File location', skill: '.claude/skills/<name>/SKILL.md', agent: '.claude/agents/<name>.md' },
  { aspect: 'How to invoke', skill: '/skill-name or auto', agent: 'Claude delegates to it' },
  { aspect: 'Conversation history', skill: 'Shares main context', agent: 'Own isolated context' },
  { aspect: 'Tools', skill: 'Main Claude\'s tools', agent: 'Own tool whitelist' },
  { aspect: 'Model', skill: 'Can override', agent: 'Can override, separately' },
  { aspect: 'Best for', skill: 'Reusable workflows, commands', agent: 'Specialist tasks, analysis' },
]

const agentExamples = [
  {
    id: 'security',
    name: 'security-reviewer',
    color: 'var(--red)',
    description: 'An isolated security reviewer. Claude delegates to it automatically when it detects security-relevant code changes.',
    code: `---
name: security-reviewer
description: |
  Security specialist agent. Claude should delegate to this agent
  when reviewing code that handles: authentication, authorization,
  user input, database queries, file operations, or cryptography.
  Also invoke for any PR that touches security-sensitive paths.
tools: Read Glob Grep
model: claude-opus-4-8
---

You are a senior application security engineer with 10+ years of experience.

Review the provided code exclusively for security issues.

## What to look for
- Injection vulnerabilities (SQL, command, XSS, SSTI)
- Authentication/authorization bypasses
- Sensitive data exposure (logs, responses, storage)
- Insecure dependencies (check package versions)
- Cryptographic misuse
- Path traversal and SSRF

## Report format
For each finding, output:

**[SEVERITY]** Brief title
- Location: file:line
- Issue: What exactly is wrong
- Exploit: How an attacker would use this
- Fix: Concrete remediation (code preferred)

Severity scale: CRITICAL > HIGH > MEDIUM > LOW > INFO

If no issues found, say "No security issues found" — don't invent problems.`,
  },
  {
    id: 'architect',
    name: 'architect',
    color: 'var(--accent)',
    description: 'An architecture advisor. Gets spawned for design questions and returns a structured analysis with tradeoffs.',
    code: `---
name: architect
description: |
  Software architecture advisor. Invoke when user asks about
  system design, architecture choices, scaling, or asks
  "how should I structure this?", "what's the best approach?"
tools: Read Glob WebFetch
model: claude-opus-4-8
---

You are a staff software engineer specializing in system design.

When presented with a design question:

1. **Clarify constraints** — scale, team size, latency requirements, budget
2. **Enumerate options** — list 2-4 viable approaches
3. **Analyze tradeoffs** — for each: pros, cons, when it shines, when it breaks
4. **Recommend** — state your recommendation clearly with reasoning
5. **Migration path** — if there's an existing system, outline the migration

Be opinionated. "It depends" is only acceptable if you explain what it depends on
and how to make the call.`,
  },
  {
    id: 'test-writer',
    name: 'test-writer',
    color: 'var(--green)',
    description: 'Auto-generates tests for new code. Claude delegates to it after writing new functions or components.',
    code: `---
name: test-writer
description: |
  Generates tests for new code. Claude should delegate to this
  agent after writing any new function, component, or API endpoint.
  Also invoke when user asks to "add tests" or "write unit tests".
tools: Read Write Edit Glob Grep
model: claude-sonnet-4-6
---

You write high-quality tests for the provided code.

## Testing philosophy
- Test behavior, not implementation
- One assertion per test (prefer)
- Tests should read like documentation
- Cover: happy path, edge cases, error cases

## Format
\`\`\`typescript
describe('functionName', () => {
  it('should <expected behavior> when <condition>', () => {
    // arrange
    // act
    // assert
  })
})
\`\`\`

Read the file, understand the function signatures, write tests.
Place tests in the same directory as the source file (*.test.ts).`,
  },
]

export default function AgentsSection() {
  const [active, setActive] = useState('security')
  const agent = agentExamples.find(a => a.id === active)

  return (
    <SectionWrapper id="agents">
      <FadeIn>
        <SectionLabel>Advanced</SectionLabel>
        <SectionTitle>Custom Agents</SectionTitle>
        <Lead>
          Agents are isolated specialists that Claude can delegate to. Unlike skills,
          agents have their own context, their own tool whitelist, and can use a different
          model. Claude decides when to use them based on the description.
        </Lead>
      </FadeIn>

      {/* Skills vs Agents comparison */}
      <FadeIn delay={0.1}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
          Skills vs Agents — When to Use Which
        </h3>
        <div style={{ marginBottom: 40, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            background: 'var(--surface2)', padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            letterSpacing: 0.8, textTransform: 'uppercase',
          }}>
            <span>Aspect</span>
            <span>Skill</span>
            <span>Agent</span>
          </div>
          {comparisons.map((c, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              padding: '11px 16px',
              background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)',
              borderBottom: i < comparisons.length - 1 ? '1px solid var(--border)' : 'none',
              fontSize: 13, gap: 12, alignItems: 'start',
            }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{c.aspect}</span>
              <span style={{ color: 'var(--text)', lineHeight: 1.5 }}>{c.skill}</span>
              <span style={{ color: 'var(--text)', lineHeight: 1.5 }}>{c.agent}</span>
            </div>
          ))}
        </div>
      </FadeIn>

      {/* Agent examples */}
      <FadeIn delay={0.15}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
          Agent Examples
        </h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {agentExamples.map(a => (
            <button
              key={a.id}
              onClick={() => setActive(a.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${active === a.id ? a.color : 'var(--border)'}`,
                background: active === a.id ? `${a.color}12` : 'transparent',
                color: active === a.id ? a.color : 'var(--text-muted)',
                fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
              }}
            >
              <Bot size={14} />
              {a.name}
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
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
            {agent.description}
          </p>
          <CodeBlock code={agent.code} filename={`.claude/agents/${agent.name}.md`} />
        </motion.div>
      </AnimatePresence>

      <FadeIn delay={0.25}>
        <Callout type="info" icon="🤖">
          <strong>Key difference:</strong> A skill loads instructions into Claude's current context.
          An agent creates a <em>new Claude instance</em> with its own context, tools, and model.
          Results come back to the main conversation as a message.
          Use agents for truly isolated specialist work — security audits, architecture reviews,
          or anything that benefits from a clean slate.
        </Callout>
      </FadeIn>
    </SectionWrapper>
  )
}
