'use client'

import { useT } from '@/contexts/LanguageContext'
import type { LangKey } from '@/lib/i18n/it'

type Props = {
  titleKey: LangKey
  subtitleKey?: LangKey
}

export default function PageHeader({ titleKey, subtitleKey }: Props) {
  const { t } = useT()
  return (
    <div>
      <h1 className="page-title">{t(titleKey)}</h1>
      {subtitleKey && <p className="page-subtitle">{t(subtitleKey)}</p>}
    </div>
  )
}
