import { useState } from 'react'
import { motion } from 'framer-motion'
import { SectionLabel, SectionTitle } from './ProblemSection'

const tokenSlices = [
  { label: 'System Prompt', pct: 18, color: '#6366f1', note: 'Stable — cache this' },
  { label: 'Conversation History', pct: 22, color: '#3b82f6', note: 'Grows with turns — manage it' },
  { label: 'Retrieved Documents', pct: 38, color: '#f59e0b', note: '⚠ Biggest waste if irrelevant' },
  { label: 'Tool Schemas', pct: 8, color: '#10b981', note: '~346 tokens/request overhead' },
  { label: 'Tool Results', pct: 14, color: '#8b5cf6', note: 'Compress old results' },
]

const cacheTable = [
  { scenario: 'Chat with a 100K-token book', latency: '-79%', cost: '-90%' },
  { scenario: '10K many-shot prompt', latency: '-31%', cost: '-86%' },
  { scenario: 'Multi-turn conversation', latency: '-75%', cost: '-53%' },
]

export default function TokenBudgetSection() {
  const [hovered, setHovered] = useState(null)

  return (
    <section style={{ padding: '80px 24px', background: 'var(--surface)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <SectionLabel>Cost & Performance</SectionLabel>
        <SectionTitle>Token Budgeting</SectionTitle>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.7, marginBottom: 48, maxWidth: 600 }}>
          Every token has three costs: money, latency, and attention. Treat context as a finite resource and allocate it deliberately.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {/* Token budget visual */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 }}>
              Typical context window breakdown
            </div>

            {/* Stacked bar */}
            <div style={{ height: 36, background: 'var(--surface2)', borderRadius: 8, display: 'flex', overflow: 'hidden', marginBottom: 16 }}>
              {tokenSlices.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ flex: 0 }} whileInView={{ flex: s.pct }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    background: s.color, cursor: 'pointer',
                    opacity: hovered === null || hovered === i ? 1 : 0.5,
                    transition: 'opacity 0.2s',
                  }}
                  title={`${s.label}: ${s.pct}%`}
                />
              ))}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tokenSlices.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                    background: hovered === i ? `${s.color}15` : 'transparent',
                    border: `1px solid ${hovered === i ? s.color : 'transparent'}`,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{s.pct}%</div>
                  {s.note.startsWith('⚠') && (
                    <div style={{ fontSize: 10, color: 'var(--orange)', fontWeight: 700 }}>⚠</div>
                  )}
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 16, padding: '12px 14px',
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 8, fontSize: 13, color: 'var(--text-muted)',
            }}>
              <span style={{ color: 'var(--orange)', fontWeight: 700 }}>Biggest waste: </span>
              Retrieved documents that weren't relevant. If RAG retrieves 5 chunks but only 2 are relevant, you're spending 60% of those tokens on noise.
            </div>
          </div>

          {/* Prompt caching */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 }}>
              Prompt caching — impact
            </div>

            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto',
                background: 'var(--surface2)', padding: '10px 14px',
                fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: 0.8,
              }}>
                <div>Scenario</div>
                <div>Latency ↓</div>
                <div>Cost ↓</div>
              </div>
              {cacheTable.map((row, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto',
                  padding: '12px 14px', fontSize: 13,
                  borderTop: '1px solid var(--border)',
                }}>
                  <div style={{ color: 'var(--text-muted)' }}>{row.scenario}</div>
                  <div style={{ color: 'var(--green)', fontWeight: 700, paddingLeft: 12 }}>{row.latency}</div>
                  <div style={{ color: 'var(--green)', fontWeight: 700, paddingLeft: 12 }}>{row.cost}</div>
                </div>
              ))}
            </div>

            <div style={{
              padding: '14px 16px',
              background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: 8, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}>Caching rules:</div>
              <div>✓ Cache stable content: system prompts, large documents, few-shot examples</div>
              <div>✗ Never cache dynamic content: timestamps, user-specific data, current query</div>
              <div style={{ marginTop: 8, fontStyle: 'italic' }}>Cache reads cost 10% of base input token price.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
