import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckSquare, Square } from 'lucide-react'
import { SectionLabel, SectionTitle } from './ProblemSection'

const checklistData = [
  {
    category: 'Retrieval',
    icon: '🔍',
    color: 'var(--blue)',
    items: [
      'Using hybrid retrieval (BM25 + semantic)?',
      'Tuned chunk size on real queries (not guessed)?',
      'Reranking retrieved results before injection?',
      'Implemented contextual retrieval for chunked documents?',
    ],
  },
  {
    category: 'Memory',
    icon: '🧠',
    color: 'var(--accent)',
    items: [
      'Persistence mechanism for long-running sessions?',
      'Memory types separated (episodic / procedural / semantic)?',
      'Mechanism to detect and correct stale or incorrect memories?',
    ],
  },
  {
    category: 'System Prompt',
    icon: '📝',
    color: 'var(--green)',
    items: [
      'Prompt clear to a colleague with no context?',
      'Explains WHY behind important instructions?',
      'Critical information at beginning or end (not buried in middle)?',
      'Few-shot examples covering the distribution of real inputs?',
    ],
  },
  {
    category: 'Token Management',
    icon: '💰',
    color: 'var(--orange)',
    items: [
      'Stable prompt components cached?',
      'Strategy for managing growing conversation history?',
      'Audited what\'s taking up the most tokens in a typical request?',
    ],
  },
  {
    category: 'Agentic Design',
    icon: '🤖',
    color: 'var(--accent2)',
    items: [
      'Agent has a state persistence mechanism?',
      'Progress notes or checkpoints for recovery?',
      'Complex tasks isolated across sub-agents?',
    ],
  },
  {
    category: 'Security',
    icon: '🔒',
    color: 'var(--red)',
    items: [
      'Retrieved content structurally separated from instructions?',
      'High-stakes actions protected from instruction-following override?',
      'Validation on memory writes (path traversal protection)?',
    ],
  },
]

export default function ProductionChecklist() {
  const totalItems = checklistData.flatMap(c => c.items).length
  const [checked, setChecked] = useState(new Set())

  const toggle = (key) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const progress = Math.round((checked.size / totalItems) * 100)

  const resetAll = () => setChecked(new Set())

  return (
    <section id="checklist" style={{ padding: '80px 24px', background: 'var(--surface)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <SectionLabel>Shipping</SectionLabel>
        <SectionTitle>Production Readiness Checklist</SectionTitle>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.7, marginBottom: 32, maxWidth: 600 }}>
          Work through these before shipping any LLM-powered system. Check them off as you go.
        </p>

        {/* Progress bar */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {checked.size} / {totalItems} completed
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: progress === 100 ? 'var(--green)' : 'var(--accent)' }}>
                {progress}%
              </div>
              {checked.size > 0 && (
                <button
                  onClick={resetAll}
                  style={{
                    background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                    padding: '3px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)',
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>
          <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
              style={{
                height: '100%', borderRadius: 4,
                background: progress === 100 ? 'var(--green)' : 'linear-gradient(90deg, var(--accent), var(--accent2))',
              }}
            />
          </div>
          {progress === 100 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              style={{
                marginTop: 12, padding: '10px 16px',
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 8, fontSize: 14, color: 'var(--green)', fontWeight: 600,
                textAlign: 'center',
              }}
            >
              ✅ All checks passed — you're ready to ship!
            </motion.div>
          )}
        </div>

        {/* Checklist grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {checklistData.map((cat, ci) => (
            <motion.div
              key={ci}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: ci * 0.08 }}
              style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 20,
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>{cat.icon}</span>
                <div style={{ fontWeight: 700, fontSize: 15, color: cat.color }}>{cat.category}</div>
                <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                  {cat.items.filter((_, ii) => checked.has(`${ci}-${ii}`)).length}/{cat.items.length}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cat.items.map((item, ii) => {
                  const key = `${ci}-${ii}`
                  const isChecked = checked.has(key)
                  return (
                    <div
                      key={ii}
                      onClick={() => toggle(key)}
                      style={{
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                        cursor: 'pointer', padding: '6px 8px', borderRadius: 6,
                        background: isChecked ? 'rgba(16,185,129,0.07)' : 'transparent',
                        border: `1px solid ${isChecked ? 'rgba(16,185,129,0.25)' : 'transparent'}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ marginTop: 1, color: isChecked ? 'var(--green)' : 'var(--text-muted)', flexShrink: 0 }}>
                        {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                      </div>
                      <span style={{
                        fontSize: 13, lineHeight: 1.5,
                        color: isChecked ? 'var(--text-muted)' : 'var(--text)',
                        textDecoration: isChecked ? 'line-through' : 'none',
                      }}>
                        {item}
                      </span>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
