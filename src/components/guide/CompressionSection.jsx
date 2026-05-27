import { motion } from 'framer-motion'
import { SectionLabel, SectionTitle } from './ProblemSection'

const techniques = [
  {
    icon: '📝',
    title: 'Summarization',
    color: 'var(--blue)',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.25)',
    description: 'When the conversation grows long, condense older turns into a compact summary. The model continues with a condensed representation of the past.',
    tip: 'Err on the side of including more in summaries early on. Overly aggressive summarization loses subtle context that later turns out to be critical.',
  },
  {
    icon: '🔧',
    title: 'Tool Result Clearing',
    color: 'var(--orange)',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
    description: 'In agentic loops, tool results accumulate. After many calls, early raw outputs consume tokens but provide little value. Keep summaries, not raw outputs.',
    tip: 'Keep the last 5 tool calls in full; summarize the rest. This is often the lightest-touch compaction available.',
  },
  {
    icon: '✂️',
    title: 'Context Trimming',
    color: 'var(--green)',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.25)',
    description: 'Remove the oldest turns first, while always keeping the system prompt, user preferences established early, and current task context.',
    tip: null,
    warning: 'Never blindly trim from the front — the system prompt is at position 0. Trimming it destroys your agent\'s identity and constraints.',
  },
]

export default function CompressionSection() {
  return (
    <section style={{ padding: '80px 24px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionLabel>Pillar: Compress</SectionLabel>
        <SectionTitle>Context Compression</SectionTitle>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.7, marginBottom: 48, maxWidth: 600 }}>
          No matter how good your retrieval and memory are, conversations and agentic loops will eventually fill the context window. Compression handles this gracefully.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 40 }}>
          {techniques.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.12 }}
              style={{
                background: t.bg, border: `1px solid ${t.border}`,
                borderRadius: 12, padding: 22,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>{t.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: t.color, marginBottom: 8 }}>{t.title}</div>
              <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, marginBottom: 14 }}>{t.description}</p>

              {t.tip && (
                <div style={{
                  background: 'var(--surface2)', borderRadius: 6, padding: '8px 12px',
                  fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5,
                }}>
                  💡 {t.tip}
                </div>
              )}
              {t.warning && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 6, padding: '8px 12px',
                  fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5,
                }}>
                  <span style={{ color: 'var(--red)', fontWeight: 700 }}>⚠ </span>{t.warning}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Code example */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
            Tool result clearing — pattern
          </div>
          <div style={{
            fontFamily: 'monospace', fontSize: 12, lineHeight: 2,
            background: 'var(--surface2)', borderRadius: 8, padding: '14px 18px', color: 'var(--text)',
            overflowX: 'auto',
          }}>
            <span style={{ color: 'var(--text-muted)' }}># Keep the last N tool calls in full; summarize the rest</span><br />
            <span style={{ color: 'var(--blue)' }}>def</span> <span style={{ color: 'var(--green)' }}>manage_tool_history</span>(messages, keep_recent=<span style={{ color: 'var(--orange)' }}>5</span>):<br />
            &nbsp;&nbsp;tool_calls = [m <span style={{ color: 'var(--blue)' }}>for</span> m <span style={{ color: 'var(--blue)' }}>in</span> messages <span style={{ color: 'var(--blue)' }}>if</span> m[<span style={{ color: 'var(--orange)' }}>'role'</span>] == <span style={{ color: 'var(--orange)' }}>'tool'</span>]<br />
            &nbsp;&nbsp;<span style={{ color: 'var(--blue)' }}>if</span> len(tool_calls) &gt; keep_recent:<br />
            &nbsp;&nbsp;&nbsp;&nbsp;to_summarize = tool_calls[:-keep_recent]<br />
            &nbsp;&nbsp;&nbsp;&nbsp;summary = <span style={{ color: 'var(--green)' }}>summarize_tool_calls</span>(to_summarize)<br />
            &nbsp;&nbsp;&nbsp;&nbsp;messages = [m <span style={{ color: 'var(--blue)' }}>for</span> m <span style={{ color: 'var(--blue)' }}>in</span> messages <span style={{ color: 'var(--blue)' }}>if</span> m <span style={{ color: 'var(--blue)' }}>not in</span> to_summarize]<br />
            &nbsp;&nbsp;&nbsp;&nbsp;messages.insert(<span style={{ color: 'var(--orange)' }}>1</span>, {'{'}
            <span style={{ color: 'var(--orange)' }}>'role'</span>: <span style={{ color: 'var(--orange)' }}>'system'</span>, <span style={{ color: 'var(--orange)' }}>'content'</span>: <span style={{ color: 'var(--orange)' }}>`Previous tool results: ${'{'}summary{'}'}`</span>
            {'}'})<br />
            &nbsp;&nbsp;<span style={{ color: 'var(--blue)' }}>return</span> messages
          </div>
        </motion.div>
      </div>
    </section>
  )
}
