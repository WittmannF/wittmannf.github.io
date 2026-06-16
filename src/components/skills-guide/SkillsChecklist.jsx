import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckSquare, Square } from 'lucide-react'
import { FadeIn } from './shared'

const checklistData = [
  {
    category: 'Structure',
    icon: '📁',
    color: 'var(--accent)',
    items: [
      'Created the skills directory (.claude/skills/<name>/)',
      'SKILL.md is in the skill directory (not named differently)',
      'Chose the right scope: personal (~/.claude/), project (.claude/), or plugin',
      'Large instruction sets split into supporting files (references/, examples/)',
    ],
  },
  {
    category: 'Frontmatter',
    icon: '📋',
    color: 'var(--blue)',
    items: [
      'description: field present and specific (includes trigger phrases)',
      'allowed-tools: declared for any tools the skill needs',
      'argument-hint: set if the skill accepts arguments',
      'disable-model-invocation: true for any destructive operations',
    ],
  },
  {
    category: 'Content Quality',
    icon: '✍️',
    color: 'var(--green)',
    items: [
      'Instructions written in imperative/infinitive form ("Run tests", not "You should run")',
      'SKILL.md body stays under ~400 lines (5,000-token budget)',
      'Shell injection used for live data instead of static assumptions',
      '$ARGUMENTS (or $0/$1) referenced where user input is needed',
    ],
  },
  {
    category: 'Invocation',
    icon: '⚡',
    color: 'var(--orange)',
    items: [
      'Tested /skill-name invocation in a real Claude Code session',
      'Verified auto-invocation fires (or doesn\'t) as expected',
      'If file-conditional: paths: glob patterns tested against real files',
      'For forked skills: verified results return to main conversation',
    ],
  },
  {
    category: 'Safety',
    icon: '🔒',
    color: 'var(--red)',
    items: [
      'Destructive skills have disable-model-invocation: true',
      'Destructive skills require explicit user confirmation in the body',
      'allowed-tools uses specific patterns (Bash(npm *)) not Bash(*)',
      'No secrets or sensitive data hardcoded in SKILL.md',
    ],
  },
  {
    category: 'Polish',
    icon: '✨',
    color: '#ec4899',
    items: [
      'Skill name (directory) is kebab-case and descriptive',
      'description stays under 1,536 chars (hard limit)',
      'Supporting files have clear names (checklist.md, not stuff.md)',
      'Shared skills committed to .claude/skills/ in the repo',
    ],
  },
]

export default function SkillsChecklist() {
  const totalItems = checklistData.flatMap(c => c.items).length
  const [checked, setChecked] = useState(new Set())

  const toggle = (key) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const progress = Math.round((checked.size / totalItems) * 100)
  const resetAll = () => setChecked(new Set())

  return (
    <section id="checklist" style={{ padding: '80px 24px', background: 'var(--surface)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <FadeIn>
          <div style={{
            display: 'inline-block', background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20,
            padding: '3px 12px', fontSize: 11, color: 'var(--accent)',
            fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
            marginBottom: 16,
          }}>
            Checklist
          </div>
          <h2 style={{
            fontSize: 'clamp(22px, 3.5vw, 36px)', fontWeight: 800,
            letterSpacing: '-0.8px', marginBottom: 12, color: 'var(--text)',
          }}>
            Skills Quality Checklist
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.7, marginBottom: 32, maxWidth: 600 }}>
            Run through this before shipping any skill. Covers structure, frontmatter, content, safety, and polish.
          </p>
        </FadeIn>

        {/* Progress bar */}
        <FadeIn delay={0.1}>
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                {checked.size} / {totalItems} completed
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: progress === 100 ? 'var(--green)' : 'var(--accent)' }}>
                  {progress}%
                </div>
                {checked.size > 0 && (
                  <button
                    onClick={resetAll}
                    style={{
                      background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                      padding: '3px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)',
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
                style={{
                  height: '100%', borderRadius: 4,
                  background: progress === 100 ? 'var(--green)' : 'linear-gradient(90deg, var(--accent), var(--accent2))',
                }}
              />
            </div>
            {progress === 100 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                style={{
                  marginTop: 12, padding: '10px 16px',
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: 8, fontSize: 14, color: 'var(--green)', fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                ✅ Skill is ready to ship!
              </motion.div>
            )}
          </div>
        </FadeIn>

        {/* Checklist grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {checklistData.map((cat, ci) => (
            <motion.div
              key={ci}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: ci * 0.08 }}
              style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 20,
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>{cat.icon}</span>
                <div style={{ fontWeight: 700, fontSize: 15, color: cat.color }}>{cat.category}</div>
                <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                  {cat.items.filter((_, ii) => checked.has(`${ci}-${ii}`)).length}/{cat.items.length}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cat.items.map((item, ii) => {
                  const key = `${ci}-${ii}`
                  const isChecked = checked.has(key)
                  return (
                    <div
                      key={ii}
                      onClick={() => toggle(key)}
                      style={{
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                        cursor: 'pointer', padding: '6px 8px', borderRadius: 6,
                        background: isChecked ? 'rgba(16,185,129,0.07)' : 'transparent',
                        border: `1px solid ${isChecked ? 'rgba(16,185,129,0.25)' : 'transparent'}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ marginTop: 1, color: isChecked ? 'var(--green)' : 'var(--text-muted)', flexShrink: 0 }}>
                        {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                      </div>
                      <span style={{
                        fontSize: 13, lineHeight: 1.5,
                        color: isChecked ? 'var(--text-muted)' : 'var(--text)',
                        textDecoration: isChecked ? 'line-through' : 'none',
                      }}>
                        {item}
                      </span>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
