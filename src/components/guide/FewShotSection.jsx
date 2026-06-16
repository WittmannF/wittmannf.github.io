import { motion } from 'framer-motion'
import { SectionLabel, SectionTitle } from './ProblemSection'

export default function FewShotSection() {
  const tips = [
    { icon: '🎲', title: 'Diversity over quantity', desc: 'Cover different input types, not the same case five times.' },
    { icon: '📌', title: 'Canonical over edge cases', desc: 'Represent common patterns first. Weird edge cases confuse, not clarify.' },
    { icon: '📐', title: 'Consistent formatting', desc: 'Wrap in <example> tags. Mirror your desired output format exactly.' },
    { icon: '🎯', title: 'Match the desired output', desc: 'The model learns from what it sees. Show exactly what good output looks like.' },
  ]

  return (
    <section style={{ padding: '80px 24px', background: 'var(--surface)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <SectionLabel>System Prompt</SectionLabel>
        <SectionTitle>Few-Shot Examples</SectionTitle>

        <div style={{
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 12, padding: '20px 24px', marginBottom: 40,
        }}>
          <p style={{ fontSize: 17, color: 'var(--text)', lineHeight: 1.6, marginBottom: 8 }}>
            <strong>Three to five well-chosen examples outperform pages of written instructions.</strong>
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Showing examples is how humans learn too. A rulebook tells you WHAT to do; an example shows you HOW it looks in practice.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 40 }}>
          {tips.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}
            >
              <div style={{ fontSize: 24, marginBottom: 10 }}>{t.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>{t.title}</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Example */}
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
            Few-shot example format
          </div>
          <div style={{
            fontFamily: 'monospace', fontSize: 12, lineHeight: 1.9,
            background: 'var(--surface2)', borderRadius: 8, padding: '14px 18px', color: 'var(--text)',
            overflowX: 'auto',
          }}>
            <span style={{ color: 'var(--accent)' }}>&lt;examples&gt;</span><br />
            &nbsp;&nbsp;<span style={{ color: 'var(--blue)' }}>&lt;example&gt;</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: 'var(--orange)' }}>&lt;input&gt;</span>User: "Can you help me write a SQL query to find duplicate emails?"<span style={{ color: 'var(--orange)' }}>&lt;/input&gt;</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: 'var(--green)' }}>&lt;output&gt;</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: 'var(--text-muted)' }}>Sure. Here's a query that finds emails appearing more than once:</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: 'var(--text-muted)' }}>SELECT email, COUNT(*) FROM users</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: 'var(--text-muted)' }}>GROUP BY email HAVING COUNT(*) &gt; 1;</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: 'var(--green)' }}>&lt;/output&gt;</span><br />
            &nbsp;&nbsp;<span style={{ color: 'var(--blue)' }}>&lt;/example&gt;</span><br />
            <span style={{ color: 'var(--accent)' }}>&lt;/examples&gt;</span>
          </div>
        </div>
      </div>
    </section>
  )
}
