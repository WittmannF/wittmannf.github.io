import { motion } from 'framer-motion'
import { SectionLabel, SectionTitle } from './ProblemSection'

const benefits = [
  { icon: '🧹', title: 'No context rot', desc: 'Each agent works with a focused, clean window.' },
  { icon: '⚡', title: 'Parallel execution', desc: 'Independent tasks run simultaneously.' },
  { icon: '🎯', title: 'Better focus', desc: 'The research agent doesn\'t need to know implementation details.' },
  { icon: '📦', title: 'Separation of concerns', desc: 'Each role has clear responsibilities and boundaries.' },
]

export default function MultiAgentSection() {
  return (
    <section style={{ padding: '80px 24px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <SectionLabel>Pillar: Isolate</SectionLabel>
        <SectionTitle>Multi-Agent Context Isolation</SectionTitle>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.7, marginBottom: 48, maxWidth: 600 }}>
          Sometimes the best solution isn't compressing one giant context — it's splitting work across multiple focused contexts.
        </p>

        {/* Architecture diagram */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 32, marginBottom: 40,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 24, textAlign: 'center' }}>
            Multi-agent architecture
          </div>

          {/* Orchestrator */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              style={{
                background: 'rgba(99,102,241,0.12)', border: '2px solid rgba(99,102,241,0.5)',
                borderRadius: 12, padding: '16px 32px', textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>🎛️</div>
              <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 15 }}>Orchestrator Agent</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>High-level plan + intermediate results</div>
            </motion.div>
          </div>

          {/* SVG connector lines */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <svg width="340" height="36" viewBox="0 0 340 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="170" y1="0" x2="50" y2="36" stroke="var(--border)" strokeWidth="1.5" />
              <line x1="170" y1="0" x2="170" y2="36" stroke="var(--border)" strokeWidth="1.5" />
              <line x1="170" y1="0" x2="290" y2="36" stroke="var(--border)" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Sub-agents */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { icon: '🔍', label: 'Research Agent', desc: 'Clean context\nfor retrieval', color: 'var(--green)', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.3)' },
              { icon: '💻', label: 'Code Agent', desc: 'Clean context\nfor implementation', color: 'var(--blue)', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.3)' },
              { icon: '✔', label: 'Review Agent', desc: 'Clean context\nfor validation', color: 'var(--orange)', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)' },
            ].map((agent, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.12 }}
                style={{
                  background: agent.bg, border: `1px solid ${agent.border}`,
                  borderRadius: 10, padding: '14px 16px', textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 6 }}>{agent.icon}</div>
                <div style={{ fontWeight: 700, color: agent.color, fontSize: 13, marginBottom: 4 }}>{agent.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>{agent.desc}</div>
              </motion.div>
            ))}
          </div>

          <div style={{
            marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)',
          }}>
            Orchestrator receives <strong style={{ color: 'var(--text)' }}>condensed summaries (1,000–2,000 tokens)</strong> — not full workloads
          </div>
        </div>

        {/* Benefits */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {benefits.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>{b.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>{b.title}</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
