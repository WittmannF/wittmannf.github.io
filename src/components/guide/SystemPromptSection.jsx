import { motion } from 'framer-motion'
import { SectionLabel, SectionTitle } from './ProblemSection'

export default function SystemPromptSection() {
  return (
    <section style={{ padding: '80px 24px', background: 'var(--surface)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionLabel>Pillar: Write</SectionLabel>
        <SectionTitle>System Prompt Design</SectionTitle>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.7, marginBottom: 48, maxWidth: 600 }}>
          The system prompt is the foundation of everything. Present in every inference call — a well-crafted system prompt multiplies the impact of everything that comes after it.
        </p>

        {/* Principles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 48 }}>
          {[
            { icon: '🎯', title: 'Right Altitude', desc: 'Too prescriptive → brittle. Too vague → unpredictable. Aim for the right level of specificity.' },
            { icon: '🧠', title: 'Motivation Over Commands', desc: 'Explain WHY constraints exist. "Avoid ellipses because they\'re hard for text-to-speech" beats "never use ellipses."', highlight: true },
            { icon: '📐', title: 'Structured for Complexity', desc: 'For complex prompts, use XML tags to separate role, context, instructions, and format.' },
            { icon: '👁️', title: 'The Golden Rule', desc: 'Show your system prompt to a colleague without explaining it. If they\'d be confused, the model will be too.' },
          ].map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{
                background: p.highlight ? 'rgba(99,102,241,0.08)' : 'var(--bg)',
                border: `1px solid ${p.highlight ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                borderRadius: 12, padding: 20,
              }}
            >
              <div style={{ fontSize: 26, marginBottom: 10 }}>{p.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 8 }}>{p.title}</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{p.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Bad vs Good instruction */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 }}>
            Motivation over commands — example
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>✗ Command without reason</div>
              <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '10px 14px', fontFamily: 'monospace', fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>
                "Never use ellipses."
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>The model follows this literally but can't generalize to similar cases like long pauses or trailing dashes.</p>
            </div>
            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>✓ Command with reason</div>
              <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '10px 14px', fontFamily: 'monospace', fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>
                "The answer will be read aloud by text-to-speech, so avoid ellipses because they are hard to pronounce."
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>The model understands the goal and generalizes — avoids other TTS-unfriendly patterns too.</p>
            </div>
          </div>
        </div>

        {/* XML structure */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}
        >
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 12 }}>XML Structure for Complex Prompts</div>
          <div style={{
            background: 'var(--surface2)', borderRadius: 8, padding: '16px 18px',
            fontFamily: 'monospace', fontSize: 12, color: 'var(--text)', lineHeight: 2,
            overflowX: 'auto',
          }}>
            <span style={{ color: 'var(--accent)' }}>&lt;system&gt;</span><br />
            &nbsp;&nbsp;<span style={{ color: 'var(--blue)' }}>&lt;role&gt;</span>
            <span style={{ color: 'var(--text-muted)' }}>You are a senior code reviewer focused on security and performance.</span>
            <span style={{ color: 'var(--blue)' }}>&lt;/role&gt;</span><br />
            <br />
            &nbsp;&nbsp;<span style={{ color: 'var(--blue)' }}>&lt;context&gt;</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: 'var(--text-muted)' }}>This codebase uses Python 3.11, FastAPI, and PostgreSQL.</span><br />
            &nbsp;&nbsp;<span style={{ color: 'var(--blue)' }}>&lt;/context&gt;</span><br />
            <br />
            &nbsp;&nbsp;<span style={{ color: 'var(--blue)' }}>&lt;instructions&gt;</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: 'var(--text-muted)' }}>- Flag any SQL injection risks immediately</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: 'var(--text-muted)' }}>- Comment on time complexity for DB operations</span><br />
            &nbsp;&nbsp;<span style={{ color: 'var(--blue)' }}>&lt;/instructions&gt;</span><br />
            <br />
            &nbsp;&nbsp;<span style={{ color: 'var(--blue)' }}>&lt;format&gt;</span>
            <span style={{ color: 'var(--text-muted)' }}>Critical Issues → Performance → Style</span>
            <span style={{ color: 'var(--blue)' }}>&lt;/format&gt;</span><br />
            <span style={{ color: 'var(--accent)' }}>&lt;/system&gt;</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
