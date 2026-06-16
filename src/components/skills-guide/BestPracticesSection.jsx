import { motion } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'
import { SectionWrapper, SectionLabel, SectionTitle, Lead, CodeBlock, Callout, FadeIn } from './shared'

const practices = [
  {
    id: 'description',
    icon: '🎯',
    title: 'Write descriptions like a detective brief',
    color: 'var(--accent)',
    good: `---
description: |
  Deploy the application to staging or production.
  Invoke when user says "deploy", "ship", "release",
  "push to staging", "go live", or asks to push a new version.
  Handles test run, build, and deployment pipeline.
---`,
    bad: `---
description: Deploy the app.
---`,
    goodLabel: 'Specific triggers + what it handles',
    badLabel: 'Too vague — Claude won\'t know when to auto-invoke',
    explanation: 'The description is loaded at session start. It\'s how Claude decides when to fire the skill. Be specific about trigger phrases. Think: "what would a user say right before needing this?"',
  },
  {
    id: 'size',
    icon: '📏',
    title: 'Keep SKILL.md focused — defer detail to supporting files',
    color: 'var(--green)',
    good: `---
name: review
description: Review the current diff for code quality
---

Review the diff for correctness, tests, and conventions.

Detailed coding standards: See conventions.md
Security checklist: See security-checklist.md
Performance guidelines: See performance.md`,
    bad: `---
name: review
description: Review code
---

## Coding Standards
[500 lines of standards that are always loaded into context...]

## Security Checklist
[200 more lines...]`,
    goodLabel: 'Lean SKILL.md with references',
    badLabel: 'Monolithic — wastes tokens on rules Claude doesn\'t always need',
    explanation: 'SKILL.md body has a 5,000-token compaction budget per session. Large skills get truncated. Move details to reference files — Claude loads them on demand.',
  },
  {
    id: 'tools',
    icon: '🔧',
    title: 'Declare allowed-tools to reduce friction',
    color: 'var(--orange)',
    good: `---
name: test-and-fix
description: Run tests and fix failures
allowed-tools: Bash(npm test) Bash(npm run test:*) Read Edit Write
---

Run tests and fix any failures.`,
    bad: `---
name: test-and-fix
description: Run tests and fix failures
---

Run tests with npm test and fix any failures.
[Claude asks for permission on every tool use]`,
    goodLabel: 'Pre-approved tools = no permission prompts',
    badLabel: 'Every tool use triggers a permission dialog',
    explanation: 'allowed-tools pre-approves tools for the duration of the skill. Be specific — Bash(npm test) not Bash(*). This reduces interruptions and makes the skill feel seamless.',
  },
  {
    id: 'imperative',
    icon: '📝',
    title: 'Use imperative/infinitive form in instructions',
    color: '#ec4899',
    good: `# Steps
1. Run the test suite
2. If tests pass, build the application
3. Deploy to the target environment
4. Verify the health check endpoint`,
    bad: `# Steps
1. You should run the test suite
2. The tests need to pass before you can build
3. The application should then be deployed
4. Please make sure to verify the health check`,
    goodLabel: 'Imperative — direct and unambiguous',
    badLabel: 'Hedging language wastes tokens and introduces ambiguity',
    explanation: 'Claude follows instructions best when they\'re direct. "Run tests" is clearer than "You should run the tests". Imperative also compresses better when Claude caches skill context.',
  },
  {
    id: 'no-assume',
    icon: '🔍',
    title: 'Use shell injection instead of assuming file locations',
    color: 'var(--blue)',
    good: `## Current environment
Node: !\`node --version\`
Package manager: !\`ls package.json yarn.lock pnpm-lock.yaml 2>/dev/null | head -1\`
Recent commits: !\`git log --oneline -5\``,
    bad: `## Environment
- Assume Node.js 18
- Assume npm
- Assume main branch is up to date`,
    goodLabel: 'Live data from shell injection',
    badLabel: 'Assumptions that may be wrong in practice',
    explanation: 'Skills are shared across machines and teams. Assumptions about package managers, Node versions, or branch state break silently. Use !`...` to inject actual state.',
  },
  {
    id: 'destructive',
    icon: '⚠️',
    title: 'Gate destructive operations behind explicit confirmation',
    color: 'var(--red)',
    good: `---
name: cleanup-docker
disable-model-invocation: true
---

This will remove ALL stopped Docker containers and dangling images.

Before proceeding, confirm:
- You are not in a production environment
- There are no containers you want to keep stopped

Type "yes I'm sure" to continue, or anything else to cancel.`,
    bad: `---
name: cleanup-docker
description: Clean up Docker resources
---

Remove all stopped containers and dangling images.`,
    goodLabel: 'Explicit confirmation + disabled auto-invoke',
    badLabel: 'Auto-invocable destructive operation — dangerous',
    explanation: 'For irreversible operations, use disable-model-invocation: true so Claude can\'t accidentally trigger it. Then require explicit confirmation in the skill body.',
  },
]

function PracticeCard({ practice, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06 }}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '24px 28px', marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>{practice.icon}</span>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {practice.title}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {practice.explanation}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <CheckCircle2 size={14} color="var(--green)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', letterSpacing: 0.8, textTransform: 'uppercase' }}>
              {practice.goodLabel}
            </span>
          </div>
          <CodeBlock code={practice.good} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <XCircle size={14} color="var(--red)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', letterSpacing: 0.8, textTransform: 'uppercase' }}>
              {practice.badLabel}
            </span>
          </div>
          <CodeBlock code={practice.bad} />
        </div>
      </div>
    </motion.div>
  )
}

export default function BestPracticesSection() {
  return (
    <SectionWrapper id="best-practices" style={{ background: 'var(--bg)' }}>
      <FadeIn>
        <SectionLabel>Best Practices</SectionLabel>
        <SectionTitle>What Good Skills Look Like</SectionTitle>
        <Lead>
          Six patterns that separate skills that feel like magic from skills that feel
          like friction. Each one has a concrete do/don't comparison.
        </Lead>
      </FadeIn>

      {practices.map((p, i) => (
        <PracticeCard key={p.id} practice={p} index={i} />
      ))}

      <FadeIn>
        <Callout type="tip" icon="📐">
          <strong>Token budget awareness:</strong> Skills have a 5,000-token per-skill compaction budget
          and a 25,000-token total budget across all re-attached skills. Long, monolithic SKILL.md files
          will be truncated during context compaction. Keep SKILL.md under ~400 lines and use
          reference files for details.
        </Callout>
      </FadeIn>
    </SectionWrapper>
  )
}
