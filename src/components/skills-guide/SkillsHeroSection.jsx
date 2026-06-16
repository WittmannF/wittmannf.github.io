import { motion } from 'framer-motion'
import { ArrowDown, BookOpen, CheckSquare, Zap } from 'lucide-react'

function TerminalLine({ children, delay = 0, prompt = true, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35 }}
      style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}
    >
      {prompt && (
        <span style={{ color: 'var(--green)', fontWeight: 700, flexShrink: 0 }}>$</span>
      )}
      <span style={{ color: color || 'var(--text)', fontFamily: 'monospace', fontSize: 14, lineHeight: 1.5 }}>
        {children}
      </span>
    </motion.div>
  )
}

function TerminalVisual() {
  return (
    <div style={{
      width: '100%', maxWidth: 640, margin: '0 auto',
      background: '#0d1117', borderRadius: 14,
      border: '1px solid var(--border)', overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    }}>
      {/* Title bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        {['#ef4444','#f59e0b','#10b981'].map((c, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
        ))}
        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          ~/myproject — claude
        </span>
      </div>

      {/* Terminal body */}
      <div style={{ padding: '20px 24px' }}>
        <TerminalLine delay={0.1}>claude</TerminalLine>
        <TerminalLine delay={0.5} prompt={false} color="var(--text-muted)">
          ✓ Claude Code v1.0 — type /help for commands
        </TerminalLine>
        <div style={{ height: 10 }} />
        <TerminalLine delay={0.9} color="var(--text-muted)" prompt={false}>
          <span style={{ color: 'var(--text)' }}>You:</span> /deploy staging
        </TerminalLine>
        <TerminalLine delay={1.3} prompt={false} color="var(--accent)">
          ▸ Running /deploy skill...
        </TerminalLine>
        <TerminalLine delay={1.6} prompt={false} color="var(--text-muted)">
          &nbsp;&nbsp;✓ Tests passed (42/42)
        </TerminalLine>
        <TerminalLine delay={1.9} prompt={false} color="var(--text-muted)">
          &nbsp;&nbsp;✓ Build succeeded
        </TerminalLine>
        <TerminalLine delay={2.2} prompt={false} color="var(--text-muted)">
          &nbsp;&nbsp;✓ Deployed to staging.myapp.com
        </TerminalLine>
        <TerminalLine delay={2.5} prompt={false} color="var(--green)">
          &nbsp;&nbsp;🚀 Done in 14s
        </TerminalLine>
        <div style={{ height: 10 }} />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ delay: 3, duration: 1.2, repeat: Infinity }}
          style={{
            display: 'inline-block', width: 8, height: 16,
            background: 'var(--text)', marginLeft: 2,
          }}
        />
      </div>
    </div>
  )
}

export default function SkillsHeroSection() {
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
          Claude Code Skills:
          <br />
          <span style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            From Zero to Advanced
          </span>
        </h1>

        <p style={{
          fontSize: 18, color: 'var(--text-muted)', maxWidth: 640,
          margin: '0 auto 36px', lineHeight: 1.7,
        }}>
          Skills turn Claude into a specialist for your exact workflow. Learn to create
          slash commands, auto-triggered helpers, and multi-file automation systems —
          step by step, from your first one-liner to production-grade tools.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#why-skills" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--accent)', color: '#fff',
            padding: '12px 24px', borderRadius: 10, fontWeight: 600, fontSize: 15,
            textDecoration: 'none',
          }}>
            <BookOpen size={16} /> Start learning
          </a>
          <a href="#checklist" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--surface)', color: 'var(--text)',
            border: '1px solid var(--border)',
            padding: '12px 24px', borderRadius: 10, fontWeight: 600, fontSize: 15,
            textDecoration: 'none',
          }}>
            <CheckSquare size={16} /> Best practices checklist
          </a>
          <a href="#real-world" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'transparent', color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            padding: '12px 24px', borderRadius: 10, fontWeight: 600, fontSize: 15,
            textDecoration: 'none',
          }}>
            <Zap size={16} /> Real-world examples
          </a>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <TerminalVisual />
      </motion.div>

      <div style={{ textAlign: 'center', marginTop: 48 }}>
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <ArrowDown size={20} color="var(--text-muted)" />
        </motion.div>
      </div>
    </section>
  )
}
