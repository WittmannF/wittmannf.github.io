import { motion } from 'framer-motion'
import { SectionWrapper, SectionLabel, SectionTitle } from './ProblemSection'

const rows = [
  { dim: 'Scope', prompt: 'Single static text', context: 'Entire information environment' },
  { dim: 'Dynamism', prompt: 'Fixed at write time', context: 'Assembled at runtime' },
  { dim: 'Components', prompt: 'Instructions + examples', context: 'RAG + memory + tools + state + history' },
  { dim: 'Mental model', prompt: 'Crafting a message', context: 'Managing an information system' },
  { dim: 'Temporal span', prompt: 'One inference call', context: 'Multi-step agentic trajectories' },
  { dim: 'Primary challenge', prompt: 'What to say', context: 'What to include — and what to leave out' },
]

export default function PromptVsContextSection() {
  return (
    <section style={{ padding: '80px 24px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionLabel>Concepts</SectionLabel>
        <SectionTitle>Prompt Engineering vs Context Engineering</SectionTitle>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, maxWidth: 560, lineHeight: 1.7, marginBottom: 48 }}>
          Both matter. But they operate at different levels of abstraction.
        </p>

        {/* Analogy cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 40 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 24,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>✉️</div>
            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 16, marginBottom: 8 }}>Prompt Engineering</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
              Writing a good memo. You craft clear, well-structured instructions for a single interaction.
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.1 }}
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 12, padding: 24,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 16, marginBottom: 8 }}>Context Engineering</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
              Running a well-organized office. You decide what information is available, when, and in what form — across every step of the work.
            </div>
          </motion.div>
        </div>

        {/* Comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ delay: 0.15 }}
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            background: 'var(--surface2)', padding: '12px 20px',
            fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: 0.8,
          }}>
            <div>Dimension</div>
            <div style={{ color: 'var(--text-muted)' }}>Prompt Engineering</div>
            <div style={{ color: 'var(--accent)' }}>Context Engineering</div>
          </div>

          {rows.map((row, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              padding: '14px 20px', fontSize: 14,
              borderTop: '1px solid var(--border)',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
            }}>
              <div style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 13 }}>{row.dim}</div>
              <div style={{ color: 'var(--text-muted)' }}>{row.prompt}</div>
              <div style={{ color: 'var(--text)', fontWeight: 500 }}>{row.context}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
