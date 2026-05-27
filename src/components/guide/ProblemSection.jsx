import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

const SectionWrapper = ({ id, children, style = {} }) => (
  <section id={id} style={{
    padding: '80px 24px', background: 'var(--surface)', ...style
  }}>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {children}
    </div>
  </section>
)

const SectionLabel = ({ children }) => (
  <div style={{
    display: 'inline-block', background: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20,
    padding: '3px 12px', fontSize: 11, color: 'var(--accent)',
    fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 16,
  }}>{children}</div>
)

const SectionTitle = ({ children }) => (
  <h2 style={{
    fontSize: 'clamp(22px, 3.5vw, 36px)', fontWeight: 800,
    letterSpacing: '-0.8px', marginBottom: 12, color: 'var(--text)',
  }}>{children}</h2>
)

export { SectionWrapper, SectionLabel, SectionTitle }

export default function ProblemSection() {
  const before = [
    'Better prompt?',
    'Bigger model?',
    'Tweak temperature?',
    'More few-shot examples?',
  ]

  const after = 'The real question: did the model have the right context?'

  return (
    <SectionWrapper id="problem">
      <SectionLabel>The Core Problem</SectionLabel>
      <SectionTitle>Why Your Demo Works But Production Doesn't</SectionTitle>
      <p style={{ color: 'var(--text-muted)', fontSize: 17, maxWidth: 640, lineHeight: 1.7, marginBottom: 48 }}>
        There's a moment every developer hits when building with LLMs: the demo is brilliant, then it falls apart the moment you add real data, real conversations, or real complexity.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 40 }}>
        {/* Before */}
        <motion.div
          initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}
          style={{
            background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 12, padding: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <AlertTriangle size={18} color="var(--red)" />
            <span style={{ fontWeight: 700, color: 'var(--red)', fontSize: 14 }}>Common (wrong) diagnosis</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {before.map((item, i) => (
              <div key={i} style={{
                background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px',
                fontSize: 14, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ color: 'var(--red)', fontWeight: 700 }}>✗</span> {item}
              </div>
            ))}
          </div>
        </motion.div>

        {/* After */}
        <motion.div
          initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.15 }}
          style={{
            background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <CheckCircle2 size={18} color="var(--green)" />
            <span style={{ fontWeight: 700, color: 'var(--green)', fontSize: 14 }}>Real diagnosis</span>
          </div>
          <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, marginBottom: 20 }}>
            {after}
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            The model had wrong information, too much noise, or critical context was missing at inference time.
          </p>
        </motion.div>
      </div>

      {/* Big callout */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }}
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 16, padding: '32px 40px', textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 'clamp(18px, 2.5vw, 24px)', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Most LLM failures are context failures.
        </p>
        <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>
          Not model failures. Not prompt failures. The information in the context window was wrong, incomplete, or noisy.
        </p>
      </motion.div>
    </SectionWrapper>
  )
}
