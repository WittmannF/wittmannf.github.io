import { useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import '../../styles/guide.css'
import SkillsHeroSection from './SkillsHeroSection'
import WhySkillsSection from './WhySkillsSection'
import FolderStructureSection from './FolderStructureSection'
import FirstSkillSection from './FirstSkillSection'
import FrontmatterSection from './FrontmatterSection'
import ArgumentsSection from './ArgumentsSection'
import DynamicContextSection from './DynamicContextSection'
import SkillTypesSection from './SkillTypesSection'
import RealWorldSection from './RealWorldSection'
import AgentsSection from './AgentsSection'
import BestPracticesSection from './BestPracticesSection'
import SkillsChecklist from './SkillsChecklist'
import SkillsClosingSection from './SkillsClosingSection'

export default function SkillsGuideApp() {
  const [dark, setDark] = useState(true)

  return (
    <div className={`guide-root${dark ? '' : ' light'}`}>
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

      <SkillsHeroSection />
      <WhySkillsSection />
      <FolderStructureSection />
      <FirstSkillSection />
      <FrontmatterSection />
      <ArgumentsSection />
      <DynamicContextSection />
      <SkillTypesSection />
      <RealWorldSection />
      <AgentsSection />
      <BestPracticesSection />
      <SkillsChecklist />
      <SkillsClosingSection />
    </div>
  )
}
