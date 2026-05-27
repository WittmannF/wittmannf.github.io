import { motion } from 'framer-motion'
import { SectionLabel, SectionTitle } from './ProblemSection'

export default function ContextualRetrieval() {
  const stats = [
    { label: 'Contextual Embeddings alone', reduction: 35, color: 'var(--blue)' },
    { label: '+ BM25 hybrid', reduction: 49, color: 'var(--green)' },
    { label: '+ Reranker on top', reduction: 67, color: 'var(--accent)' },
  ]

  return (
    <section style={{ padding: '80px 24px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <SectionLabel>Advanced RAG</SectionLabel>
        <SectionTitle>Contextual Retrieval</SectionTitle>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.7, marginBottom: 48, maxWidth: 600 }}>
          When documents are chunked, individual chunks lose their broader context. A chunk that says "The revenue declined 10% in Q3" has no meaning without knowing which company or year.
        </p>

        {/* Before / After */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 48 }}>
          <motion.div
            initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            style={{
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 12, padding: 24,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
              ✗ Before: chunk without context
            </div>
            <div style={{
              background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px',
              fontFamily: 'monospace', fontSize: 13, color: 'var(--text)', lineHeight: 1.6,
              marginBottom: 12,
            }}>
              "The revenue declined 10% in Q3."
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--red)' }}>Problem:</strong> Which company? Which year? Which report? The chunk is meaningless in isolation.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.1 }}
            style={{
              background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: 12, padding: 24,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
              ✓ After: contextual chunk
            </div>
            <div style={{
              background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px',
              fontFamily: 'monospace', fontSize: 12, color: 'var(--text)', lineHeight: 1.6,
              marginBottom: 12,
            }}>
              <span style={{ color: 'var(--accent)' }}>&lt;context&gt;</span><br />
              This chunk is from Acme Corp's 2024 annual report,<br />
              Q3 financial summary. Full-year revenue: $4.2B.<br />
              <span style={{ color: 'var(--accent)' }}>&lt;/context&gt;</span><br />
              <br />
              "The revenue declined 10% in Q3."
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--green)' }}>Result:</strong> The model knows exactly what this chunk refers to. Retrieval is dramatically more accurate.
            </p>
          </motion.div>
        </div>

        {/* Stats */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 32,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 24, textAlign: 'center' }}>
            Retrieval failure reduction — Anthropic experiments
          </div>
          {stats.map((s, i) => (
            <div key={i} style={{ marginBottom: i < stats.length - 1 ? 20 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                <span style={{ color: 'var(--text)' }}>{s.label}</span>
                <span style={{ color: s.color, fontWeight: 700 }}>{s.reduction}% fewer failures</span>
              </div>
              <div style={{ height: 10, background: 'var(--surface2)', borderRadius: 5, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }} whileInView={{ width: `${s.reduction}%` }}
                  viewport={{ once: true }} transition={{ delay: i * 0.15, duration: 0.6 }}
                  style={{ height: '100%', background: s.color, borderRadius: 5 }}
                />
              </div>
            </div>
          ))}

          <div style={{
            marginTop: 24, padding: '14px 16px', background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8,
            fontSize: 13, color: 'var(--text-muted)',
          }}>
            Cost with Claude + prompt caching: ~$1.02 per million document tokens. The retrieval quality improvement typically more than pays for the cost.
          </div>
        </div>
      </div>
    </section>
  )
}
