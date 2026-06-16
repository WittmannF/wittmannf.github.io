import { useState } from 'react'
import { motion } from 'framer-motion'
import { SectionLabel, SectionTitle } from './ProblemSection'

const strategies = [
  {
    id: 'small',
    label: 'Small Chunks',
    range: '128–256 tokens',
    color: 'var(--blue)',
    pros: ['More precise retrieval', 'Lower noise', 'Faster embedding'],
    cons: ['Less surrounding context', 'May split important passages'],
  },
  {
    id: 'large',
    label: 'Large Chunks',
    range: '512–1024 tokens',
    color: 'var(--orange)',
    pros: ['More complete context', 'Fewer chunks to manage'],
    cons: ['Noisier retrieval', 'Higher token cost', 'May dilute relevance'],
  },
  {
    id: 'hierarchical',
    label: 'Hierarchical Indexing',
    range: 'Best of both',
    color: 'var(--green)',
    badge: '★ Recommended',
    pros: ['Small chunks for precise retrieval', 'Large parent chunks sent to model', 'Best retrieval + context quality'],
    cons: ['More complex to implement'],
  },
]

export default function ChunkingSection() {
  const [active, setActive] = useState('hierarchical')

  return (
    <section style={{ padding: '80px 24px', background: 'var(--surface)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <SectionLabel>RAG Detail</SectionLabel>
        <SectionTitle>Chunking Strategy</SectionTitle>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.7, marginBottom: 48, maxWidth: 600 }}>
          Chunk size is a hyperparameter worth measuring — not guessing. The right size depends on your specific content and queries.
        </p>

        {/* Toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {strategies.map(s => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              style={{
                padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${active === s.id ? s.color : 'var(--border)'}`,
                background: active === s.id ? `${s.color}15` : 'transparent',
                color: active === s.id ? s.color : 'var(--text-muted)',
                fontWeight: 600, fontSize: 13, transition: 'all 0.2s',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Visual + details */}
        {strategies.filter(s => s.id === active).map(s => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Document visualization */}
            <div style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 24, marginBottom: 20,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 }}>
                Document chunking visualization
              </div>

              {s.id === 'small' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} style={{
                      height: 20, borderRadius: 4,
                      background: i === 2 || i === 3 ? s.color : 'var(--surface2)',
                      border: `1px solid ${i === 2 || i === 3 ? s.color : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', paddingLeft: 8,
                      fontSize: 10, color: i === 2 || i === 3 ? '#fff' : 'var(--text-muted)',
                    }}>
                      {i === 2 ? '← retrieved chunk' : `chunk ${i + 1}`}
                    </div>
                  ))}
                </div>
              )}

              {s.id === 'large' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{
                      height: 52, borderRadius: 6,
                      background: i === 1 ? s.color : 'var(--surface2)',
                      border: `1px solid ${i === 1 ? s.color : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', paddingLeft: 12,
                      fontSize: 11, color: i === 1 ? '#fff' : 'var(--text-muted)',
                    }}>
                      {i === 1 ? '← retrieved chunk (large, noisy)' : `chunk ${i + 1} (large)`}
                    </div>
                  ))}
                </div>
              )}

              {s.id === 'hierarchical' && (
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Small chunks (retrieval)</div>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} style={{
                        height: 18, borderRadius: 3, marginBottom: 3,
                        background: i === 2 || i === 3 ? s.color : 'var(--surface2)',
                        border: `1px solid ${i === 2 || i === 3 ? s.color : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', paddingLeft: 6,
                        fontSize: 9, color: i === 2 || i === 3 ? '#fff' : 'var(--text-muted)',
                      }}>
                        {i === 2 ? '← matched' : ''}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: 20 }}>→</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Parent chunk (sent to model)</div>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} style={{
                        height: 52, borderRadius: 6, marginBottom: 4,
                        background: i === 0 ? `${s.color}25` : 'var(--surface2)',
                        border: `1px solid ${i === 0 ? s.color : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', paddingLeft: 10,
                        fontSize: 10, color: i === 0 ? s.color : 'var(--text-muted)',
                      }}>
                        {i === 0 ? '← parent (full context)' : `parent ${i + 1}`}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Advantages</div>
                {s.pros.map((p, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', gap: 6 }}>
                    <span style={{ color: 'var(--green)' }}>✓</span> {p}
                  </div>
                ))}
              </div>
              <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Trade-offs</div>
                {s.cons.map((c, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', gap: 6 }}>
                    <span style={{ color: 'var(--red)' }}>—</span> {c}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}

        <div style={{
          marginTop: 24, padding: '16px 20px',
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 10, fontSize: 14, color: 'var(--text)',
        }}>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Best practice: </span>
          Measure retrieval quality (recall@k) with different chunk sizes on your actual data. Grid-search this before optimizing anything else.
        </div>
      </div>
    </section>
  )
}
