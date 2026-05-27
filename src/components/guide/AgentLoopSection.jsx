import { motion } from 'framer-motion'
import { SectionLabel, SectionTitle } from './ProblemSection'

const loopSteps = [
  { icon: '📋', label: 'Task arrives', color: 'var(--blue)' },
  { icon: '🧠', label: 'Model reasons', color: 'var(--accent)' },
  { icon: '🔧', label: 'Tool call', color: 'var(--orange)' },
  { icon: '📊', label: 'Tool result', color: 'var(--green)' },
  { icon: '📝', label: 'Update context', color: 'var(--text-muted)', danger: true },
  { icon: '🔁', label: 'Next step', color: 'var(--accent2)' },
]

const strategies = [
  { title: 'Summarize old tool results', desc: 'After N tool calls, compress old results to summaries. Keep recent ones in full.' },
  { title: 'Preserve key constraints', desc: 'Never remove user constraints or high-level task goals from context.' },
  { title: 'Compact when token usage is high', desc: 'Monitor token count in the loop. Trigger compaction before you hit the limit.' },
  { title: 'Use progress notes', desc: 'Write state to a file so you can recover cleanly if context is reset.' },
]

export default function AgentLoopSection() {
  return (
    <section id="agents" style={{ padding: '80px 24px', background: 'var(--surface)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <SectionLabel>Pillar: Compress + Isolate</SectionLabel>
        <SectionTitle>Agentic Loops and Tool Use</SectionTitle>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.7, marginBottom: 48, maxWidth: 600 }}>
          Agents run in loops across many chained inference calls. The context grows with every step. A context mistake at step 3 can silently corrupt everything that follows.
        </p>

        {/* Loop diagram */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 20 }}>
            The agentic loop
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, alignItems: 'center' }}>
            {loopSteps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 }}
                  style={{
                    background: step.danger ? 'rgba(239,68,68,0.08)' : 'var(--bg)',
                    border: `2px solid ${step.danger ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
                    borderRadius: 12, padding: '14px 18px', textAlign: 'center',
                    minWidth: 100, position: 'relative',
                  }}
                >
                  {step.danger && (
                    <div style={{
                      position: 'absolute', top: -10, right: -10,
                      background: 'var(--red)', color: '#fff', fontSize: 9,
                      fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    }}>CRITICAL</div>
                  )}
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{step.icon}</div>
                  <div style={{ fontSize: 11, color: step.color, fontWeight: 600 }}>{step.label}</div>
                </motion.div>
                {i < loopSteps.length - 1 && (
                  <div style={{ fontSize: 18, color: 'var(--text-muted)', margin: '0 4px' }}>→</div>
                )}
              </div>
            ))}
            <div style={{ fontSize: 18, color: 'var(--accent)', margin: '0 4px' }}>↺</div>
          </div>
          <div style={{
            marginTop: 16, padding: '12px 16px',
            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 8, fontSize: 13, color: 'var(--text-muted)',
          }}>
            <span style={{ color: 'var(--red)', fontWeight: 700 }}>⚠ The risk: </span>
            If context is poorly managed at step 5, the agent may quietly fail at step 15 — with no obvious error.
          </div>
        </div>

        {/* Strategies */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 40 }}>
          {strategies.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>{s.title}</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Code */}
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
            Basic agentic loop with context management
          </div>
          <div style={{
            fontFamily: 'monospace', fontSize: 12, lineHeight: 1.9,
            background: 'var(--surface2)', borderRadius: 8, padding: '14px 18px', color: 'var(--text)',
            overflowX: 'auto',
          }}>
            messages = [{'{'}
            <span style={{ color: 'var(--orange)' }}>"role"</span>: <span style={{ color: 'var(--orange)' }}>"user"</span>, <span style={{ color: 'var(--orange)' }}>"content"</span>: task{'}'}]<br />
            <br />
            <span style={{ color: 'var(--blue)' }}>while</span> <span style={{ color: 'var(--blue)' }}>True</span>:<br />
            &nbsp;&nbsp;response = client.messages.create(<br />
            &nbsp;&nbsp;&nbsp;&nbsp;model=<span style={{ color: 'var(--orange)' }}>"claude-sonnet-4-6"</span>, tools=tools, messages=messages<br />
            &nbsp;&nbsp;)<br />
            &nbsp;&nbsp;<span style={{ color: 'var(--blue)' }}>if</span> response.stop_reason == <span style={{ color: 'var(--orange)' }}>"end_turn"</span>: <span style={{ color: 'var(--blue)' }}>break</span><br />
            &nbsp;&nbsp;<span style={{ color: 'var(--blue)' }}>if</span> response.stop_reason == <span style={{ color: 'var(--orange)' }}>"tool_use"</span>:<br />
            &nbsp;&nbsp;&nbsp;&nbsp;tool_results = <span style={{ color: 'var(--green)' }}>execute_tools</span>(response.content)<br />
            &nbsp;&nbsp;&nbsp;&nbsp;messages.append({'{'}...<span style={{ color: 'var(--orange)' }}>"assistant"</span>...{'}'})<br />
            &nbsp;&nbsp;&nbsp;&nbsp;messages.append({'{'}...<span style={{ color: 'var(--orange)' }}>"tool_results"</span>...{'}'})<br />
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: 'var(--accent)', fontWeight: 700 }}># Context engineering happens here</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;messages = <span style={{ color: 'var(--green)' }}>trim_if_needed</span>(messages)
          </div>
        </div>
      </div>
    </section>
  )
}
