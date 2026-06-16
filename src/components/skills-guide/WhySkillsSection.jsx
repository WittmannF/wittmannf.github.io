import { motion } from 'framer-motion'
import { MessageSquare, Zap, Package, Users } from 'lucide-react'
import { SectionWrapper, SectionLabel, SectionTitle, Lead, FadeIn } from './shared'

const comparisons = [
  {
    without: 'Type the same 5-step deploy instructions every time',
    with: 'Type /deploy and it just works',
  },
  {
    without: 'Claude asks which linter to run on every PR review',
    with: '/review auto-loads your project\'s linting rules',
  },
  {
    without: 'Re-explain your commit style each session',
    with: '/commit uses your Conventional Commits config, always',
  },
  {
    without: 'Prompt-engineer a custom security audit each time',
    with: '/security-audit loads your threat model and OWASP checks automatically',
  },
]

const benefits = [
  {
    icon: <Zap size={20} />,
    color: 'var(--orange)',
    title: 'Repeatable, not repeated',
    desc: 'Write complex instructions once. Skills load them automatically — no copy-paste, no re-explaining.',
  },
  {
    icon: <Package size={20} />,
    color: 'var(--accent)',
    title: 'Shareable with your team',
    desc: 'Skills committed to .claude/skills/ work for everyone. Same behavior, same quality, across the team.',
  },
  {
    icon: <MessageSquare size={20} />,
    color: 'var(--green)',
    title: 'Two invocation modes',
    desc: 'You can trigger skills explicitly with /skill-name, or configure them to fire automatically when relevant.',
  },
  {
    icon: <Users size={20} />,
    color: '#ec4899',
    title: 'Three scopes',
    desc: 'Personal (all your projects), project (your team), or plugin (installable packages). Choose where the skill lives.',
  },
]

export default function WhySkillsSection() {
  return (
    <SectionWrapper id="why-skills" style={{ background: 'var(--bg)' }}>
      <FadeIn>
        <SectionLabel>The Problem</SectionLabel>
        <SectionTitle>Why Skills Exist</SectionTitle>
        <Lead>
          Claude Code starts fresh every session. Without skills, you repeat the same
          instructions endlessly. Skills are reusable workflows — think of them as slash
          commands with superpowers.
        </Lead>
      </FadeIn>

      {/* Before / After table */}
      <FadeIn delay={0.1}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden',
          marginBottom: 56,
        }}>
          <div style={{ background: 'rgba(239,68,68,0.06)', padding: '12px 20px', borderRight: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>
              Without skills
            </div>
            {comparisons.map((c, i) => (
              <div key={i} style={{
                display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-start',
              }}>
                <span style={{ color: 'var(--red)', fontSize: 16, flexShrink: 0, marginTop: 1 }}>✗</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{c.without}</span>
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(16,185,129,0.06)', padding: '12px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>
              With skills
            </div>
            {comparisons.map((c, i) => (
              <div key={i} style={{
                display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-start',
              }}>
                <span style={{ color: 'var(--green)', fontSize: 16, flexShrink: 0, marginTop: 1 }}>✓</span>
                <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{c.with}</span>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Benefit cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {benefits.map((b, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 20,
            }}
          >
            <div style={{ color: b.color, marginBottom: 12 }}>{b.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>{b.title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{b.desc}</div>
          </motion.div>
        ))}
      </div>
    </SectionWrapper>
  )
}
