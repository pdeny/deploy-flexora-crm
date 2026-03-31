import type { AppField } from '@/lib/types'
import { evalFormula } from '@/lib/formula'

export type FilterOperator =
  | 'contains' | 'not_contains'
  | 'equals' | 'not_equals'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'before' | 'after'
  | 'is_empty' | 'is_not_empty'

export type FilterRule = {
  id: string
  fieldId: string  // '__title__' for item title
  op: FilterOperator
  value: unknown
}

export type SortConfig = {
  fieldId: string
  dir: 'asc' | 'desc'
}

type ItemRow = {
  id: string
  title: string
  dataJson: string
  createdAt: Date
  updatedAt: Date
  creator: { name: string | null; email: string }
  _count: { comments: number; tasks: number }
}

function getFieldValue(item: ItemRow, fieldId: string): unknown {
  if (fieldId === '__title__') return item.title
  try {
    const data = JSON.parse(item.dataJson) as Record<string, unknown>
    return data[fieldId]
  } catch {
    return undefined
  }
}

function matchesRule(item: ItemRow, rule: FilterRule, fields: AppField[]): boolean {
  const value = getFieldValue(item, rule.fieldId)
  const isEmpty = value === null || value === undefined || value === ''

  switch (rule.op) {
    case 'is_empty':    return isEmpty
    case 'is_not_empty': return !isEmpty
  }

  if (isEmpty) return false

  // Multiselect: value is an array
  const field2 = fields.find(f => f.id === rule.fieldId)
  if (field2?.type === 'multiselect' && Array.isArray(value)) {
    const arr = value as string[]
    const ruleVal = String(rule.value ?? '')
    if (rule.op === 'contains')     return arr.includes(ruleVal)
    if (rule.op === 'not_contains') return !arr.includes(ruleVal)
    if (rule.op === 'equals')       return arr.length === 1 && arr[0] === ruleVal
    if (rule.op === 'not_equals')   return !arr.includes(ruleVal)
    return true
  }

  const strValue = String(value).toLowerCase()
  const ruleStr = String(rule.value ?? '').toLowerCase()

  switch (rule.op) {
    case 'contains':     return strValue.includes(ruleStr)
    case 'not_contains': return !strValue.includes(ruleStr)
    case 'equals':       return strValue === ruleStr
    case 'not_equals':   return strValue !== ruleStr
    case 'gt':  return Number(value) > Number(rule.value)
    case 'gte': return Number(value) >= Number(rule.value)
    case 'lt':  return Number(value) < Number(rule.value)
    case 'lte': return Number(value) <= Number(rule.value)
    case 'before': {
      try { return new Date(value as string) < new Date(rule.value as string) }
      catch { return false }
    }
    case 'after': {
      try { return new Date(value as string) > new Date(rule.value as string) }
      catch { return false }
    }
    default: return true
  }
}

export function applyFilters(items: ItemRow[], rules: FilterRule[], fields: AppField[]): ItemRow[] {
  if (!rules.length) return items
  return items.filter(item => rules.every(rule => matchesRule(item, rule, fields)))
}

export function applySort(
  items: ItemRow[],
  fieldId: string | undefined,
  dir: string | undefined,
  fields: AppField[],
): ItemRow[] {
  if (!fieldId) return items
  const ascending = dir !== 'desc'

  return [...items].sort((a, b) => {
    const aVal = getFieldValue(a, fieldId)
    const bVal = getFieldValue(b, fieldId)

    if (aVal === null || aVal === undefined || aVal === '') return ascending ? 1 : -1
    if (bVal === null || bVal === undefined || bVal === '') return ascending ? -1 : 1

    const field = fields.find(f => f.id === fieldId)
    if (field?.type === 'calculation') {
      let aData: Record<string, unknown> = {}; let bData: Record<string, unknown> = {}
      try { aData = JSON.parse(a.dataJson) } catch { /* ignore */ }
      try { bData = JSON.parse(b.dataJson) } catch { /* ignore */ }
      const aR = Number(evalFormula(field.calcFormula ?? '', fields, aData).result ?? 0)
      const bR = Number(evalFormula(field.calcFormula ?? '', fields, bData).result ?? 0)
      return ascending ? aR - bR : bR - aR
    }
    if (field?.type === 'number') {
      return ascending ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal)
    }
    if (field?.type === 'date') {
      try {
        const aD = new Date(aVal as string).getTime()
        const bD = new Date(bVal as string).getTime()
        return ascending ? aD - bD : bD - aD
      } catch { /* fall through to string sort */ }
    }

    const aStr = String(aVal).toLowerCase()
    const bStr = String(bVal).toLowerCase()
    if (aStr < bStr) return ascending ? -1 : 1
    if (aStr > bStr) return ascending ? 1 : -1
    return 0
  })
}

export function operatorsForField(fieldId: string, fields: AppField[]): { value: FilterOperator; label: string }[] {
  const field = fields.find(f => f.id === fieldId)
  const type = field?.type ?? 'text'

  const common = [
    { value: 'is_empty' as FilterOperator, label: 'is empty' },
    { value: 'is_not_empty' as FilterOperator, label: 'is not empty' },
  ]

  if (type === 'number') return [
    { value: 'equals', label: '=' }, { value: 'not_equals', label: '≠' },
    { value: 'gt', label: '>' }, { value: 'gte', label: '≥' },
    { value: 'lt', label: '<' }, { value: 'lte', label: '≤' },
    ...common,
  ]

  if (type === 'date') return [
    { value: 'before', label: 'before' }, { value: 'after', label: 'after' },
    { value: 'equals', label: 'on date' },
    ...common,
  ]

  if (type === 'toggle') return [
    { value: 'equals', label: 'is' },
    ...common,
  ]

  if (type === 'category') return [
    { value: 'equals', label: 'is' }, { value: 'not_equals', label: 'is not' },
    ...common,
  ]

  if (type === 'multiselect') return [
    { value: 'contains', label: 'includes' }, { value: 'not_contains', label: 'does not include' },
    ...common,
  ]

  if (type === 'rating' || type === 'progress') return [
    { value: 'equals', label: '=' }, { value: 'not_equals', label: '≠' },
    { value: 'gt', label: '>' }, { value: 'gte', label: '≥' },
    { value: 'lt', label: '<' }, { value: 'lte', label: '≤' },
    ...common,
  ]

  // text, email, url, phone, etc.
  return [
    { value: 'contains', label: 'contains' }, { value: 'not_contains', label: 'does not contain' },
    { value: 'equals', label: 'is exactly' }, { value: 'not_equals', label: 'is not' },
    ...common,
  ]
}
