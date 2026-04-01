'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { it, type LangKey } from '@/lib/i18n/it'
import { en } from '@/lib/i18n/en'

export type Language = 'it' | 'en'

const dicts = { it, en }

type ContextValue = {
  lang: Language
  setLang: (l: Language) => void
  t: (key: LangKey, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<ContextValue>({
  lang: 'it',
  setLang: () => {},
  t: (key) => it[key] as string,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'it'
    const stored = localStorage.getItem('flexora-lang') as Language | null
    return stored === 'en' || stored === 'it' ? stored : 'it'
  })

  function setLang(l: Language) {
    setLangState(l)
    localStorage.setItem('flexora-lang', l)
  }

  function t(key: LangKey, vars?: Record<string, string | number>): string {
    let str = (dicts[lang][key] ?? dicts.it[key] ?? key) as string
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v))
      }
    }
    return str
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useT() {
  return useContext(LanguageContext)
}
