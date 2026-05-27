import { motion } from 'framer-motion'
import { SectionLabel, SectionTitle } from './ProblemSection'

const patterns = [
  {
    title: 'Hybrid Retrieval Pattern',
    subtitle: 'Used by Claude Code',
    icon: '⚡',
    color: 'var(--accent)',
    bg: 'rgba(99,102,241,0.08)',
    border: 'rgba(99,102,241,0.25)',
    description: 'Two-tier context assembly: static context for always-needed info + dynamic retrieval for specific facts.',
    steps: [
      { label: 'CLAUDE.md / static files', desc: 'Architecture decisions, coding standards, known gotchas. Fast, always available, low token cost.' },
      { label: 'Glob/grep tools (just-in-time)', desc: 'Specific file contents, function definitions, code search results. Retrieved on demand, scoped to current need.' },
    ],
    principle: 'Pre-compute the context you know you\'ll always need. Retrieve everything else just-in-time.',
  },
  {
    title: 'Progress Note Pattern',
    subtitle: 'Long-running agents',
    icon: '📋',
    color: 'var(--green)',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.25)',
    description: 'For agents that work across multiple context windows or sessions. A structured file the agent reads at the start of each new context window.',
    steps: [
      { label: 'progress.md', desc: 'What\'s been done, what\'s in progress, what\'s pending.' },
      { label: 'decisions.md', desc: 'Key decisions and their rationale.' },
      { label: 'environment state', desc: 'Branch, test results, running processes.' },
    ],
    principle: 'At the start of each context window, the agent reads this file and recovers state instantly without re-exploring.',
  },
  {
    title: 'Enterprise RAG Pattern',
    subtitle: 'Production knowledge bases',
    icon: '🏭',
    color: 'var(--orange)',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
    description: 'Full production pipeline for large knowledge bases where simple embedding similarity isn\'t sufficient.',
    steps: [
      { label: 'Query rewriting', desc: 'Optimize the user query for retrieval.' },
      { label: 'Hybrid retrieval (BM25 + Dense)', desc: 'Both keyword and semantic search.' },
      { label: 'Merge & deduplicate', desc: 'Combine results, remove duplicates.' },
      { label: 'Cross-encoder reranking', desc: 'Re-score each (query, document) pair.' },
      { label: 'Contextual summarization', desc: 'Compress and contextualize for injection.' },
    ],
    principle: 'BM25 + Dense + Rerank covers 90% of the quality ceiling at reasonable cost.',
  },
]

export default function PatternsSection() {
  return (
    <section style={{ padding: '80px 24px', background: 'var(--surface)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionLabel>Real-World</SectionLabel>
        <SectionTitle>Production Patterns</SectionTitle>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.7, marginBottom: 48, maxWidth: 600 }}>
          Three patterns you can use today, straight from production systems.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {patterns.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.12 }}
              style={{
                background: p.bg, border: `1px solid ${p.border}`,
                borderRadius: 14, padding: 28,
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
                <span style={{ fontSize: 28 }}>{p.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: p.color }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>
                    {p.subtitle}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, marginBottom: 16, maxWidth: 600 }}>{p.description}</p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {p.steps.map((s, j) => (
                  <div key={j} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '8px 14px', fontSize: 13,
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                  }}>
                    <span style={{
                      background: p.color, color: '#fff', borderRadius: '50%',
                      width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1,
                    }}>{j + 1}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13,
                color: 'var(--text)', lineHeight: 1.5,
              }}>
                <span style={{ color: p.color, fontWeight: 700 }}>Key principle: </span>{p.principle}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
