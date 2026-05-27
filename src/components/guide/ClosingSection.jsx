import { motion } from 'framer-motion'
import { CheckSquare, ArrowUp } from 'lucide-react'

export default function ClosingSection() {
  return (
    <section style={{ padding: '100px 24px 80px', background: 'var(--bg)', textAlign: 'center' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}
        >
          <div style={{ fontSize: 48, marginBottom: 24 }}>⬡</div>

          <h2 style={{
            fontSize: 'clamp(22px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-1px',
            lineHeight: 1.2, marginBottom: 28, color: 'var(--text)',
          }}>
            The Enduring Principle
          </h2>

          <div style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 16, padding: '32px 40px', marginBottom: 48,
          }}>
            <p style={{
              fontSize: 'clamp(15px, 2vw, 18px)', color: 'var(--text)',
              lineHeight: 1.75, fontStyle: 'italic',
            }}>
              "Reliable AI systems are not built by simply writing better prompts. They are built by managing what the model knows, when it knows it, and how that information enters the context window."
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 48, textAlign: 'left' }}>
            {[
              { icon: '💥', text: 'Most LLM failures are context failures — not model failures' },
              { icon: '📐', text: 'More context is not automatically better. Curate, don\'t fill' },
              { icon: '🏗️', text: 'RAG, memory, compression, and agents are all context engineering' },
              { icon: '🛡️', text: 'Retrieved content is untrusted data — never instructions' },
              { icon: '📊', text: 'Measure task completion, not just response quality' },
              { icon: '✅', text: 'Run the checklist before every production ship' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start',
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.text}</span>
              </motion.div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <a href="#checklist" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--accent)', color: '#fff',
              padding: '12px 24px', borderRadius: 10, fontWeight: 600, fontSize: 15,
              textDecoration: 'none',
            }}>
              <CheckSquare size={16} /> Use the checklist before shipping
            </a>
            <a href="#hero" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--surface)', color: 'var(--text)',
              border: '1px solid var(--border)',
              padding: '12px 24px', borderRadius: 10, fontWeight: 600, fontSize: 15,
              textDecoration: 'none',
            }}>
              <ArrowUp size={16} /> Back to top
            </a>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            Based on the article{' '}
            <a href="/blog/context-engineering" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              Context Engineering: The Definitive Guide to Building Better AI Systems
            </a>.
            <br />
            Further reading: Anthropic's "Effective Context Engineering for AI Agents" · LangChain's Context Engineering guide · "Lost in the Middle" (Liu et al., 2023)
          </div>
        </motion.div>
      </div>
    </section>
  )
}
