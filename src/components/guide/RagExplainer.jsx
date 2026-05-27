import { useState } from 'react'
import { motion } from 'framer-motion'
import { SectionLabel, SectionTitle } from './ProblemSection'

const paradigms = [
  {
    id: 'naive',
    label: 'Naive RAG',
    badge: 'Starter',
    badgeColor: 'var(--blue)',
    steps: ['Chunk documents', 'Embed chunks', 'Receive question', 'Retrieve top-k chunks', 'Inject into prompt', 'Generate answer'],
    description: 'Simple, effective, and a great place to start. Split your documents into chunks, embed them, and fetch the most similar ones when a question arrives.',
    pro: 'Quick to implement, works for many use cases',
    con: 'Quality drops on complex or ambiguous questions',
  },
  {
    id: 'advanced',
    label: 'Advanced RAG',
    badge: 'Production',
    badgeColor: 'var(--green)',
    steps: ['Rewrite query', 'Hybrid retrieval (BM25 + embeddings)', 'Rerank results', 'Compress irrelevant chunks', 'Inject context', 'Generate answer'],
    description: 'Adds pre-retrieval and post-retrieval steps. Before: rewrite the query for better matching. After: rerank results, compress noisy chunks.',
    pro: 'Noticeably better on complex questions',
    con: 'More moving parts, higher latency',
  },
  {
    id: 'modular',
    label: 'Modular RAG',
    badge: 'Enterprise',
    badgeColor: 'var(--accent2)',
    steps: ['Router (what kind of query?)', 'Query decomposition', 'Multi-source retrieval', 'Fusion & deduplication', 'Cross-encoder reranking', 'Contextual summarization', 'Context injection'],
    description: 'Flexible, composable pipeline for production systems. Routers, iterative retrievers, fusion mechanisms — compose based on your use case.',
    pro: 'Maximum quality, handles the hardest cases',
    con: 'Significant complexity and cost',
  },
]

const retrieval = [
  {
    id: 'bm25',
    label: 'BM25 (Sparse)',
    emoji: '🔤',
    color: 'var(--orange)',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.3)',
    description: 'Keyword matching. Counts exact word occurrences, weighted by how rare the word is across the corpus.',
    wins: ['"ORA-00942 error" — exact error code', '"useLayoutEffect hook" — exact API name', '"JWT, CSRF, gRPC" — exact acronyms', '"Sarah Chen" — proper names'],
    analogy: 'Like a search engine that matches words exactly. "fever in babies" won\'t find "high temperature in infants".',
  },
  {
    id: 'dense',
    label: 'Embeddings (Dense)',
    emoji: '🧠',
    color: 'var(--blue)',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.3)',
    description: 'Semantic similarity. Converts text into mathematical vectors representing meaning — finds conceptually related content.',
    wins: ['"how to treat fever in babies" → finds "high temp in infants"', '"speed up database" → finds "query optimization"', '"login page" → finds "authentication UI"', 'Handles paraphrasing and synonyms'],
    analogy: 'Like asking a human expert. They understand what you mean, even if you use different words.',
  },
  {
    id: 'hybrid',
    label: 'Hybrid Search',
    emoji: '⚡',
    color: 'var(--accent)',
    bg: 'rgba(99,102,241,0.08)',
    border: 'rgba(99,102,241,0.3)',
    description: 'Combines BM25 + dense retrieval, then reranks. Gets the best of both worlds — exact matches AND semantic understanding.',
    wins: ['49% fewer retrieval failures (with contextual retrieval)', 'Handles technical terms AND natural language', 'Standard for production systems in 2025', 'Add a reranker: 67% fewer failures'],
    analogy: 'Like having both a search engine AND a subject matter expert working together.',
  },
]

const pipelineSteps = [
  { label: 'User question', icon: '💬', color: 'var(--blue)' },
  { label: 'Query rewrite', icon: '✏️', color: 'var(--text-muted)' },
  { label: 'Retrieve docs', icon: '📚', color: 'var(--orange)' },
  { label: 'Rerank', icon: '🎯', color: 'var(--green)' },
  { label: 'Inject context', icon: '📋', color: 'var(--accent)' },
  { label: 'Generate answer', icon: '✨', color: 'var(--accent2)' },
]

export default function RagExplainer() {
  const [activeParadigm, setActiveParadigm] = useState('advanced')
  const paradigm = paradigms.find(p => p.id === activeParadigm)

  return (
    <section id="rag" style={{ padding: '80px 24px', background: 'var(--surface)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionLabel>Pillar: Select</SectionLabel>
        <SectionTitle>Retrieval-Augmented Generation (RAG)</SectionTitle>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.7, marginBottom: 12, maxWidth: 600 }}>
          Instead of memorizing an encyclopedia, the AI knows how to search the right shelf.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, marginBottom: 48, maxWidth: 600 }}>
          RAG solves three problems: hallucination (responses are grounded in real documents), stale knowledge (update the database without retraining), and transparent reasoning (show exactly which source backed each answer).
        </p>

        {/* Pipeline visual */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 }}>
            RAG Pipeline
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0 }}>
            {pipelineSteps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  style={{
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '10px 14px', textAlign: 'center',
                    minWidth: 100,
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{step.icon}</div>
                  <div style={{ fontSize: 11, color: step.color, fontWeight: 600 }}>{step.label}</div>
                </motion.div>
                {i < pipelineSteps.length - 1 && (
                  <div style={{ color: 'var(--text-muted)', margin: '0 4px', fontSize: 16 }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Paradigms */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 }}>
            The Three RAG Paradigms
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {paradigms.map(p => (
              <button
                key={p.id}
                onClick={() => setActiveParadigm(p.id)}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: `1px solid ${activeParadigm === p.id ? p.badgeColor : 'var(--border)'}`,
                  background: activeParadigm === p.id ? `${p.badgeColor}20` : 'transparent',
                  color: activeParadigm === p.id ? p.badgeColor : 'var(--text-muted)',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <motion.div
            key={activeParadigm}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 24,
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>{paradigm.label}</div>
              <div style={{
                background: `${paradigm.badgeColor}20`, border: `1px solid ${paradigm.badgeColor}50`,
                borderRadius: 6, padding: '2px 8px', fontSize: 11,
                color: paradigm.badgeColor, fontWeight: 700,
              }}>{paradigm.badge}</div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>{paradigm.description}</p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {paradigm.steps.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--surface2)', borderRadius: 6, padding: '5px 10px',
                  fontSize: 12, color: 'var(--text)',
                }}>
                  <span style={{
                    background: 'var(--accent)', color: '#fff',
                    borderRadius: '50%', width: 16, height: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</span>
                  {s}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓ </span>{paradigm.pro}
              </div>
              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--red)', fontWeight: 700 }}>— </span>{paradigm.con}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Retrieval comparison */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 }}>
            Retrieval Approaches
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {retrieval.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                style={{
                  background: r.bg, border: `1px solid ${r.border}`,
                  borderRadius: 12, padding: 20,
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 22 }}>{r.emoji}</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: r.color }}>{r.label}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>{r.description}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontStyle: 'italic' }}>💡 {r.analogy}</p>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Shines when:</div>
                {r.wins.map((w, j) => (
                  <div key={j} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 4, fontSize: 12, color: 'var(--text)' }}>
                    <span style={{ color: r.color, flexShrink: 0 }}>•</span> {w}
                  </div>
                ))}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
