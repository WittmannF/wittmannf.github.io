import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PenLine, Search, Minimize2, Layers, ChevronDown } from 'lucide-react'
import { SectionLabel, SectionTitle } from './ProblemSection'

const pillars = [
  {
    id: 'write',
    icon: <PenLine size={22} />,
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.1)',
    border: 'rgba(99,102,241,0.3)',
    title: 'Write',
    tagline: 'Save outside the window',
    description: 'Persist information that will be needed later, outside the active context window. This is how agents maintain state and memory across steps.',
    analogy: 'Like taking notes in a notebook so you can close the book and open it again later.',
    examples: ['Memory files (user_profile.md)', 'Scratchpads for intermediate work', 'Databases with structured data', 'Progress notes for long-running tasks'],
    mistake: 'Keeping everything in-context instead of writing to persistent storage — your agent loses state on every new session.',
  },
  {
    id: 'select',
    icon: <Search size={22} />,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.3)',
    title: 'Select',
    tagline: 'Choose what enters the window',
    description: 'Decide what information is retrieved and injected into context for each inference. The most important signal: what does the model actually need right now?',
    analogy: 'Like a librarian who finds the right book from a shelf of thousands — not the whole library.',
    examples: ['RAG (semantic search)', 'BM25 keyword retrieval', 'Memory retrieval by relevance', 'Selective tool descriptions'],
    mistake: 'Injecting all retrieved results without filtering — irrelevant documents are more costly than no documents.',
  },
  {
    id: 'compress',
    icon: <Minimize2 size={22} />,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.3)',
    title: 'Compress',
    tagline: 'Reduce tokens, preserve meaning',
    description: 'When context grows too large, compress it. The goal is to preserve the signal while drastically reducing token count.',
    analogy: 'Like writing a book report instead of re-reading the whole book every time you need a detail.',
    examples: ['Summarize old conversation turns', 'Compact tool results to key findings', 'Trim low-priority history', 'LLM-generated summaries'],
    mistake: 'Blindly truncating from the front — your system prompt lives there. Always preserve the earliest instructions.',
  },
  {
    id: 'isolate',
    icon: <Layers size={22} />,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.1)',
    border: 'rgba(139,92,246,0.3)',
    title: 'Isolate',
    tagline: 'Split work across contexts',
    description: 'Instead of cramming everything into one giant context, distribute work across multiple specialized agents, each with a clean, focused window.',
    analogy: 'Like having specialized employees instead of one person who does everything — each expert has a clear, focused role.',
    examples: ['Orchestrator + sub-agents', 'Sandboxed tool environments', 'Research agent vs code agent', 'Separate state files per concern'],
    mistake: 'One monolithic agent trying to handle research, coding, and review all in one context — leads to context rot and poor performance.',
  },
]

function PillarCard({ pillar }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.4 }}
      style={{
        background: 'var(--surface)', border: `1px solid var(--border)`,
        borderRadius: 14, padding: 24, cursor: 'pointer',
        transition: 'border-color 0.2s',
      }}
      whileHover={{ borderColor: pillar.border }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: pillar.bg, border: `1px solid ${pillar.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: pillar.color, flexShrink: 0,
        }}>
          {pillar.icon}
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ color: 'var(--text-muted)', marginTop: 4 }}
        >
          <ChevronDown size={18} />
        </motion.div>
      </div>

      <div style={{ fontWeight: 800, fontSize: 22, color: pillar.color, marginBottom: 4 }}>
        {pillar.title}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 500 }}>
        {pillar.tagline}
      </div>
      <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, marginBottom: 0 }}>
        {pillar.description}
      </p>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: 20, borderTop: '1px solid var(--border)', marginTop: 16 }}>
              {/* Analogy */}
              <div style={{
                background: pillar.bg, border: `1px solid ${pillar.border}`,
                borderRadius: 8, padding: '10px 14px', marginBottom: 14,
                fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic',
              }}>
                💡 {pillar.analogy}
              </div>

              {/* Examples */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Examples</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pillar.examples.map((ex, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: pillar.color, flexShrink: 0 }} />
                      {ex}
                    </div>
                  ))}
                </div>
              </div>

              {/* Mistake */}
              <div style={{
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8, padding: '10px 14px',
                fontSize: 13, color: 'var(--text-muted)',
              }}>
                <span style={{ color: 'var(--red)', fontWeight: 700 }}>⚠ Common mistake: </span>
                {pillar.mistake}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function FourPillarsSection() {
  return (
    <section id="pillars" style={{ padding: '80px 24px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionLabel>Framework</SectionLabel>
        <SectionTitle>The Four Pillars of Context Engineering</SectionTitle>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.7, marginBottom: 48, maxWidth: 600 }}>
          Every context engineering technique falls into one of four categories. Master these and you have a mental model for everything that follows.
          <br/><span style={{ fontSize: 14, color: 'var(--accent)' }}>Click each card to expand.</span>
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {pillars.map(p => <PillarCard key={p.id} pillar={p} />)}
        </div>
      </div>
    </section>
  )
}
