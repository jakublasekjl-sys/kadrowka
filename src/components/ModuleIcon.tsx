import type { LucideIcon } from 'lucide-react'
import {
  Badge,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Compass,
  Folder,
  GitBranch,
  GraduationCap,
  Medal,
  Newspaper,
  Rocket,
  Users,
} from 'lucide-react'
import type { ContentModule } from '../types/content'

const iconsByModuleId: Record<string, LucideIcon> = {
  'model-przywodztwa': Compass,
  'proces-pracy-z-kadra': GitBranch,
  'praca-z-kadra-w-zespole': Users,
  ewaluacja: ClipboardCheck,
  'funkcje-w-zhp': Badge,
  'system-ksztalcenia-w-zhp': GraduationCap,
  'system-stopni-instruktorskich-w-zhp': Medal,
  'artykuly-z-czuwaj': Newspaper,
}

const iconsByContentName: Record<string, LucideIcon> = {
  school: GraduationCap,
  timeline: GitBranch,
  groups: Users,
  analytics: BarChart3,
  rocket_launch: Rocket,
  badge: Badge,
  menu_book: BookOpen,
  workspace_premium: Medal,
  article: Newspaper,
}

export function ModuleIcon({ module }: { module: ContentModule }) {
  const Icon = iconsByModuleId[module.id] ?? iconsByContentName[module.icon ?? ''] ?? Folder
  const tones: Record<string, string> = {
    '#755390': 'purple',
    '#243364': 'navy',
    '#2F6F73': 'teal',
    '#F0B33B': 'gold',
    '#4D4D4D': 'gray',
  }
  const tone = tones[String(module.color ?? '').toLocaleUpperCase('en')] ?? 'purple'

  return (
    <span className={`module-icon module-icon-${tone}`} aria-hidden="true">
      <Icon />
    </span>
  )
}
