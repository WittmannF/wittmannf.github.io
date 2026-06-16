import { motion } from 'framer-motion'
import { SectionLabel, SectionTitle } from './ProblemSection'

export default function LongContextSection() {
  const attentionBars = [
    { label: 'Beginning', attention: 90, color: 'var(--green)' },
    { label: 'Early middle', attention: 65, color: 'var(--orange)' },
    { label: 'Middle', attention: 35, color: 'var(--red)' },
    { label: 'Late middle', attention: 45, color: 'var(--orange)' },
    { label: 'End', attention: 88, color: 'var(--green)' },
  ]

  const tips = [
    { num: 1, tip: 'Put longform documents BEFORE instructions', why: 'The model attends to instructions more reliably when they follow the content.' },
    { num: 2, tip: 'Put the final question at the END', why: 'Can improve response quality by up to 30% on complex multi-document tasks.' },
    { num: 3, tip: 'Wrap documents in XML tags', why: 'Consistent structure helps the model understand document boundaries and source attribution.' },
    { num: 4, tip: 'Ask for quotes before synthesis', why: 'Forces the model to locate evidence before drawing conclusions — dramatically reduces hallucination.' },
  ]

  return (
    <section style={{ padding: '80px 24px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <SectionLabel>System Prompt</SectionLabel>
        <SectionTitle>Long-Context Prompting</SectionTitle>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.7, marginBottom: 48, maxWidth: 600 }}>
          Even with a 1M token context window, not all tokens get equal attention. Understanding where attention concentrates changes how you structure prompts.
        </p>

        {/* Lost in the middle visual */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 28, marginBottom: 40,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 20 }}>
            "Lost in the Middle" — Attention by Position (Liu et al., 2023)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {attentionBars.map((bar, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 90, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>{bar.label}</div>
                <div style={{ flex: 1, height: 24, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }} whileInView={{ width: `${bar.attention}%` }}
                    viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}
                    style={{ height: '100%', background: bar.color, borderRadius: 4 }}
                  />
                </div>
                <div style={{ width: 50, fontSize: 12, color: bar.color, fontWeight: 700 }}>{bar.attention}%</div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Performance is highest when relevant information occurs at the beginning or end of the context. Information in the middle of long inputs is significantly less likely to be used.
          </p>
        </div>

        {/* Best practices */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 32 }}>
          {tips.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: 18,
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'var(--accent)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>{t.num}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.4 }}>{t.tip}</div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, paddingLeft: 34 }}>{t.why}</p>
            </motion.div>
          ))}
        </div>

        {/* Document structure example */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
            Recommended structure for document-heavy prompts
          </div>
          <div style={{
            fontFamily: 'monospace', fontSize: 12, lineHeight: 2,
            background: 'var(--surface2)', borderRadius: 8, padding: '14px 18px', color: 'var(--text)',
          }}>
            <span style={{ color: 'var(--accent)' }}>&lt;documents&gt;</span><br />
            &nbsp;&nbsp;<span style={{ color: 'var(--blue)' }}>&lt;document index="1"&gt;</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: 'var(--orange)' }}>&lt;source&gt;</span>Q4-2025-report.pdf<span style={{ color: 'var(--orange)' }}>&lt;/source&gt;</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: 'var(--text-muted)' }}>[content here]</span><br />
            &nbsp;&nbsp;<span style={{ color: 'var(--blue)' }}>&lt;/document&gt;</span><br />
            <span style={{ color: 'var(--accent)' }}>&lt;/documents&gt;</span><br />
            <br />
            <span style={{ color: 'var(--green)' }}>← Question goes here, at the end</span><br />
            Based on the documents above, what were the key risks identified in Q4?<br />
            <br />
            <span style={{ color: 'var(--text-muted)' }}>First, quote the most relevant passages. Then answer the question.</span>
          </div>
        </div>
      </div>
    </section>
  )
}
