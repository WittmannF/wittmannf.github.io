import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft, Terminal } from 'lucide-react'
import { SectionWrapper, SectionLabel, SectionTitle, Lead, CodeBlock, Callout, FadeIn } from './shared'

const steps = [
  {
    id: 'create-dir',
    title: 'Create the skill directory',
    subtitle: 'Step 1 of 4',
    explanation: 'Every skill lives in its own directory inside .claude/skills/. The directory name becomes the slash command name.',
    command: 'mkdir -p .claude/skills/greet',
    note: 'For a personal skill available in all projects, use ~/.claude/skills/greet instead.',
  },
  {
    id: 'write-skill',
    title: 'Create SKILL.md',
    subtitle: 'Step 2 of 4',
    explanation: 'SKILL.md is the only required file. Write natural language instructions — Claude will follow them when the skill is invoked.',
    code: `---
name: greet
description: Greet the user with a personalized message
---

Greet the user warmly.

If $ARGUMENTS contains a name, address them by name.
Otherwise use "friend" as a fallback.

Keep the greeting short — one sentence.`,
    filename: '.claude/skills/greet/SKILL.md',
    note: 'The description field is critical — Claude reads it to decide when to auto-invoke this skill.',
  },
  {
    id: 'invoke',
    title: 'Invoke your skill',
    subtitle: 'Step 3 of 4',
    explanation: 'You can now use /greet from anywhere inside the project. Claude loads the SKILL.md and follows its instructions.',
    terminal: [
      { type: 'input', text: '/greet Fernando' },
      { type: 'output', text: 'Hey Fernando! Great to see you today.' },
      { type: 'input', text: '/greet' },
      { type: 'output', text: 'Hey friend! Hope you\'re having a good session.' },
    ],
    note: 'Skill names are case-insensitive. /Greet and /greet both work.',
  },
  {
    id: 'improve',
    title: 'Add supporting files',
    subtitle: 'Step 4 of 4',
    explanation: 'Skills can have supporting files — templates, checklists, scripts. Claude loads them when relevant. This is what makes skills powerful over plain commands.',
    code: '# .claude/skills/greet/\n# ├── SKILL.md          ← main instructions\n# ├── templates.md      ← greeting templates\n# └── scripts/\n#     └── log.sh        ← post-greeting logging\n\n---\nname: greet\ndescription: Greet the user with a personalized message\nallowed-tools: Bash(bash scripts/log.sh *)\n---\n\nGreet the user warmly using a template from templates.md.\n\nLog the greeting by running:\n  !`bash ${CLAUDE_SKILL_DIR}/scripts/log.sh "$ARGUMENTS"`',
    filename: '.claude/skills/greet/SKILL.md (extended)',
    note: '${CLAUDE_SKILL_DIR} always resolves to the absolute path of the skill directory, regardless of where Claude is invoked from.',
  },
]

function TerminalDemo({ lines }) {
  return (
    <div style={{
      background: '#0d1117', borderRadius: 10, border: '1px solid var(--border)',
      padding: '16px 20px', fontFamily: 'monospace', fontSize: 14,
    }}>
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
          <span style={{ color: line.type === 'input' ? 'var(--green)' : 'var(--text-muted)', flexShrink: 0 }}>
            {line.type === 'input' ? '>' : ' '}
          </span>
          <span style={{ color: line.type === 'input' ? 'var(--text)' : 'var(--accent)' }}>
            {line.text}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function FirstSkillSection() {
  const [step, setStep] = useState(0)
  const current = steps[step]

  return (
    <SectionWrapper id="first-skill" style={{ background: 'var(--bg)' }}>
      <FadeIn>
        <SectionLabel>Beginner</SectionLabel>
        <SectionTitle>Your First Skill in 4 Steps</SectionTitle>
        <Lead>
          Let's build a real skill from scratch. Click through each step —
          by the end you'll have a working /greet command and understand the core mechanics.
        </Lead>
      </FadeIn>

      {/* Step progress */}
      <FadeIn delay={0.1}>
        <div style={{ display: 'flex', gap: 0, marginBottom: 40, position: 'relative' }}>
          <div style={{
            position: 'absolute', top: '50%', left: 24, right: 24,
            height: 2, background: 'var(--border)', zIndex: 0,
            transform: 'translateY(-50%)',
          }} />
          <div style={{
            position: 'absolute', top: '50%', left: 24, height: 2,
            background: 'var(--accent)', zIndex: 0,
            transform: 'translateY(-50%)',
            width: `${(step / (steps.length - 1)) * (100 - (48 / 600 * 100))}%`,
            transition: 'width 0.3s ease',
          }} />
          {steps.map((s, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', justifyContent: 'center', zIndex: 1 }}>
              <button
                onClick={() => setStep(i)}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: `2px solid ${i <= step ? 'var(--accent)' : 'var(--border)'}`,
                  background: i < step ? 'var(--accent)' : i === step ? 'var(--accent)22' : 'var(--bg)',
                  color: i <= step ? (i < step ? '#fff' : 'var(--accent)') : 'var(--text-muted)',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {i < step ? '✓' : i + 1}
              </button>
            </div>
          ))}
        </div>
      </FadeIn>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '28px 32px', marginBottom: 24,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--accent)',
              letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
            }}>
              {current.subtitle}
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>
              {current.title}
            </h3>
            <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24 }}>
              {current.explanation}
            </p>

            {current.command && (
              <div style={{
                background: '#0d1117', borderRadius: 10, border: '1px solid var(--border)',
                padding: '14px 20px', marginBottom: 16, fontFamily: 'monospace', fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Terminal size={14} color="var(--green)" />
                <span style={{ color: 'var(--green)' }}>$</span>
                <span style={{ color: 'var(--text)' }}>{current.command}</span>
              </div>
            )}

            {current.code && (
              <CodeBlock code={current.code} filename={current.filename} />
            )}

            {current.terminal && (
              <TerminalDemo lines={current.terminal} />
            )}

            {current.note && (
              <div style={{
                marginTop: 16, padding: '10px 14px',
                background: 'rgba(99,102,241,0.07)', borderRadius: 8,
                fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6,
                borderLeft: '3px solid var(--accent)',
              }}>
                <strong style={{ color: 'var(--accent)' }}>Note:</strong> {current.note}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, cursor: step === 0 ? 'not-allowed' : 'pointer',
            border: '1px solid var(--border)', background: 'transparent',
            color: step === 0 ? 'var(--border)' : 'var(--text-muted)',
            fontWeight: 600, fontSize: 14, transition: 'all 0.15s',
          }}
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <button
          onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))}
          disabled={step === steps.length - 1}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, cursor: step === steps.length - 1 ? 'not-allowed' : 'pointer',
            border: '1px solid var(--accent)', background: step === steps.length - 1 ? 'transparent' : 'var(--accent)',
            color: step === steps.length - 1 ? 'var(--border)' : '#fff',
            fontWeight: 600, fontSize: 14, transition: 'all 0.15s',
          }}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </SectionWrapper>
  )
}
