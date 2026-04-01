'use client'

import { useState, useEffect } from 'react'
import { useT } from '@/contexts/LanguageContext'

export default function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false)
  const { t } = useT()

  const SHORTCUTS = [
    { category: t('shortcuts.nav'), items: [
      { keys: ['⌘', 'K'], label: t('shortcuts.openSearch') },
      { keys: ['?'], label: t('shortcuts.showShortcuts') },
      { keys: ['Esc'], label: t('shortcuts.closeModal') },
    ]},
    { category: t('shortcuts.tableView'), items: [
      { keys: ['Right-click'], label: t('shortcuts.contextMenu') },
      { keys: ['Click cell'], label: t('shortcuts.editCell') },
      { keys: ['Enter'], label: t('shortcuts.saveCell') },
      { keys: ['Esc'], label: t('shortcuts.cancelCell') },
    ]},
    { category: t('shortcuts.commentsSection'), items: [
      { keys: ['⌘', '↵'], label: t('shortcuts.submitComment') },
      { keys: ['@name'], label: t('shortcuts.mentionMember') },
    ]},
    { category: t('shortcuts.itemDetailSection'), items: [
      { keys: ['⌘', 'S'], label: t('shortcuts.saveItem') },
    ]},
  ]

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !isInputFocused()) {
        e.preventDefault()
        setOpen(v => !v)
      }
      if (e.key === 'Escape' && open) setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      onClick={() => setOpen(false)}
    >
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t('shortcuts.title')}</h2>
          <button className="modal-close" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {SHORTCUTS.map(section => (
            <div key={section.category}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>
                {section.category}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {section.items.map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.label}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {item.keys.map((k, i) => (
                        <kbd key={i} style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          padding: '2px 7px', minWidth: 24,
                          background: 'var(--bg-overlay)', border: '1px solid var(--border-default)',
                          borderRadius: 5, fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
                          color: 'var(--text-primary)', boxShadow: '0 1px 0 var(--border-strong)',
                        }}>{k}</kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="modal-footer" style={{ justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-disabled)' }}>{t('shortcuts.pressToToggle', { key: '?' })}</span>
        </div>
      </div>
    </div>
  )
}

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable
}
