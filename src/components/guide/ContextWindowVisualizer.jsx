import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SectionWrapper, SectionLabel, SectionTitle } from './ProblemSection'

const states = [
  {
    label: 'Too Little',
    emoji: '😰',
    color: 'var(--red)',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.3)',
    description: 'The model is flying blind. No grounding documents, no memory, no examples. It fills the gaps with hallucinations.',
    items: [
      { label: 'User query', width: '50%', color: 'var(--blue)' },
    ],
    warning: 'Hallucination risk is high',
  },
  {
    label: 'Just Right',
    emoji: '✅',
    color: 'var(--green)',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.3)',
    description: 'High-signal context only. The model has exactly what it needs to reason clearly — no more, no less.',
    items: [
      { label: 'System prompt', width: '25%', color: 'var(--accent)' },
      { label: 'Relevant docs (3)', width: '40%', color: 'var(--blue)' },
      { label: 'User query', width: '20%', color: 'var(--green)' },
    ],
    warning: null,
  },
  {
    label: 'Too Much',
    emoji: '🤯',
    color: 'var(--orange)',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.3)',
    description: 'Context rot. Irrelevant documents, old tool results, noise — the model loses focus. Important information gets "lost in the middle".',
    items: [
      { label: 'System prompt', width: '12%', color: 'var(--accent)' },
      { label: 'All retrieved docs (15+)', width: '45%', color: 'rgba(59,130,246,0.5)' },
      { label: 'Old tool results', width: '20%', color: 'rgba(245,158,11,0.5)' },
      { label: 'Conversation history', width: '15%', color: 'rgba(16,185,129,0.4)' },
      { label: '…query', width: '8%', color: 'var(--blue)' },
    ],
    warning: 'Context rot — quality degrades',
  },
]

export default function ContextWindowVisualizer() {
  const [pos, setPos] = useState(1) // 0, 1, 2

  const state = states[pos]

  return (
    <section style={{ padding: '80px 24px', background: 'var(--surface)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <SectionLabel>Core Principle</SectionLabel>
        <SectionTitle>The Context Window as a Finite Resource</SectionTitle>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.7, marginBottom: 48, maxWidth: 600 }}>
          Think of the context window as a desk. The model can only work with what's on the desk right now. Too empty = guessing. Too cluttered = distracted.
        </p>

        {/* Slider */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>Too little context</span>
            <span>Just right</span>
            <span>Too much context</span>
          </div>
          <input
            type="range" min={0} max={2} step={1} value={pos}
            onChange={e => setPos(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: 6 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {states.map((s, i) => (
              <button
                key={i}
                onClick={() => setPos(i)}
                style={{
                  background: pos === i ? s.bg : 'transparent',
                  border: `1px solid ${pos === i ? s.border : 'var(--border)'}`,
                  borderRadius: 8, padding: '6px 16px', cursor: 'pointer',
                  color: pos === i ? s.color : 'var(--text-muted)',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                }}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Visual */}
        <AnimatePresence mode="wait">
          <motion.div
            key={pos}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            style={{
              background: state.bg, border: `1px solid ${state.border}`,
              borderRadius: 16, padding: '28px 28px 24px',
            }}
          >
            {/* Token bar */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>Context window usage</div>
              <div style={{ height: 32, background: 'var(--surface2)', borderRadius: 8, display: 'flex', overflow: 'hidden', gap: 2 }}>
                {state.items.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ width: 0 }} animate={{ width: item.width }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                    style={{
                      background: item.color, minWidth: 4,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                    title={item.label}
                  />
                ))}
                {/* Empty space */}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                {state.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ fontSize: 36 }}>{state.emoji}</div>
              <div>
                <p style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600, marginBottom: 6 }}>{state.label}</p>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: state.warning ? 10 : 0 }}>
                  {state.description}
                </p>
                {state.warning && (
                  <div style={{
                    display: 'inline-block', background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 6, padding: '4px 10px', fontSize: 12,
                    color: 'var(--orange)', fontWeight: 600,
                  }}>
                    ⚠ {state.warning}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Principle */}
        <motion.div
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          style={{
            marginTop: 32, background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '20px 24px',
            fontSize: 15, color: 'var(--text)', lineHeight: 1.6,
          }}
        >
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Core principle: </span>
          More context is not automatically better. The goal is the smallest set of high-signal tokens that helps the model solve the task.
        </motion.div>
      </div>
    </section>
  )
}
