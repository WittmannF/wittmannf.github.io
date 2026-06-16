import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Folder, FolderOpen, FileText, User, Briefcase, Package } from 'lucide-react'
import { SectionWrapper, SectionLabel, SectionTitle, Lead, Callout, FadeIn } from './shared'

const scopes = [
  {
    id: 'personal',
    icon: <User size={16} />,
    label: 'Personal (all projects)',
    color: 'var(--accent)',
    path: '~/.claude/',
    description: 'Only you see these skills, across every repo you work in.',
    tree: [
      { indent: 0, icon: '📁', name: '~/.claude/', bold: true },
      { indent: 1, icon: '📁', name: 'skills/' },
      { indent: 2, icon: '📁', name: 'deploy/', color: 'var(--accent)' },
      { indent: 3, icon: '📄', name: 'SKILL.md', color: 'var(--green)' },
      { indent: 2, icon: '📁', name: 'commit/' },
      { indent: 3, icon: '📄', name: 'SKILL.md', color: 'var(--green)' },
      { indent: 1, icon: '📁', name: 'commands/' },
      { indent: 2, icon: '📄', name: 'strategy.md', color: 'var(--text-muted)' },
      { indent: 1, icon: '📄', name: 'CLAUDE.md' },
      { indent: 1, icon: '📄', name: 'settings.json' },
    ],
    whenToUse: [
      'Workflow preferences you don\'t want to share (API keys, personal shortcuts)',
      'Generic skills that apply to every project you work on',
      'Things you\'re still experimenting with',
    ],
  },
  {
    id: 'project',
    icon: <Briefcase size={16} />,
    label: 'Project (your team)',
    color: 'var(--green)',
    path: '.claude/',
    description: 'Skills committed with the repo. Everyone on your team gets them.',
    tree: [
      { indent: 0, icon: '📁', name: 'my-project/', bold: true },
      { indent: 1, icon: '📄', name: 'CLAUDE.md' },
      { indent: 1, icon: '📁', name: '.claude/' },
      { indent: 2, icon: '📁', name: 'skills/', color: 'var(--green)' },
      { indent: 3, icon: '📁', name: 'deploy/' },
      { indent: 4, icon: '📄', name: 'SKILL.md', color: 'var(--green)' },
      { indent: 4, icon: '📄', name: 'checklist.md' },
      { indent: 3, icon: '📁', name: 'review-pr/' },
      { indent: 4, icon: '📄', name: 'SKILL.md', color: 'var(--green)' },
      { indent: 2, icon: '📁', name: 'agents/' },
      { indent: 3, icon: '📄', name: 'security-reviewer.md' },
      { indent: 2, icon: '📄', name: 'settings.json' },
    ],
    whenToUse: [
      'Deploy workflows specific to this project\'s infra',
      'Code review checklists with project conventions',
      'Anything that belongs in the team\'s institutional knowledge',
    ],
  },
  {
    id: 'plugin',
    icon: <Package size={16} />,
    label: 'Plugin (installable)',
    color: 'var(--orange)',
    path: 'plugin/',
    description: 'Published packages. Namespaced as /plugin-name:skill-name.',
    tree: [
      { indent: 0, icon: '📁', name: 'my-plugin/', bold: true },
      { indent: 1, icon: '📁', name: 'plugin/' },
      { indent: 2, icon: '📁', name: 'skills/', color: 'var(--orange)' },
      { indent: 3, icon: '📁', name: 'audit/' },
      { indent: 4, icon: '📄', name: 'SKILL.md', color: 'var(--green)' },
      { indent: 3, icon: '📁', name: 'report/' },
      { indent: 4, icon: '📄', name: 'SKILL.md', color: 'var(--green)' },
      { indent: 1, icon: '📄', name: '.claude-plugin/plugin.json' },
      { indent: 1, icon: '📄', name: 'README.md' },
    ],
    whenToUse: [
      'You\'re building a tool for the Claude Code ecosystem',
      'Skills that benefit a community (DevOps, security, docs)',
      'Distributing your automation publicly or inside a company',
    ],
  },
]

function FileTree({ items }) {
  return (
    <div style={{
      background: '#0d1117', borderRadius: 10, padding: '16px 20px',
      fontFamily: 'monospace', fontSize: 13,
    }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          paddingLeft: item.indent * 18,
          marginBottom: 4,
          fontWeight: item.bold ? 700 : 400,
          color: item.color || 'var(--text)',
        }}>
          <span style={{ fontSize: 14 }}>{item.icon}</span>
          <span>{item.name}</span>
        </div>
      ))}
    </div>
  )
}

export default function FolderStructureSection() {
  const [active, setActive] = useState('project')
  const scope = scopes.find(s => s.id === active)

  return (
    <SectionWrapper id="folder-structure">
      <FadeIn>
        <SectionLabel>Structure</SectionLabel>
        <SectionTitle>Where Skills Live</SectionTitle>
        <Lead>
          Skills can live in three places depending on who should use them. Pick the
          right scope first — it determines the path and how the skill is shared.
        </Lead>
      </FadeIn>

      {/* Scope selector */}
      <FadeIn delay={0.1}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
          {scopes.map(s => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${active === s.id ? s.color : 'var(--border)'}`,
                background: active === s.id ? `${s.color}18` : 'var(--bg)',
                color: active === s.id ? s.color : 'var(--text-muted)',
                fontWeight: 600, fontSize: 14, transition: 'all 0.15s',
              }}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </FadeIn>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                {scope.description}
              </div>
              <FileTree items={scope.tree} />
            </div>
            <div>
              <div style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '20px',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: scope.color,
                  letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 14,
                }}>
                  When to use this scope
                </div>
                {scope.whenToUse.map((w, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                    <span style={{ color: scope.color, fontSize: 16, flexShrink: 0 }}>→</span>
                    <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>{w}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <FadeIn delay={0.2}>
        <Callout type="tip" icon="💡">
          <strong>Naming rule:</strong> The skill's invocation name comes from the{' '}
          <code style={{ fontFamily: 'monospace', background: 'rgba(99,102,241,0.15)', padding: '1px 5px', borderRadius: 4 }}>
            directory name
          </code>{' '}
          (not the frontmatter <code style={{ fontFamily: 'monospace', background: 'rgba(99,102,241,0.15)', padding: '1px 5px', borderRadius: 4 }}>name:</code> field).
          A skill at <code style={{ fontFamily: 'monospace', background: 'rgba(99,102,241,0.15)', padding: '1px 5px', borderRadius: 4 }}>
            .claude/skills/deploy-prod/SKILL.md
          </code>{' '}
          becomes <code style={{ fontFamily: 'monospace', background: 'rgba(99,102,241,0.15)', padding: '1px 5px', borderRadius: 4 }}>/deploy-prod</code>.
        </Callout>

        <Callout type="info" icon="📁">
          <strong>Legacy commands/ still works.</strong> A file at{' '}
          <code style={{ fontFamily: 'monospace', background: 'rgba(99,102,241,0.15)', padding: '1px 5px', borderRadius: 4 }}>
            .claude/commands/foo.md
          </code>{' '}
          and a skill at{' '}
          <code style={{ fontFamily: 'monospace', background: 'rgba(99,102,241,0.15)', padding: '1px 5px', borderRadius: 4 }}>
            .claude/skills/foo/SKILL.md
          </code>{' '}
          both create <code style={{ fontFamily: 'monospace', background: 'rgba(99,102,241,0.15)', padding: '1px 5px', borderRadius: 4 }}>/foo</code>.
          Skills take priority when names conflict, and they unlock richer features.
        </Callout>
      </FadeIn>
    </SectionWrapper>
  )
}
