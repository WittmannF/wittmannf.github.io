import { motion } from 'framer-motion'

export const SectionWrapper = ({ id, children, style = {} }) => (
  <section id={id} style={{ padding: '80px 24px', background: 'var(--surface)', ...style }}>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {children}
    </div>
  </section>
)

export const SectionLabel = ({ children, color }) => (
  <div style={{
    display: 'inline-block', background: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20,
    padding: '3px 12px', fontSize: 11, color: color || 'var(--accent)',
    fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 16,
  }}>{children}</div>
)

export const SectionTitle = ({ children }) => (
  <h2 style={{
    fontSize: 'clamp(22px, 3.5vw, 36px)', fontWeight: 800,
    letterSpacing: '-0.8px', marginBottom: 12, color: 'var(--text)',
  }}>{children}</h2>
)

export const Lead = ({ children }) => (
  <p style={{
    fontSize: 17, color: 'var(--text-muted)', lineHeight: 1.75,
    marginBottom: 40, maxWidth: 680,
  }}>{children}</p>
)

export const CodeBlock = ({ code, language = 'markdown', filename }) => (
  <div style={{
    background: '#0d1117', borderRadius: 10,
    border: '1px solid var(--border)', overflow: 'hidden',
    marginBottom: 24,
  }}>
    {filename && (
      <div style={{
        padding: '8px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', opacity: 0.8 }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{filename}</span>
      </div>
    )}
    <pre style={{
      margin: 0, padding: '16px 20px',
      fontFamily: 'monospace', fontSize: 13, lineHeight: 1.7,
      color: 'var(--text)', overflowX: 'auto', whiteSpace: 'pre',
    }}>
      <code>{code}</code>
    </pre>
  </div>
)

export const Callout = ({ type = 'info', icon, children }) => {
  const colors = {
    info: { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.25)', text: 'var(--accent)' },
    tip: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', text: 'var(--green)' },
    warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: 'var(--orange)' },
    danger: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', text: 'var(--red)' },
  }
  const c = colors[type]
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 10, padding: '14px 18px', marginBottom: 20,
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

export const Badge = ({ children, color }) => (
  <span style={{
    display: 'inline-block',
    background: color ? `${color}22` : 'rgba(99,102,241,0.12)',
    border: `1px solid ${color ? `${color}44` : 'rgba(99,102,241,0.3)'}`,
    borderRadius: 6, padding: '2px 8px',
    fontSize: 11, fontWeight: 700,
    color: color || 'var(--accent)',
    letterSpacing: 0.4, textTransform: 'uppercase',
  }}>{children}</span>
)

export function FadeIn({ children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
    >
      {children}
    </motion.div>
  )
}
