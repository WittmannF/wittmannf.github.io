import { useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import '../../styles/guide.css'
import HeroSection from './HeroSection'
import ProblemSection from './ProblemSection'
import PromptVsContextSection from './PromptVsContextSection'
import ContextWindowVisualizer from './ContextWindowVisualizer'
import FourPillarsSection from './FourPillarsSection'
import RagExplainer from './RagExplainer'
import ContextualRetrieval from './ContextualRetrieval'
import ChunkingSection from './ChunkingSection'
import MemorySection from './MemorySection'
import SystemPromptSection from './SystemPromptSection'
import LongContextSection from './LongContextSection'
import FewShotSection from './FewShotSection'
import CompressionSection from './CompressionSection'
import AgentLoopSection from './AgentLoopSection'
import MultiAgentSection from './MultiAgentSection'
import TokenBudgetSection from './TokenBudgetSection'
import SecuritySection from './SecuritySection'
import PatternsSection from './PatternsSection'
import EvaluationSection from './EvaluationSection'
import ProductionChecklist from './ProductionChecklist'
import ClosingSection from './ClosingSection'

export default function GuideApp() {
  const [dark, setDark] = useState(true)

  return (
    <div className={`guide-root${dark ? '' : ' light'}`}>
      {/* Floating theme toggle — sits in top-right since the blog header is above */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 100,
      }}>
        <button
          onClick={() => setDark(!dark)}
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '8px 10px', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            gap: 6, fontSize: 12, fontWeight: 600,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
          {dark ? 'Light' : 'Dark'}
        </button>
      </div>

      <HeroSection />
      <ProblemSection />
      <PromptVsContextSection />
      <ContextWindowVisualizer />
      <FourPillarsSection />
      <RagExplainer />
      <ContextualRetrieval />
      <ChunkingSection />
      <MemorySection />
      <SystemPromptSection />
      <LongContextSection />
      <FewShotSection />
      <CompressionSection />
      <AgentLoopSection />
      <MultiAgentSection />
      <TokenBudgetSection />
      <SecuritySection />
      <PatternsSection />
      <EvaluationSection />
      <ProductionChecklist />
      <ClosingSection />
    </div>
  )
}
