import { motion } from 'framer-motion'
import { ArrowDown, BookOpen, CheckSquare } from 'lucide-react'

const relevantPapers = [
  { label: 'System Prompt', rotate: -1.5, accent: true },
  { label: 'Retrieved Doc A', rotate: 1, accent: true },
  { label: 'User Query', rotate: -0.5, accent: true },
]

const filteredPapers = [
  { label: 'Junk email', rotate: 6 },
  { label: 'Old news', rotate: -8 },
  { label: 'Random doc', rotate: 12 },
  { label: 'Irrelevant', rotate: -4 },
]

function DeskVisual() {
  return (
    <div style={{
      width: '100%', maxWidth: 620, margin: '0 auto',
      background: 'var(--surface2)', borderRadius: 16,
      border: '1px solid var(--border)', padding: '20px 24px 16px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center', fontSize: 11, color: 'var(--text-muted)',
        letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600, marginBottom: 20,
      }}>
        LLM Context Window (The Desk)
      </div>

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 0, minHeight: 200 }}>

        {/* Left — relevant */}
        <div style={{ paddingRight: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {relevantPapers.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.12, duration: 0.4 }}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--accent)',
                borderRadius: 8, padding: '12px 16px',
                fontSize: 13, fontWeight: 600, color: 'var(--text)',
                transform: `rotate(${p.rotate}deg)`,
                boxShadow: '0 2px 12px rgba(99,102,241,0.12)',
              }}
            >
              {p.label}
            </motion.div>
          ))}
        </div>

        {/* Divider */}
        <div style={{
          background: 'var(--border)', margin: '0 0',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--surface2)', padding: '2px 0',
            fontSize: 9, color: 'var(--text-muted)', writingMode: 'vertical-rl',
            textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600,
            whiteSpace: 'nowrap',
          }}>pushed off</div>
        </div>

        {/* Right — filtered */}
        <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredPapers.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 0.45, x: 0 }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 12px',
                fontSize: 12, color: 'var(--text-muted)',
                transform: `rotate(${p.rotate}deg)`,
              }}
            >
              {p.label}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>✓ High-signal context</div>
        <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700 }}>✗ Filtered out</div>
      </div>
    </div>
  )
}

export default function HeroSection() {
  return (
    <section id="hero" style={{ padding: '80px 24px 60px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ textAlign: 'center', marginBottom: 56 }}
      >
        <div style={{
          display: 'inline-block', background: 'rgba(99,102,241,0.1)',
          border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20,
          padding: '4px 14px', fontSize: 12, color: 'var(--accent)',
          fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase',
          marginBottom: 24,
        }}>
          Interactive Guide
        </div>

        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 56px)', fontWeight: 800, lineHeight: 1.1,
          letterSpacing: '-1.5px', marginBottom: 20, color: 'var(--text)',
        }}>
          Context Engineering:
          <br />
          <span style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            How to Build AI Systems That Don't Fall Apart
          </span>
        </h1>

        <p style={{
          fontSize: 18, color: 'var(--text-muted)', maxWidth: 640,
          margin: '0 auto 36px', lineHeight: 1.7,
        }}>
          Prompting is only the beginning. Reliable AI systems require carefully designed context:
          retrieval, memory, tools, compression, state, and security.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#problem" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--accent)', color: '#fff',
            padding: '12px 24px', borderRadius: 10, fontWeight: 600, fontSize: 15,
            textDecoration: 'none',
          }}>
            <BookOpen size={16} /> Start the guide
          </a>
          <a href="#checklist" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--surface)', color: 'var(--text)',
            border: '1px solid var(--border)',
            padding: '12px 24px', borderRadius: 10, fontWeight: 600, fontSize: 15,
            textDecoration: 'none',
          }}>
            <CheckSquare size={16} /> Production checklist
          </a>
          <a href="/blog/context-engineering" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'transparent', color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            padding: '12px 24px', borderRadius: 10, fontWeight: 600, fontSize: 15,
            textDecoration: 'none',
          }}>
            ← Read the article
          </a>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <DeskVisual />
      </motion.div>

      <div style={{ textAlign: 'center', marginTop: 48 }}>
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <ArrowDown size={20} color="var(--text-muted)" />
        </motion.div>
      </div>
    </section>
  )
}
