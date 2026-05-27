import { motion } from 'framer-motion'
import { ArrowDown, BookOpen, CheckSquare } from 'lucide-react'

function DeskVisual() {
  const papers = [
    { label: 'System Prompt', x: 20, y: 20, w: 160, h: 80, relevant: true, rotate: -2 },
    { label: 'Retrieved Doc A', x: 40, y: 115, w: 140, h: 70, relevant: true, rotate: 1 },
    { label: 'User Query', x: 60, y: 200, w: 130, h: 60, relevant: true, rotate: -1 },
    { label: 'Junk email', x: 340, y: 30, w: 110, h: 55, relevant: false, rotate: 8, opacity: 0.5 },
    { label: 'Old news', x: 380, y: 110, w: 90, h: 45, relevant: false, rotate: -12, opacity: 0.4 },
    { label: 'Random doc', x: 320, y: 170, w: 120, h: 50, relevant: false, rotate: 15, opacity: 0.45 },
    { label: 'Irrelevant', x: 370, y: 230, w: 100, h: 40, relevant: false, rotate: -5, opacity: 0.4 },
  ]

  return (
    <div style={{
      position: 'relative', width: '100%', maxWidth: 520, height: 300,
      background: 'var(--surface2)', borderRadius: 16, margin: '0 auto',
      border: '1px solid var(--border)', overflow: 'visible',
    }}>
      {/* Desk label */}
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase',
        fontWeight: 600,
      }}>LLM Context Window (The Desk)</div>

      {/* Divider */}
      <div style={{
        position: 'absolute', left: '57%', top: 40, bottom: 16,
        width: 2, background: 'var(--border)',
        borderStyle: 'dashed',
      }} />
      <div style={{
        position: 'absolute', left: '62%', top: 50,
        fontSize: 10, color: 'var(--text-muted)',
      }}>pushed off</div>

      {/* Papers */}
      {papers.map((p, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: p.opacity ?? 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.4 }}
          style={{
            position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h,
            background: p.relevant ? 'var(--surface)' : 'var(--surface2)',
            border: `1px solid ${p.relevant ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 6,
            transform: `rotate(${p.rotate}deg)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 500,
            color: p.relevant ? 'var(--text)' : 'var(--text-muted)',
            boxShadow: p.relevant ? '0 2px 8px rgba(99,102,241,0.15)' : 'none',
          }}
        >
          {p.label}
        </motion.div>
      ))}

      {/* Labels */}
      <div style={{
        position: 'absolute', bottom: 8, left: 20, fontSize: 10,
        color: 'var(--green)', fontWeight: 600,
      }}>✓ High-signal context</div>
      <div style={{
        position: 'absolute', bottom: 8, right: 20, fontSize: 10,
        color: 'var(--red)', fontWeight: 600,
      }}>✗ Filtered out</div>
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
          letterSpacing: '-1.5px', marginBottom: 20,
          color: 'var(--text)',
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
            textDecoration: 'none', transition: 'opacity 0.15s',
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
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <ArrowDown size={20} color="var(--text-muted)" />
        </motion.div>
      </div>
    </section>
  )
}
