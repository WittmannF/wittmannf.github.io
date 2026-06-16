import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, Eye, Zap, GitBranch } from 'lucide-react'
import { SectionWrapper, SectionLabel, SectionTitle, Lead, CodeBlock, Callout, FadeIn } from './shared'

const types = [
  {
    id: 'explicit',
    icon: <Terminal size={18} />,
    color: 'var(--accent)',
    label: 'Explicit command',
    tagline: 'User types /skill-name',
    description: 'The default mode. Shows in the / menu and is triggered only when the user explicitly invokes it. Best for workflows that should never run automatically.',
    frontmatter: `---
name: deploy
description: Deploy the application to an environment
argument-hint: "[staging|production]"
allowed-tools: Bash(npm run deploy:*) Bash(git *)
---`,
    useWhen: [
      'Deploy, release, or destructive operations',
      'Multi-step workflows that need intentional triggering',
      'Commands that take arguments the user must provide',
    ],
    example: `/deploy staging
/deploy production --tag v2.1.0`,
  },
  {
    id: 'auto',
    icon: <Zap size={18} />,
    color: 'var(--green)',
    label: 'Auto-triggered',
    tagline: 'Claude invokes based on description matching',
    description: 'Claude reads the description at session start and auto-invokes the skill when the conversation context matches. The user never needs to type /skill-name.',
    frontmatter: `---
description: |
  This skill applies when the user is working with database
  queries, SQL, or asks about query optimization. It loads
  SQL best practices and performance guidelines.
user-invocable: false
---`,
    useWhen: [
      'Background knowledge that should silently apply',
      'Domain rules (security, SQL, testing) for specific file types',
      'Coding standards that should always be available',
    ],
    example: `User: "help me write a query to find users who haven't logged in"
→ Claude auto-loads the SQL skill and applies its guidelines`,
  },
  {
    id: 'conditional',
    icon: <Eye size={18} />,
    color: 'var(--orange)',
    label: 'File-conditional',
    tagline: 'Auto-activates only for matching file paths',
    description: 'Use the paths: field to limit auto-activation to certain file patterns. The skill description is only injected when Claude touches matching files, saving tokens.',
    frontmatter: `---
description: When working with test files, apply our testing
  conventions from TESTING.md. Use describe/it, test ids,
  and avoid snapshot testing except for UI components.
paths: "**/*.test.ts,**/*.spec.ts,**/*.test.tsx"
---`,
    useWhen: [
      'Language-specific rules (Python/TypeScript/Go conventions)',
      'Layer-specific standards (API routes, React components, tests)',
      'Large instruction sets that are expensive to keep always in context',
    ],
    example: `# Activates when Claude touches any .test.ts file
# Silent when working on non-test files`,
  },
  {
    id: 'forked',
    icon: <GitBranch size={18} />,
    color: '#ec4899',
    label: 'Forked (isolated)',
    tagline: 'Runs in a fresh subagent, no conversation history',
    description: 'context: fork runs the skill in an isolated subagent. Results are returned to the main conversation, but the subagent has no memory of prior chat. Useful for unbiased analysis or heavy context work.',
    frontmatter: `---
context: fork
agent: Explore
description: Deep codebase search — runs isolated to avoid
  context contamination from the current conversation.
argument-hint: "<what to search for>"
---`,
    useWhen: [
      'Comprehensive searches that would bloat main context',
      'Security audits that should be unbiased by prior conversation',
      'Long-running analysis that takes many tool calls',
    ],
    example: `/deep-search "authentication logic"
# Spawns an isolated Explore agent
# Results come back as a clean report`,
  },
]

export default function SkillTypesSection() {
  const [active, setActive] = useState('explicit')
  const type = types.find(t => t.id === active)

  return (
    <SectionWrapper id="skill-types" style={{ background: 'var(--bg)' }}>
      <FadeIn>
        <SectionLabel>Intermediate</SectionLabel>
        <SectionTitle>Four Invocation Modes</SectionTitle>
        <Lead>
          Skills aren't just slash commands. They can fire automatically, activate
          based on file context, or run in isolated subagents. Pick the right mode
          for the job.
        </Lead>
      </FadeIn>

      {/* Type selector */}
      <FadeIn delay={0.1}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 32 }}>
          {types.map(t => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              style={{
                padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${active === t.id ? t.color : 'var(--border)'}`,
                background: active === t.id ? `${t.color}12` : 'var(--surface)',
                textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <div style={{ color: active === t.id ? t.color : 'var(--text-muted)', marginBottom: 8 }}>
                {t.icon}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: active === t.id ? t.color : 'var(--text)', marginBottom: 4 }}>
                {t.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {t.tagline}
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
          <div style={{
            background: 'var(--surface)', border: `1px solid ${type.color}33`,
            borderRadius: 14, padding: '28px 32px',
          }}>
            <p style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.75, marginBottom: 24 }}>
              {type.description}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: type.color, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
                  Frontmatter pattern
                </div>
                <CodeBlock code={type.frontmatter} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: type.color, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
                  Use when
                </div>
                <div style={{
                  background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)',
                  padding: '16px 18px',
                }}>
                  {type.useWhen.map((w, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < type.useWhen.length - 1 ? 10 : 0, alignItems: 'flex-start' }}>
                      <span style={{ color: type.color, flexShrink: 0 }}>→</span>
                      <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{w}</span>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: type.color, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 16, marginBottom: 10 }}>
                  Example
                </div>
                <div style={{
                  background: '#0d1117', borderRadius: 8, border: '1px solid var(--border)',
                  padding: '12px 16px', fontFamily: 'monospace', fontSize: 12,
                  color: 'var(--text-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap',
                }}>
                  {type.example}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <FadeIn delay={0.25}>
        <div style={{ marginTop: 32 }}>
          <Callout type="tip" icon="📊">
            <strong>Invocation decision tree:</strong>
            <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 12, lineHeight: 2, color: 'var(--text)' }}>
              Should this ever run without user intent? → auto-triggered or file-conditional<br/>
              Does it touch matching file types? → use paths: for file-conditional<br/>
              Is it destructive / needs explicit intent? → explicit command<br/>
              Does it need clean context or heavy search? → forked subagent
            </div>
          </Callout>
        </div>
      </FadeIn>
    </SectionWrapper>
  )
}
