import { motion } from 'framer-motion'
import { SectionLabel, SectionTitle } from './ProblemSection'

const categories = [
  {
    title: 'Retrieval Quality',
    icon: '🎯',
    color: 'var(--blue)',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.25)',
    metrics: [
      { name: 'Recall@k', desc: 'Of all relevant documents, how many did you retrieve?' },
      { name: 'Precision@k', desc: 'Of what you retrieved, how much was relevant?' },
      { name: 'MRR', desc: 'How high in the ranked list does the first relevant result appear?' },
    ],
  },
  {
    title: 'Context Utilization',
    icon: '📊',
    color: 'var(--green)',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.25)',
    metrics: [
      { name: 'Faithfulness', desc: 'Does the response actually use the retrieved context?' },
      { name: 'Answer Relevancy', desc: 'Does the answer address the question?' },
      { name: 'Context Relevancy', desc: 'Was the retrieved context relevant to the question?' },
    ],
  },
  {
    title: 'Agent Performance',
    icon: '🤖',
    color: 'var(--accent2)',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.25)',
    metrics: [
      { name: 'Task Completion Rate', desc: 'Does the agent complete the goal over long horizons?' },
      { name: 'Token Efficiency', desc: 'Task completions per 1K tokens used.' },
      { name: 'Error Recovery Rate', desc: 'When the agent makes a mistake, how often does it self-correct?' },
    ],
  },
]

export default function EvaluationSection() {
  return (
    <section style={{ padding: '80px 24px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <SectionLabel>Measurement</SectionLabel>
        <SectionTitle>Evaluating Context Engineering</SectionTitle>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.7, marginBottom: 48, maxWidth: 600 }}>
          You can't improve what you don't measure. Key insight: measure at the task level, not just at the response level.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 40 }}>
          {categories.map((cat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.12 }}
              style={{
                background: cat.bg, border: `1px solid ${cat.border}`,
                borderRadius: 12, padding: 22,
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>{cat.icon}</span>
                <div style={{ fontWeight: 700, fontSize: 16, color: cat.color }}>{cat.title}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {cat.metrics.map((m, j) => (
                  <div key={j} style={{
                    background: 'var(--surface)', borderRadius: 8, padding: '12px 14px',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>{m.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{m.desc}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '24px 28px',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 12 }}>
            ⚠ The Measurement Trap
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 12 }}>
            A response can <em>look</em> good while failing the task. Retrieval can look high-precision while missing critical information.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { icon: '❌', label: 'Response looks good', desc: 'But doesn\'t complete the task' },
              { icon: '❌', label: 'High precision retrieval', desc: 'But missing the crucial document' },
              { icon: '✅', label: 'Task completion rate', desc: 'The ground truth you want' },
            ].map((item, i) => (
              <div key={i} style={{
                background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px',
                fontSize: 13, color: 'var(--text-muted)',
              }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span> <strong style={{ color: 'var(--text)' }}>{item.label}:</strong> {item.desc}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>
            Tools like LangSmith, Braintrust, and Anthropic's evaluation APIs can track these metrics at scale.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
