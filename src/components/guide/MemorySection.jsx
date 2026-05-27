import { motion } from 'framer-motion'
import { SectionLabel, SectionTitle } from './ProblemSection'

const memTypes = [
  {
    id: 'episodic',
    icon: '📅',
    label: 'Episodic',
    description: 'Records of past experiences and interactions.',
    example: '"Last time, this user preferred concise answers and used Python 3.11."',
    storage: 'Key-value pairs or vector embeddings, retrieved by similarity',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.08)',
    border: 'rgba(99,102,241,0.25)',
  },
  {
    id: 'semantic',
    icon: '📚',
    label: 'Semantic',
    description: 'Facts about the world or the domain.',
    example: 'Company knowledge base, product catalog, technical documentation.',
    storage: 'Standard RAG territory — vector stores, databases',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.25)',
  },
  {
    id: 'procedural',
    icon: '⚙️',
    label: 'Procedural',
    description: 'How to do things. Defines agent behavior.',
    example: 'System prompts, CLAUDE.md files, instructions that define agent rules.',
    storage: 'Updated rarely, but referenced in every inference call',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.25)',
  },
  {
    id: 'working',
    icon: '🔧',
    label: 'Working',
    description: 'What the agent is thinking about right now.',
    example: 'Active context window, scratch notes, current task state.',
    storage: 'In-context only — resets each inference window',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
  },
]

const storagePatterns = [
  { label: 'Buffer', description: 'Full conversation history', pro: 'Maximum context', con: 'Grows linearly, hits limits fast', color: 'var(--red)' },
  { label: 'Summary', description: 'LLM-generated summaries', pro: 'Scales indefinitely', con: 'Higher cost, slightly lossy', color: 'var(--orange)' },
  { label: 'Window (last k)', description: 'Most recent k turns only', pro: 'Minimal tokens', con: 'Loses distant context', color: 'var(--blue)' },
  { label: 'Summary + Buffer', description: 'Summarize old + keep recent full', pro: 'Best balance for most agents', con: 'Needs parameter tuning', color: 'var(--green)', recommended: true },
]

export default function MemorySection() {
  return (
    <section id="memory" style={{ padding: '80px 24px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionLabel>Pillar: Write + Select</SectionLabel>
        <SectionTitle>Memory Systems</SectionTitle>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.7, marginBottom: 12, maxWidth: 600 }}>
          An assistant who forgets everything every day isn't very useful.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.7, marginBottom: 48, maxWidth: 600 }}>
          For agents operating across multiple turns or sessions, memory isn't a nice-to-have — it's the central context engineering problem.
        </p>

        {/* Memory types grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 48 }}>
          {memTypes.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{
                background: m.bg, border: `1px solid ${m.border}`,
                borderRadius: 12, padding: 20,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>{m.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: m.color, marginBottom: 6 }}>{m.label}</div>
              <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 10, lineHeight: 1.5 }}>{m.description}</p>
              <div style={{
                background: 'var(--surface2)', borderRadius: 6, padding: '8px 10px',
                fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 8,
              }}>
                "{m.example}"
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700, color: m.color }}>Storage: </span>{m.storage}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Storage patterns */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 }}>
            Storage Patterns
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {storagePatterns.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                style={{
                  background: 'var(--surface)', border: `1px solid ${p.recommended ? p.color : 'var(--border)'}`,
                  borderRadius: 10, padding: 16, position: 'relative',
                }}
              >
                {p.recommended && (
                  <div style={{
                    position: 'absolute', top: -10, right: 12,
                    background: p.color, color: '#fff', fontSize: 10,
                    fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  }}>★ RECOMMENDED</div>
                )}
                <div style={{ fontWeight: 700, fontSize: 14, color: p.color, marginBottom: 4 }}>{p.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>{p.description}</div>
                <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 4 }}>✓ {p.pro}</div>
                <div style={{ fontSize: 12, color: 'var(--red)' }}>— {p.con}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* File-based pattern */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 24,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>File-Based Persistent Memory (used by Claude Code)</div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            A simple but powerful pattern: a <code style={{ background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>/memories</code> directory where the agent reads at session start, writes during the session, and saves summaries before ending.
          </p>
          <div style={{
            background: 'var(--surface2)', borderRadius: 8, padding: '16px 18px',
            fontFamily: 'monospace', fontSize: 12, color: 'var(--text)', lineHeight: 1.8,
          }}>
            <span style={{ color: 'var(--accent)' }}>memories/</span><br />
            &nbsp;&nbsp;<span style={{ color: 'var(--green)' }}>user_profile.md</span>&nbsp;&nbsp;&nbsp;&nbsp;
            <span style={{ color: 'var(--text-muted)' }}># Who the user is, their preferences</span><br />
            &nbsp;&nbsp;<span style={{ color: 'var(--blue)' }}>project_context.md</span>&nbsp;
            <span style={{ color: 'var(--text-muted)' }}># Current project state and decisions</span><br />
            &nbsp;&nbsp;<span style={{ color: 'var(--orange)' }}>feedback.md</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <span style={{ color: 'var(--text-muted)' }}># What's worked, what hasn't</span><br />
            &nbsp;&nbsp;<span style={{ color: 'var(--text-muted)' }}>reference.md</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <span style={{ color: 'var(--text-muted)' }}># Pointers to external resources</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
