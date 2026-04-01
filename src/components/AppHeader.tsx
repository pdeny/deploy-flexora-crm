'use client'

import React, { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateAppFields, createItem, updateApp, deleteApp } from '@/lib/actions/workspace'
import { useT } from '@/contexts/LanguageContext'
import type { LangKey } from '@/lib/i18n/it'
import type { AppField, FieldType, CategoryOption, RollupFunction } from '@/lib/types'
import type { FilterRule } from '@/lib/filters'
import ViewToggle from '@/components/ViewToggle'
import FilterBar from '@/components/FilterBar'
import SortDropdown from '@/components/SortDropdown'
import ShareLinkModal from '@/components/ShareLinkModal'
import FormBuilderModal from '@/components/FormBuilderModal'
import ColorRulesModal from '@/components/ColorRulesModal'
import type { ColorRule } from '@/lib/types'

const FIELD_TYPE_DEFS: { value: FieldType; labelKey: LangKey; icon: string }[] = [
  { value: 'text',        labelKey: 'header.fieldType.text',        icon: 'T' },
  { value: 'number',      labelKey: 'header.fieldType.number',      icon: '#' },
  { value: 'date',        labelKey: 'header.fieldType.date',        icon: '📅' },
  { value: 'category',    labelKey: 'header.fieldType.category',    icon: '🏷' },
  { value: 'multiselect', labelKey: 'header.fieldType.multiselect', icon: '🔖' },
  { value: 'rating',      labelKey: 'header.fieldType.rating',      icon: '⭐' },
  { value: 'progress',    labelKey: 'header.fieldType.progress',    icon: '▓' },
  { value: 'email',       labelKey: 'header.fieldType.email',       icon: '✉' },
  { value: 'url',         labelKey: 'header.fieldType.url',         icon: '🔗' },
  { value: 'phone',       labelKey: 'header.fieldType.phone',       icon: '📞' },
  { value: 'toggle',      labelKey: 'header.fieldType.toggle',      icon: '☑' },
  { value: 'calculation', labelKey: 'header.fieldType.calculation', icon: 'ƒ' },
  { value: 'relation',    labelKey: 'header.fieldType.relation',    icon: '🔗' },
  { value: 'lookup',      labelKey: 'header.fieldType.lookup',      icon: '⤴' },
  { value: 'rollup',      labelKey: 'header.fieldType.rollup',      icon: 'Σ' },
]

const OPTION_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f59e0b','#10b981','#06b6d4','#3b82f6']
const APP_EMOJIS = ['📋','📊','🗂','🔖','💼','🚀','🎯','🔥','⭐','📁','🧩','🛠','📈','🤝','🌱']
const APP_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f59e0b','#10b981','#06b6d4','#3b82f6']

type AppSnap = {
  id: string
  name: string
  description?: string | null
  iconEmoji: string
  color: string
  shareToken?: string | null
  formToken?: string | null
  formFieldsJson?: string
  colorRulesJson?: string
}

type ItemForExport = {
  id: string
  title: string
  dataJson: string
  createdAt: Date
  updatedAt: Date
  creator: { name: string | null; email: string }
}

type Props = {
  app: AppSnap
  workspaceId: string
  fields: AppField[]
  userId: string
  currentView: 'table' | 'kanban' | 'gallery' | 'calendar' | 'timeline'
  filterRules: FilterRule[]
  sortField: string
  sortDir: 'asc' | 'desc'
  items?: ItemForExport[]
  workspaceApps?: { id: string; name: string; iconEmoji: string; fieldsJson?: string }[]
}

function exportToCSV(items: ItemForExport[], fields: AppField[], appName: string) {
  const headers = ['Title', ...fields.map(f => f.name), 'Creator', 'Created', 'Updated']
  const rows = items.map(item => {
    let data: Record<string, unknown> = {}
    try { data = JSON.parse(item.dataJson) } catch { /* ignore */ }
    const fieldValues = fields.map(f => {
      const v = data[f.id]
      if (v === null || v === undefined || v === '') return ''
      if (f.type === 'category') {
        const opt = f.options?.find(o => o.id === v)
        return opt ? opt.label : String(v)
      }
      if (f.type === 'toggle') return v ? 'Yes' : 'No'
      return String(v)
    })
    return [
      item.title,
      ...fieldValues,
      item.creator.name ?? item.creator.email,
      new Date(item.createdAt).toISOString(),
      new Date(item.updatedAt).toISOString(),
    ]
  })

  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${appName.toLowerCase().replace(/\s+/g, '-')}-export.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AppHeader({
  app,
  workspaceId,
  fields: initialFields,
  currentView,
  filterRules,
  sortField,
  sortDir,
  items = [],
  workspaceApps = [],
}: Props) {
  const { t } = useT()
  const router = useRouter()

  // Field management state
  const [showFields, setShowFields]   = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [fields, setFields]           = useState<AppField[]>(initialFields)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType>('text')
  const [newOptions, setNewOptions]   = useState<CategoryOption[]>([])
  const [newOptionLabel, setNewOptionLabel] = useState('')
  const [itemData, setItemData]       = useState<Record<string, unknown>>({})
  const [itemError, setItemError]     = useState<string | null>(null)
  const [isPendingFields, startFields] = useTransition()
  const [isPendingItem, startItem]     = useTransition()

  const [showShare, setShowShare] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showColorRules, setShowColorRules] = useState(false)

  // App edit/delete state
  const [showEditApp, setShowEditApp] = useState(false)
  const [editName, setEditName]       = useState(app.name)
  const [editDesc, setEditDesc]       = useState(app.description ?? '')
  const [editEmoji, setEditEmoji]     = useState(app.iconEmoji)
  const [editColor, setEditColor]     = useState(app.color)
  const [editError, setEditError]     = useState('')
  const [isPendingEdit, startEdit]    = useTransition()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [isPendingDelete, startDelete] = useTransition()

  // CSV Import state
  const [showImportCSV, setShowImportCSV] = useState(false)
  const [, setCsvText] = useState('')
  const [csvPreview, setCsvPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({}) // csvHeader → fieldId or 'title'
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvImportResult, setCsvImportResult] = useState<{ ok: number; err: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Saved views (localStorage)
  type SavedView = { id: string; name: string; url: string }
  const [showViews, setShowViews] = useState(false)
  const [viewName, setViewName] = useState('')
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(`views-${app.id}`) ?? '[]') } catch { return [] }
  })
  const viewsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showViews) return
    function h(e: MouseEvent) { if (viewsRef.current && !viewsRef.current.contains(e.target as Node)) setShowViews(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showViews])

  function saveCurrentView() {
    if (!viewName.trim()) return
    const url = typeof window !== 'undefined' ? window.location.search : ''
    const view: SavedView = { id: `v-${Date.now()}`, name: viewName.trim(), url }
    const next = [...savedViews, view]
    setSavedViews(next)
    localStorage.setItem(`views-${app.id}`, JSON.stringify(next))
    setViewName('')
  }

  function deleteSavedView(id: string) {
    const next = savedViews.filter(v => v.id !== id)
    setSavedViews(next)
    localStorage.setItem(`views-${app.id}`, JSON.stringify(next))
  }

  // Field inline-edit state (for required / description)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)

  function updateField(id: string, patch: Partial<AppField>) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))
  }

  // Field reorder drag state
  const [dragFieldId, setDragFieldId] = useState<string | null>(null)

  function handleFieldDragStart(id: string) { setDragFieldId(id) }
  function handleFieldDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    if (!dragFieldId || dragFieldId === targetId) return
    setFields(prev => {
      const from = prev.findIndex(f => f.id === dragFieldId)
      const to = prev.findIndex(f => f.id === targetId)
      if (from === -1 || to === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }
  function handleFieldDragEnd() { setDragFieldId(null) }

  // More menu dropdown
  const [showMore, setShowMore] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showMore) return
    function h(e: MouseEvent) { if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showMore])

  // ---- Field management ----
  function addOption() {
    if (!newOptionLabel.trim()) return
    const color = OPTION_COLORS[newOptions.length % OPTION_COLORS.length]
    setNewOptions(prev => [...prev, { id: `opt-${Date.now()}`, label: newOptionLabel.trim(), color }])
    setNewOptionLabel('')
  }

  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [newFieldDesc, setNewFieldDesc] = useState('')
  const [newFieldFormula, setNewFieldFormula] = useState('')
  const [newFieldRelatedApp, setNewFieldRelatedApp] = useState('')
  const [newFieldLinkedFieldId, setNewFieldLinkedFieldId] = useState('')
  const [newFieldLookupFieldId, setNewFieldLookupFieldId] = useState('')
  const [newFieldRollupFn, setNewFieldRollupFn] = useState<RollupFunction>('COUNT')
  const [newFieldRollupFieldId, setNewFieldRollupFieldId] = useState('')

  function addField() {
    if (!newFieldName.trim()) return
    const f: AppField = {
      id: `f-${Date.now()}`,
      name: newFieldName.trim(),
      type: newFieldType,
      ...(newFieldRequired ? { required: true } : {}),
      ...(newFieldDesc.trim() ? { description: newFieldDesc.trim() } : {}),
      ...((newFieldType === 'category' || newFieldType === 'multiselect') ? { options: newOptions } : {}),
      ...(newFieldType === 'calculation' && newFieldFormula.trim() ? { calcFormula: newFieldFormula.trim() } : {}),
      ...(newFieldType === 'relation' && newFieldRelatedApp ? { relatedAppId: newFieldRelatedApp } : {}),
      ...(newFieldType === 'lookup' ? {
        ...(newFieldLinkedFieldId ? { linkedFieldId: newFieldLinkedFieldId } : {}),
        ...(newFieldLookupFieldId ? { lookupFieldId: newFieldLookupFieldId } : {}),
      } : {}),
      ...(newFieldType === 'rollup' ? {
        ...(newFieldLinkedFieldId ? { linkedFieldId: newFieldLinkedFieldId } : {}),
        rollupFunction: newFieldRollupFn,
        ...(newFieldRollupFieldId ? { rollupFieldId: newFieldRollupFieldId } : {}),
      } : {}),
    }
    setFields(prev => [...prev, f])
    setNewFieldName('')
    setNewFieldType('text')
    setNewOptions([])
    setNewFieldRequired(false)
    setNewFieldDesc('')
    setNewFieldFormula('')
    setNewFieldRelatedApp('')
    setNewFieldLinkedFieldId('')
    setNewFieldLookupFieldId('')
    setNewFieldRollupFn('COUNT')
    setNewFieldRollupFieldId('')
  }

  function removeField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id))
  }

  function saveFields() {
    startFields(async () => {
      const result = await updateAppFields(app.id, JSON.stringify(fields))
      if (!result?.error) setShowFields(false)
    })
  }

  function cancelFields() {
    setFields(initialFields)
    setShowFields(false)
  }

  // ---- Add item ----
  function handleAddItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setItemError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('appId', app.id)
    fd.set('dataJson', JSON.stringify(itemData))
    startItem(async () => {
      const result = await createItem(fd)
      if (result?.error) setItemError(result.error)
      else { setShowAddItem(false); setItemData({}) }
    })
  }

  // ---- Edit app ----
  function saveEditApp() {
    setEditError('')
    startEdit(async () => {
      const result = await updateApp(app.id, {
        name: editName,
        description: editDesc,
        iconEmoji: editEmoji,
        color: editColor,
      })
      if (result?.error) setEditError(result.error)
      else setShowEditApp(false)
    })
  }

  // ---- Delete app ----
  function handleDeleteApp() {
    if (deleteConfirmName !== app.name) return
    startDelete(async () => {
      const result = await deleteApp(app.id)
      if (result?.error) return
      router.push(`/dashboard/${workspaceId}`)
    })
  }

  // ---- CSV helpers ----
  function parseCSV(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.trim().split(/\r?\n/)
    function parseLine(line: string): string[] {
      const cells: string[] = []; let cur = ''; let inQ = false
      for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === '"') {
          if (inQ && line[i+1] === '"') { cur += '"'; i++ }
          else inQ = !inQ
        } else if (c === ',' && !inQ) { cells.push(cur); cur = '' }
        else cur += c
      }
      cells.push(cur)
      return cells
    }
    const headers = parseLine(lines[0] ?? '')
    const rows = lines.slice(1).filter(l => l.trim()).map(parseLine)
    return { headers, rows }
  }

  function handleCSVFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      setCsvText(text)
      const parsed = parseCSV(text)
      setCsvPreview(parsed)
      // Auto-map: title column → 'title', others try to match by name
      const mapping: Record<string, string> = {}
      parsed.headers.forEach(h => {
        const lower = h.toLowerCase().trim()
        if (lower === 'title' || lower === 'name') { mapping[h] = 'title'; return }
        const match = fields.find(f => f.name.toLowerCase() === lower)
        if (match) mapping[h] = match.id
      })
      // If no title mapped, map first column
      if (!Object.values(mapping).includes('title') && parsed.headers.length > 0) {
        mapping[parsed.headers[0]] = 'title'
      }
      setCsvMapping(mapping)
      setCsvImportResult(null)
    }
    reader.readAsText(file)
  }

  async function handleCSVImport() {
    if (!csvPreview) return
    setCsvImporting(true)
    let ok = 0, err = 0
    for (const row of csvPreview.rows) {
      let title = ''
      const data: Record<string, unknown> = {}
      csvPreview.headers.forEach((h, i) => {
        const mapped = csvMapping[h]
        if (!mapped) return
        const val = (row[i] ?? '').trim()
        if (mapped === 'title') title = val
        else if (val) data[mapped] = val
      })
      if (!title) { err++; continue }
      const fd = new FormData()
      fd.set('appId', app.id)
      fd.set('title', title)
      fd.set('dataJson', JSON.stringify(data))
      const result = await createItem(fd)
      if (result?.error) err++; else ok++
    }
    setCsvImporting(false)
    setCsvImportResult({ ok, err })
  }

  return (
    <>
      <div className="app-header-bar">
        {/* Left: app icon + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 22, width: 38, height: 38, background: `${app.color}18`,
            border: `1px solid ${app.color}33`, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{app.iconEmoji}</span>
          <h1 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.3px' }}>{app.name}</h1>
        </div>

        {/* Right: view toggle + sort + filter + fields + add + more */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ViewToggle currentView={currentView} />

          {/* Saved Views */}
          <div ref={viewsRef} style={{ position: 'relative' }}>
            <button
              className={`btn btn-sm ${savedViews.length > 0 ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setShowViews(o => !o)}
              title="Saved views"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              {t('header.savedViews')}{savedViews.length > 0 && ` (${savedViews.length})`}
            </button>
            {showViews && (
              <div className="app-more-menu" style={{ minWidth: 220, left: 0, right: 'auto' }}>
                {savedViews.length > 0 && (
                  <>
                    {savedViews.map(v => (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          className="app-more-item"
                          style={{ flex: 1 }}
                          onClick={() => { setShowViews(false); router.push(`${window.location.pathname}${v.url}`) }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                          </svg>
                          {v.name}
                        </button>
                        <button
                          style={{ background: 'none', border: 'none', color: 'var(--text-disabled)', cursor: 'pointer', padding: '4px 6px', borderRadius: 4 }}
                          onClick={() => deleteSavedView(v.id)}
                          title="Delete view"
                        >×</button>
                      </div>
                    ))}
                    <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                  </>
                )}
                <div style={{ padding: '6px 8px 4px', display: 'flex', gap: 6 }}>
                  <input
                    className="form-input"
                    placeholder={t('header.viewName')}
                    value={viewName}
                    onChange={e => setViewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveCurrentView()}
                    style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={saveCurrentView}
                    disabled={!viewName.trim()}
                    style={{ fontSize: 11, whiteSpace: 'nowrap' }}
                  >{t('header.saveViewBtn')}</button>
                </div>
                <p style={{ fontSize: 10, color: 'var(--text-disabled)', padding: '0 10px 6px', lineHeight: 1.4 }}>
                  Saves current view, filters, and sort settings
                </p>
              </div>
            )}
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--border-default)', flexShrink: 0 }} />
          <SortDropdown fields={fields} sortField={sortField} sortDir={sortDir} />
          <button
            className={`btn btn-sm ${filterRules.length > 0 ? 'btn-primary' : 'btn-secondary'}`}
            style={{ position: 'relative' }}
            title={filterRules.length > 0 ? `${filterRules.length} active filter${filterRules.length > 1 ? 's' : ''}` : 'Filter'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            {filterRules.length > 0 ? t('header.filters', { n: filterRules.length }) : t('header.filter')}
            {filterRules.length > 0 && (
              <span style={{
                position: 'absolute', top: -6, right: -6,
                width: 16, height: 16, borderRadius: '50%',
                background: '#fff', color: 'var(--brand-600)',
                fontSize: 9, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{filterRules.length}</span>
            )}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowFields(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 0 4.93 19.07M12 2v2M12 20v2M2 12h2M20 12h2"/>
            </svg>
            {t('header.fields')}
          </button>
          <button
            className="btn btn-secondary btn-sm btn-icon"
            title="Share app (public link)"
            onClick={() => setShowShare(true)}
            style={{ position: 'relative' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            {app.shareToken && (
              <span style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
            )}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddItem(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t('header.addItem')}
          </button>

          {/* More menu */}
          <div ref={moreRef} style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost btn-sm btn-icon"
              onClick={() => setShowMore(o => !o)}
              title="More options"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/>
              </svg>
            </button>
            {showMore && (
              <div className="app-more-menu">
                <button className="app-more-item" onClick={() => { setShowMore(false); setEditName(app.name); setEditDesc(app.description ?? ''); setEditEmoji(app.iconEmoji); setEditColor(app.color); setShowEditApp(true) }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  {t('header.editApp')}
                </button>
                <button className="app-more-item" onClick={() => { setShowMore(false); exportToCSV(items, fields, app.name) }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {t('header.exportCSV')}
                </button>
                <button className="app-more-item" onClick={() => { setShowMore(false); setCsvText(''); setCsvPreview(null); setCsvMapping({}); setCsvImportResult(null); setShowImportCSV(true) }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  {t('header.importCSV')}
                </button>
                <button className="app-more-item" onClick={() => { setShowMore(false); router.push(`/dashboard/${workspaceId}/${app.id}/automations`) }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  {t('header.automations')}
                </button>
                <button className="app-more-item" onClick={() => { setShowMore(false); setShowForm(true) }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="5" width="18" height="14" rx="2"/>
                    <path d="M7 9h10M7 13h5"/>
                  </svg>
                  {t('header.formBuilder')}
                  {app.formToken && (
                    <span style={{
                      marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                      padding: '2px 6px', borderRadius: 9999,
                      background: 'rgba(16,185,129,0.12)', color: 'var(--success)',
                      border: '1px solid rgba(16,185,129,0.2)',
                    }}>{t('header.live')}</span>
                  )}
                </button>
                <button className="app-more-item" onClick={() => { setShowMore(false); setShowColorRules(true) }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 2a10 10 0 0 1 0 20A10 10 0 0 0 12 2"/>
                  </svg>
                  {t('header.colorRules')}
                  {(() => {
                    let ruleCount = 0
                    try { ruleCount = JSON.parse(app.colorRulesJson ?? '[]').length } catch { /* */ }
                    return ruleCount > 0 ? (
                      <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 9999, background: 'var(--brand-500)', color: '#fff' }}>
                        {ruleCount}
                      </span>
                    ) : null
                  })()}
                </button>
                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '3px 0' }} />
                <button className="app-more-item danger" onClick={() => { setShowMore(false); setDeleteConfirmName(''); setShowDeleteConfirm(true) }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                  {t('header.deleteApp')}…
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar fields={fields} rules={filterRules} />

      {/* ── Share Modal ── */}
      {showShare && (
        <ShareLinkModal
          appId={app.id}
          initialToken={app.shareToken ?? null}
          currentView={currentView}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* ── Form Builder Modal ── */}
      {showForm && (() => {
        let config = { title: `Submit to ${app.name}`, description: '', fieldIds: fields.map(f => f.id), submitLabel: 'Submit' }
        try {
          const p = JSON.parse(app.formFieldsJson ?? '{}')
          if (p && 'fieldIds' in p) config = { ...config, ...p }
        } catch { /* ignore */ }
        return (
          <FormBuilderModal
            appId={app.id}
            fields={fields}
            initialToken={app.formToken ?? null}
            initialConfig={config}
            onClose={() => setShowForm(false)}
          />
        )
      })()}

      {/* ── Color Rules Modal ── */}
      {showColorRules && (() => {
        let rules: ColorRule[] = []
        try { rules = JSON.parse(app.colorRulesJson ?? '[]') } catch { /* */ }
        return (
          <ColorRulesModal
            appId={app.id}
            fields={fields}
            initialRules={rules}
            onClose={() => setShowColorRules(false)}
          />
        )
      })()}

      {/* ── Edit App Modal ── */}
      {showEditApp && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowEditApp(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Edit App</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowEditApp(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="form-group">
                <label className="form-label">{t('common.icon')}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {APP_EMOJIS.map(e => (
                    <button key={e} type="button" onClick={() => setEditEmoji(e)} style={{
                      width: 36, height: 36, fontSize: 18, borderRadius: 8, border: 'none',
                      background: editEmoji === e ? 'rgba(99,102,241,0.2)' : 'var(--bg-overlay)',
                      cursor: 'pointer', outline: editEmoji === e ? '2px solid var(--brand-500)' : 'none',
                      transition: 'all var(--transition-fast)',
                    }}>{e}</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.name')} <span style={{ color: 'var(--error)' }}>*</span></label>
                <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)} placeholder={t('header.appNamePlaceholder')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.description')}</label>
                <textarea className="form-input form-textarea" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder={t('app.descPlaceholder')} rows={2} style={{ minHeight: 60 }} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.color')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {APP_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setEditColor(c)} style={{
                      width: 26, height: 26, borderRadius: '50%', border: 'none',
                      background: c, cursor: 'pointer',
                      outline: editColor === c ? `3px solid ${c}` : 'none',
                      outlineOffset: 2, transition: 'all var(--transition-fast)',
                    }} />
                  ))}
                </div>
              </div>
              {editError && <p className="form-error">{editError}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditApp(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={saveEditApp} disabled={isPendingEdit || !editName.trim()}>
                {isPendingEdit ? <><span className="spinner" style={{ width: 13, height: 13 }} /> {t('common.saving')}</> : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete App Confirmation ── */}
      {showDeleteConfirm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowDeleteConfirm(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--error)' }}>{t('header.deleteApp')}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowDeleteConfirm(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {t('header.deleteAppBodyPre')} <strong style={{ color: 'var(--text-primary)' }}>{app.name}</strong> {t('header.deleteAppBodyPost')}
              </p>
              <div className="form-group">
                <label className="form-label">{t('header.typeToConfirm1')} <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{app.name}</strong> {t('header.typeToConfirm2')}</label>
                <input
                  className="form-input"
                  value={deleteConfirmName}
                  onChange={e => setDeleteConfirmName(e.target.value)}
                  placeholder={app.name}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>{t('common.cancel')}</button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteApp}
                disabled={isPendingDelete || deleteConfirmName !== app.name}
              >
                {isPendingDelete ? <><span className="spinner" style={{ width: 13, height: 13 }} /> {t('common.delete')}…</> : t('header.deleteApp')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manage Fields Modal ── */}
      {showFields && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && cancelFields()}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">{t('header.manageFields')}</h2>
              <button className="btn btn-ghost btn-icon" onClick={cancelFields}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <div className="fields-section-label">{t('header.currentFields')}</div>
                {fields.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '12px 0' }}>{t('header.noFields')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {fields.map(f => {
                      const isExpanded = editingFieldId === f.id
                      return (
                        <div key={f.id}>
                          <div
                            className={`field-row-item${dragFieldId === f.id ? ' field-dragging' : ''}`}
                            draggable
                            onDragStart={() => handleFieldDragStart(f.id)}
                            onDragOver={e => handleFieldDragOver(e, f.id)}
                            onDragEnd={handleFieldDragEnd}
                          >
                            {/* Drag handle */}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-disabled)', cursor: 'grab', flexShrink: 0 }}>
                              <circle cx="9" cy="5" r="1.5" fill="currentColor"/>
                              <circle cx="15" cy="5" r="1.5" fill="currentColor"/>
                              <circle cx="9" cy="12" r="1.5" fill="currentColor"/>
                              <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
                              <circle cx="9" cy="19" r="1.5" fill="currentColor"/>
                              <circle cx="15" cy="19" r="1.5" fill="currentColor"/>
                            </svg>
                            <span className="field-type-chip">{f.type}</span>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                              {f.name}
                              {f.required && <span style={{ color: 'var(--error)', marginLeft: 3 }}>*</span>}
                            </span>
                            {f.options && f.options.length > 0 && (
                              <div style={{ display: 'flex', gap: 4 }}>
                                {f.options.slice(0, 3).map(o => (
                                  <span key={o.id} style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: o.color + '22', color: o.color }}>{o.label}</span>
                                ))}
                              </div>
                            )}
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => setEditingFieldId(isExpanded ? null : f.id)}
                              title={t('header.fieldSettings')}
                              style={{ color: isExpanded ? 'var(--brand-400)' : 'var(--text-tertiary)' }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                              </svg>
                            </button>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeField(f.id)} style={{ color: 'var(--error)', opacity: 0.7 }} title={t('header.removeField')}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </div>
                          {isExpanded && (
                            <div style={{
                              margin: '0 0 4px 24px',
                              padding: '12px 14px',
                              background: 'var(--bg-base)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '0 0 8px 8px',
                              borderTop: 'none',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                            }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                                <input
                                  type="checkbox"
                                  checked={f.required ?? false}
                                  onChange={e => updateField(f.id, { required: e.target.checked })}
                                  style={{ width: 14, height: 14, accentColor: 'var(--brand-500)', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{t('header.required')}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>{t('header.requiredHint')}</span>
                              </label>
                              {f.type === 'relation' && (
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>
                                    {t('header.linkedApp')}
                                  </div>
                                  <select
                                    className="form-input form-select"
                                    value={f.relatedAppId ?? ''}
                                    onChange={e => updateField(f.id, { relatedAppId: e.target.value || undefined })}
                                    style={{ fontSize: 12 }}
                                  >
                                    <option value="">{t('header.chooseApp')}</option>
                                    {workspaceApps.filter(a => a.id !== app.id).map(a => (
                                      <option key={a.id} value={a.id}>{a.iconEmoji} {a.name}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              {f.type === 'calculation' && (
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>
                                    {t('header.formula')}
                                  </div>
                                  <input
                                    className="form-input"
                                    value={f.calcFormula ?? ''}
                                    onChange={e => updateField(f.id, { calcFormula: e.target.value || undefined })}
                                    placeholder="e.g. {f-price} * {f-qty} or ROUND({f-score}, 2)"
                                    style={{ fontSize: 12, fontFamily: 'monospace' }}
                                  />
                                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-disabled)', lineHeight: 1.6 }}>
                                    Functions: ROUND(x, n) · ABS(x) · FLOOR(x) · CEIL(x) · IF(cond, a, b) · CONCAT(…) · LEN(s) · TODAY() · DAYS(a, b)
                                  </div>
                                </div>
                              )}
                              {(f.type === 'lookup' || f.type === 'rollup') && (() => {
                                const relFields = fields.filter(rf => rf.type === 'relation')
                                const selRelField = relFields.find(rf => rf.id === f.linkedFieldId)
                                const linkedApp = workspaceApps.find(a => a.id === selRelField?.relatedAppId)
                                let linkedAppFields: AppField[] = []
                                try { linkedAppFields = JSON.parse(linkedApp?.fieldsJson ?? '[]') } catch { /* */ }
                                return (
                                  <>
                                    <div>
                                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>{t('header.linkedRelField')}</div>
                                      <select
                                        className="form-input form-select"
                                        value={f.linkedFieldId ?? ''}
                                        onChange={e => updateField(f.id, { linkedFieldId: e.target.value || undefined, lookupFieldId: undefined, rollupFieldId: undefined })}
                                        style={{ fontSize: 12 }}
                                      >
                                        <option value="">{t('header.chooseRelField')}</option>
                                        {relFields.map(rf => <option key={rf.id} value={rf.id}>{rf.name}</option>)}
                                      </select>
                                    </div>
                                    {f.type === 'lookup' && f.linkedFieldId && (
                                      <div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>{t('header.lookupField')}</div>
                                        <select
                                          className="form-input form-select"
                                          value={f.lookupFieldId ?? ''}
                                          onChange={e => updateField(f.id, { lookupFieldId: e.target.value || undefined })}
                                          style={{ fontSize: 12 }}
                                        >
                                          <option value="">{t('header.chooseLookupField')}</option>
                                          <option value="__title__">Title (record name)</option>
                                          {linkedAppFields.filter(lf => !['lookup', 'rollup', 'relation', 'calculation'].includes(lf.type)).map(lf => (
                                            <option key={lf.id} value={lf.id}>{lf.name} ({lf.type})</option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                    {f.type === 'rollup' && f.linkedFieldId && (
                                      <>
                                        <div>
                                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>{t('header.rollupFn')}</div>
                                          <select
                                            className="form-input form-select"
                                            value={f.rollupFunction ?? 'COUNT'}
                                            onChange={e => updateField(f.id, { rollupFunction: e.target.value as RollupFunction, rollupFieldId: undefined })}
                                            style={{ fontSize: 12 }}
                                          >
                                            <option value="COUNT">COUNT — number of linked records</option>
                                            <option value="SUM">SUM — sum of a numeric field</option>
                                            <option value="AVG">AVG — average of a numeric field</option>
                                            <option value="MIN">MIN — minimum value</option>
                                            <option value="MAX">MAX — maximum value</option>
                                          </select>
                                        </div>
                                        {(f.rollupFunction ?? 'COUNT') !== 'COUNT' && (
                                          <div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>{t('header.rollupField')}</div>
                                            <select
                                              className="form-input form-select"
                                              value={f.rollupFieldId ?? ''}
                                              onChange={e => updateField(f.id, { rollupFieldId: e.target.value || undefined })}
                                              style={{ fontSize: 12 }}
                                            >
                                              <option value="">{t('header.chooseLookupField')}</option>
                                              {linkedAppFields.filter(lf => ['number', 'rating', 'progress'].includes(lf.type)).map(lf => (
                                                <option key={lf.id} value={lf.id}>{lf.name}</option>
                                              ))}
                                            </select>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </>
                                )
                              })()}
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>
                                  {t('header.fieldDesc')}
                                </div>
                                <input
                                  className="form-input"
                                  value={f.description ?? ''}
                                  onChange={e => updateField(f.id, { description: e.target.value || undefined })}
                                  placeholder="e.g. Enter the client's full name"
                                  style={{ fontSize: 12 }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="add-field-panel">
                <div className="fields-section-label">{t('header.addField')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 148px auto', gap: 10 }}>
                  <input className="form-input" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder={t('header.fieldName')}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), newFieldName.trim() && addField())} />
                  <select className="form-input form-select" value={newFieldType} onChange={e => { setNewFieldType(e.target.value as FieldType); setNewOptions([]) }}>
                    {FIELD_TYPE_DEFS.map(ft => <option key={ft.value} value={ft.value}>{ft.icon} {t(ft.labelKey)}</option>)}
                  </select>
                  <button className="btn btn-secondary" onClick={addField} disabled={!newFieldName.trim()}>{t('header.addFieldBtn')}</button>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={newFieldRequired}
                      onChange={e => setNewFieldRequired(e.target.checked)}
                      style={{ width: 13, height: 13, accentColor: 'var(--brand-500)', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{t('header.required')}</span>
                  </label>
                  <input
                    className="form-input"
                    value={newFieldDesc}
                    onChange={e => setNewFieldDesc(e.target.value)}
                    placeholder={t('header.descOptional')}
                    style={{ flex: 1, fontSize: 12 }}
                  />
                </div>
                {newFieldType === 'calculation' && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>{t('header.formula')}</div>
                    <input
                      className="form-input"
                      value={newFieldFormula}
                      onChange={e => setNewFieldFormula(e.target.value)}
                      placeholder="e.g. {f-price} * {f-qty} or ROUND({f-score}, 2)"
                      style={{ fontSize: 12, fontFamily: 'monospace' }}
                    />
                    <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text-disabled)', lineHeight: 1.6 }}>
                      Functions: ROUND · ABS · FLOOR · CEIL · IF · CONCAT · LEN · TODAY() · DAYS(a, b)
                    </div>
                  </div>
                )}
                {newFieldType === 'relation' && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>{t('header.linkedApp')}</div>
                    <select
                      className="form-input form-select"
                      value={newFieldRelatedApp}
                      onChange={e => setNewFieldRelatedApp(e.target.value)}
                    >
                      <option value="">{t('header.chooseApp')}</option>
                      {workspaceApps.filter(a => a.id !== app.id).map(a => (
                        <option key={a.id} value={a.id}>{a.iconEmoji} {a.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {(newFieldType === 'lookup' || newFieldType === 'rollup') && (() => {
                  const relFields = fields.filter(rf => rf.type === 'relation')
                  const selRelField = relFields.find(rf => rf.id === newFieldLinkedFieldId)
                  const linkedApp = workspaceApps.find(a => a.id === selRelField?.relatedAppId)
                  let linkedAppFields: AppField[] = []
                  try { linkedAppFields = JSON.parse(linkedApp?.fieldsJson ?? '[]') } catch { /* */ }
                  return (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>{t('header.linkedRelField')}</div>
                        <select
                          className="form-input form-select"
                          value={newFieldLinkedFieldId}
                          onChange={e => { setNewFieldLinkedFieldId(e.target.value); setNewFieldLookupFieldId(''); setNewFieldRollupFieldId('') }}
                        >
                          <option value="">{t('header.chooseRelField')}</option>
                          {relFields.map(rf => <option key={rf.id} value={rf.id}>{rf.name}</option>)}
                        </select>
                      </div>
                      {newFieldType === 'lookup' && newFieldLinkedFieldId && (
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>{t('header.lookupField')}</div>
                          <select
                            className="form-input form-select"
                            value={newFieldLookupFieldId}
                            onChange={e => setNewFieldLookupFieldId(e.target.value)}
                          >
                            <option value="">{t('header.chooseLookupField')}</option>
                            <option value="__title__">Title (record name)</option>
                            {linkedAppFields.filter(lf => !['lookup', 'rollup', 'relation', 'calculation'].includes(lf.type)).map(lf => (
                              <option key={lf.id} value={lf.id}>{lf.name} ({lf.type})</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {newFieldType === 'rollup' && newFieldLinkedFieldId && (
                        <>
                          <div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>{t('header.rollupFn')}</div>
                            <select
                              className="form-input form-select"
                              value={newFieldRollupFn}
                              onChange={e => { setNewFieldRollupFn(e.target.value as RollupFunction); setNewFieldRollupFieldId('') }}
                            >
                              <option value="COUNT">COUNT — number of linked records</option>
                              <option value="SUM">SUM — sum of a numeric field</option>
                              <option value="AVG">AVG — average of a numeric field</option>
                              <option value="MIN">MIN — minimum value</option>
                              <option value="MAX">MAX — maximum value</option>
                            </select>
                          </div>
                          {newFieldRollupFn !== 'COUNT' && (
                            <div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>{t('header.rollupField')}</div>
                              <select
                                className="form-input form-select"
                                value={newFieldRollupFieldId}
                                onChange={e => setNewFieldRollupFieldId(e.target.value)}
                              >
                                <option value="">{t('header.chooseLookupField')}</option>
                                {linkedAppFields.filter(lf => ['number', 'rating', 'progress'].includes(lf.type)).map(lf => (
                                  <option key={lf.id} value={lf.id}>{lf.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })()}
                {(newFieldType === 'category' || newFieldType === 'multiselect') && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>{t('header.options')}</div>
                    {newOptions.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                        {newOptions.map(o => (
                          <span key={o.id} style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: o.color + '22', color: o.color, border: `1px solid ${o.color}44` }}>{o.label}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="form-input" value={newOptionLabel} onChange={e => setNewOptionLabel(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())}
                        placeholder={t('header.optionLabel')} style={{ maxWidth: 220 }} />
                      <button className="btn btn-secondary btn-sm" onClick={addOption} disabled={!newOptionLabel.trim()}>{t('header.addOption')}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={cancelFields}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={saveFields} disabled={isPendingFields}>
                {isPendingFields ? <><span className="spinner" style={{ width: 13, height: 13 }} /> {t('common.saving')}</> : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Item Modal ── */}
      {showAddItem && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowAddItem(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{t('header.addItem')}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAddItem(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddItem}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {itemError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
                    <span>⚠</span> {itemError}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">{t('header.itemTitleLabel')} <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input className="form-input" name="title" placeholder={t('header.itemTitlePlaceholder')} required autoFocus />
                </div>
                {fields.map(f => (
                  <div key={f.id} className="form-group">
                    <label className="form-label">{f.name}</label>
                    <ItemFieldInput field={f} onChange={v => setItemData(d => ({ ...d, [f.id]: v }))} />
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddItem(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={isPendingItem}>
                  {isPendingItem ? <><span className="spinner" style={{ width: 13, height: 13 }} /> {t('header.addItem')}…</> : t('header.addItem')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Import CSV Modal ── */}
      {showImportCSV && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowImportCSV(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">{t('header.importCSV')}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowImportCSV(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {!csvPreview ? (
                <div
                  style={{
                    border: '2px dashed var(--border-default)', borderRadius: 12,
                    padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
                    transition: 'border-color var(--transition-fast)',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--brand-500)' }}
                  onDragLeave={e => { e.currentTarget.style.borderColor = '' }}
                  onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = ''; const f = e.dataTransfer.files[0]; if (f) handleCSVFile(f) }}
                >
                  <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>📂</div>
                  <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{t('header.dragCSV')}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>{t('header.orBrowse')}</p>
                  <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleCSVFile(f) }} />
                  <p style={{ fontSize: 11, color: 'var(--text-disabled)' }}>First row must be headers. Title column is required.</p>
                </div>
              ) : csvImportResult ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>{csvImportResult.err === 0 ? '✅' : '⚠️'}</div>
                  <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                    Import complete: {csvImportResult.ok} item{csvImportResult.ok !== 1 ? 's' : ''} created
                  </p>
                  {csvImportResult.err > 0 && (
                    <p style={{ fontSize: 13, color: 'var(--warning)' }}>{csvImportResult.err} row{csvImportResult.err !== 1 ? 's' : ''} skipped (missing title)</p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                      Found <strong style={{ color: 'var(--text-primary)' }}>{csvPreview.rows.length} rows</strong>. Map CSV columns to fields:
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {csvPreview.headers.map(h => (
                        <div key={h} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 6, fontFamily: 'monospace' }}>{h}</span>
                          <select
                            className="form-input form-select"
                            value={csvMapping[h] ?? ''}
                            onChange={e => setCsvMapping(m => ({ ...m, [h]: e.target.value }))}
                            style={{ padding: '6px 28px 6px 10px', fontSize: 12 }}
                          >
                            <option value="">— Skip —</option>
                            <option value="title">Title (required)</option>
                            {fields.map(f => <option key={f.id} value={f.id}>{f.name} ({f.type})</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                    {!Object.values(csvMapping).includes('title') && (
                      <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 10 }}>⚠ Map at least one column to &quot;Title&quot;</p>
                    )}
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-disabled)', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Preview (first 3 rows)
                    </p>
                    <div style={{ overflowX: 'auto', padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)' }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                        <thead>
                          <tr>{csvPreview.headers.map(h => <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-disabled)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {csvPreview.rows.slice(0, 3).map((row, i) => (
                            <tr key={i}>{csvPreview.headers.map((_, j) => <td key={j} style={{ padding: '4px 8px', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row[j] ?? ''}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              {csvImportResult ? (
                <button className="btn btn-primary" onClick={() => setShowImportCSV(false)}>Done</button>
              ) : csvPreview ? (
                <>
                  <button className="btn btn-secondary" onClick={() => setCsvPreview(null)}>← Back</button>
                  <button
                    className="btn btn-primary"
                    onClick={handleCSVImport}
                    disabled={csvImporting || !Object.values(csvMapping).includes('title')}
                  >
                    {csvImporting ? <><span className="spinner" style={{ width: 13, height: 13 }} /> {t('header.importBtn')}…</> : t('header.importBtn')}
                  </button>
                </>
              ) : (
                <button className="btn btn-secondary" onClick={() => setShowImportCSV(false)}>{t('common.cancel')}</button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .app-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 20px;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-surface);
          flex-shrink: 0;
          gap: 16px;
          min-height: 58px;
        }
        .app-more-menu {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          background: var(--bg-overlay);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-xl);
          padding: 4px;
          min-width: 160px;
          z-index: 200;
          animation: fadeIn 80ms ease;
        }
        .app-more-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 7px 10px;
          font-size: 12.5px;
          font-weight: 500;
          font-family: inherit;
          color: var(--text-secondary);
          background: none;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          transition: all var(--transition-fast);
        }
        .app-more-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .app-more-item.danger { color: var(--error); }
        .app-more-item.danger:hover { background: rgba(239,68,68,0.1); }
        .fields-section-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.7px;
          margin-bottom: 10px;
        }
        .field-row-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          transition: border-color var(--transition-fast);
        }
        .field-row-item:hover { border-color: var(--border-default); }
        .field-row-item.field-dragging { opacity: 0.4; border-style: dashed; }
        .add-field-panel {
          padding: 16px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
        }
      `}</style>
    </>
  )
}

function ItemFieldInput({ field, onChange }: { field: AppField; onChange: (v: unknown) => void }) {
  // All hooks must be at the top — unconditional
  const [multiSel, setMultiSel] = React.useState<string[]>([])
  const [ratingVal, setRatingVal] = React.useState(0)
  const [progressVal, setProgressVal] = React.useState(0)

  if (field.type === 'toggle') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" onChange={e => onChange(e.target.checked)} />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Enabled</span>
      </label>
    )
  }
  if (field.type === 'category' && field.options) {
    return (
      <select className="form-input form-select" defaultValue="" onChange={e => onChange(e.target.value)}>
        <option value="">Select…</option>
        {field.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    )
  }
  if (field.type === 'multiselect' && field.options) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {field.options.map(o => {
          const sel = multiSel.includes(o.id)
          return (
            <button key={o.id} type="button" onClick={() => {
              const next = sel ? multiSel.filter(x => x !== o.id) : [...multiSel, o.id]
              setMultiSel(next)
              onChange(next)
            }} style={{
              padding: '2px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, border: '1px solid',
              background: sel ? o.color + '33' : 'var(--bg-overlay)',
              borderColor: sel ? o.color : 'var(--border-default)',
              color: sel ? o.color : 'var(--text-secondary)', cursor: 'pointer',
            }}>{o.label}</button>
          )
        })}
      </div>
    )
  }
  if (field.type === 'rating') {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button" onClick={() => { setRatingVal(n); onChange(n) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: n <= ratingVal ? '#f59e0b' : 'var(--text-disabled)', transition: 'color 100ms' }}>★</button>
        ))}
      </div>
    )
  }
  if (field.type === 'progress') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="range" min={0} max={100} value={progressVal} onChange={e => { setProgressVal(+e.target.value); onChange(+e.target.value) }}
          style={{ flex: 1, accentColor: 'var(--brand-500)' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', minWidth: 32 }}>{progressVal}%</span>
      </div>
    )
  }
  const typeMap: Partial<Record<FieldType, string>> = { date: 'date', number: 'number', email: 'email', url: 'url', phone: 'tel' }
  return (
    <input
      type={typeMap[field.type] ?? 'text'}
      className="form-input"
      onChange={e => onChange(e.target.value)}
      placeholder={field.name}
    />
  )
}
