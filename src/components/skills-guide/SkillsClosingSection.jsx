import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import { FadeIn } from './shared'

const resources = [
  {
    label: 'Official Claude Code docs',
    url: 'https://code.claude.com/docs/en/skills',
    desc: 'Skills reference — frontmatter fields, variables, invocation modes',
  },
  {
    label: 'Claude Code customization docs',
    url: 'https://docs.anthropic.com/en/docs/claude-code/customization',
    desc: 'Rules, hooks, agents, settings — the full customization picture',
  },
  {
    label: 'thedotmack plugin (open source)',
    url: 'https://github.com/moazbuilds/claudeclaw',
    desc: 'A production plugin with multi-file skills, references/, examples/ structure',
  },
  {
    label: 'Claude Code from Source (book)',
    url: 'https://claude-code-from-source.com/',
    desc: 'Technical analysis of Claude Code internals — chapter 12 covers extensibility',
  },
]

const learningPath = [
  { step: 1, title: 'First skill', action: 'Create a simple /greet or /explain command', done: true },
  { step: 2, title: 'Add frontmatter', action: 'Improve description, add argument-hint and allowed-tools', done: true },
  { step: 3, title: 'Shell injection', action: 'Use !`...` to inject live git/file context', done: true },
  { step: 4, title: 'Multi-file skill', action: 'Split a large skill into SKILL.md + references/', done: true },
  { step: 5, title: 'Auto-invocation', action: 'Write a skill that fires automatically for SQL or test files', done: false },
  { step: 6, title: 'Custom agent', action: 'Build an isolated specialist (security reviewer, architect)', done: false },
  { step: 7, title: 'Team skill', action: 'Commit a /deploy or /review skill to your project\'s .claude/', done: false },
]

export default function SkillsClosingSection() {
  return (
    <section style={{ padding: '80px 24px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Learning path */}
        <FadeIn>
          <div style={{
            display: 'inline-block', background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20,
            padding: '3px 12px', fontSize: 11, color: 'var(--accent)',
            fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
            marginBottom: 16,
          }}>
            Your path
          </div>
          <h2 style={{
            fontSize: 'clamp(22px, 3.5vw, 36px)', fontWeight: 800,
            letterSpacing: '-0.8px', marginBottom: 12, color: 'var(--text)',
          }}>
            Where to Go from Here
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.7, marginBottom: 40, maxWidth: 600 }}>
            Each step builds on the previous one. The first three you've already seen in this guide.
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div style={{ marginBottom: 64 }}>
            {learningPath.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                style={{
                  display: 'flex', gap: 16, alignItems: 'flex-start',
                  marginBottom: 16,
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step.done ? 'var(--accent)' : 'var(--surface)',
                  border: `2px solid ${step.done ? 'var(--accent)' : 'var(--border)'}`,
                  fontSize: 13, fontWeight: 800,
                  color: step.done ? '#fff' : 'var(--text-muted)',
                }}>
                  {step.done ? '✓' : step.step}
                </div>
                <div style={{
                  flex: 1, background: 'var(--surface)',
                  border: `1px solid ${step.done ? 'rgba(99,102,241,0.25)' : 'var(--border)'}`,
                  borderRadius: 10, padding: '12px 16px',
                }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: step.done ? 'var(--accent)' : 'var(--text)', marginBottom: 3 }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{step.action}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </FadeIn>

        {/* Resources */}
        <FadeIn delay={0.2}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
            Further Reading
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 56 }}>
            {resources.map((r, i) => (
              <motion.a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                style={{
                  display: 'block', textDecoration: 'none',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '16px 18px',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{r.label}</span>
                  <ExternalLink size={12} color="var(--text-muted)" />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{r.desc}</div>
              </motion.a>
            ))}
          </div>
        </FadeIn>

        {/* Final CTA */}
        <FadeIn delay={0.3}>
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            style={{
              textAlign: 'center', padding: '48px 32px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 20,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚙️</div>
            <h3 style={{
              fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800,
              color: 'var(--text)', marginBottom: 12, letterSpacing: '-0.5px',
            }}>
              The best skill is the one you build next
            </h3>
            <p style={{
              fontSize: 16, color: 'var(--text-muted)', maxWidth: 480,
              margin: '0 auto 28px', lineHeight: 1.7,
            }}>
              Every time you catch yourself re-explaining something to Claude, that's a skill
              waiting to be written. Start small, iterate, and share with your team.
            </p>
            <div style={{ fontFamily: 'monospace', fontSize: 14, color: 'var(--accent)' }}>
              mkdir -p .claude/skills/my-first-skill
            </div>
          </motion.div>
        </FadeIn>

        {/* Attribution */}
        <FadeIn delay={0.35}>
          <div style={{
            textAlign: 'center', marginTop: 48,
            fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7,
          }}>
            Built by{' '}
            <a href="https://fernandowittmann.com" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              Fernando Wittmann
            </a>
            {' '}·{' '}
            <a href="/blog" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              ← Back to blog
            </a>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
