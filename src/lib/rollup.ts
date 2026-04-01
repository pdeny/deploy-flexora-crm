import type { AppField, RollupFunction } from './types'

type RelationRecord = { fieldId: string; fromItemId: string; toItemId: string }
type LinkedItem = { id: string; title: string; dataJson: string }

/**
 * Compute lookup and rollup values for a set of items.
 * Returns a map: itemId → { fieldId → computed value }
 */
export function computeRollupLookup(
  items: { id: string }[],
  fields: AppField[],
  relations: RelationRecord[],
  linkedItemsMap: Record<string, LinkedItem>,
): Record<string, Record<string, unknown>> {
  const targetFields = fields.filter(f => f.type === 'lookup' || f.type === 'rollup')
  if (targetFields.length === 0) return {}

  const result: Record<string, Record<string, unknown>> = {}

  for (const item of items) {
    result[item.id] = {}

    for (const field of targetFields) {
      if (!field.linkedFieldId) continue

      const linkedItems = relations
        .filter(r => r.fromItemId === item.id && r.fieldId === field.linkedFieldId)
        .map(r => linkedItemsMap[r.toItemId])
        .filter((li): li is LinkedItem => Boolean(li))

      if (field.type === 'lookup') {
        const lookupId = field.lookupFieldId
        if (!lookupId) { result[item.id][field.id] = null; continue }

        if (lookupId === '__title__') {
          const vals = linkedItems.map(li => li.title).filter(Boolean)
          result[item.id][field.id] = vals.length > 0 ? vals.join(', ') : null
        } else {
          const vals = linkedItems.map(li => {
            let d: Record<string, unknown> = {}
            try { d = JSON.parse(li.dataJson) } catch { /* */ }
            const v = d[lookupId]
            return v !== null && v !== undefined && v !== '' ? String(v) : null
          }).filter(Boolean)
          result[item.id][field.id] = vals.length > 0 ? vals.join(', ') : null
        }
      } else {
        // rollup
        const fn: RollupFunction = field.rollupFunction ?? 'COUNT'

        if (fn === 'COUNT') {
          result[item.id][field.id] = linkedItems.length
          continue
        }

        const rollupId = field.rollupFieldId
        if (!rollupId) { result[item.id][field.id] = null; continue }

        const nums = linkedItems.map(li => {
          let d: Record<string, unknown> = {}
          try { d = JSON.parse(li.dataJson) } catch { /* */ }
          const v = d[rollupId]
          if (v === null || v === undefined || v === '') return null
          const n = Number(v)
          return isNaN(n) ? null : n
        }).filter((v): v is number => v !== null)

        if (nums.length === 0) { result[item.id][field.id] = null; continue }

        switch (fn) {
          case 'SUM': result[item.id][field.id] = nums.reduce((a, b) => a + b, 0); break
          case 'AVG': result[item.id][field.id] = parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(4)); break
          case 'MIN': result[item.id][field.id] = Math.min(...nums); break
          case 'MAX': result[item.id][field.id] = Math.max(...nums); break
          default: result[item.id][field.id] = null
        }
      }
    }
  }

  return result
}

/** For use in client components (ItemDetail): compute from already-fetched linked items */
export function computeFieldFromLinkedItems(
  field: AppField,
  linkedItems: { id: string; title: string; dataJson: string }[],
): unknown {
  if (field.type === 'lookup') {
    const lookupId = field.lookupFieldId
    if (!lookupId) return null

    if (lookupId === '__title__') {
      const vals = linkedItems.map(li => li.title).filter(Boolean)
      return vals.length > 0 ? vals.join(', ') : null
    }
    const vals = linkedItems.map(li => {
      let d: Record<string, unknown> = {}
      try { d = JSON.parse(li.dataJson) } catch { /* */ }
      const v = d[lookupId]
      return v !== null && v !== undefined && v !== '' ? String(v) : null
    }).filter(Boolean)
    return vals.length > 0 ? vals.join(', ') : null
  }

  if (field.type === 'rollup') {
    const fn: RollupFunction = field.rollupFunction ?? 'COUNT'
    if (fn === 'COUNT') return linkedItems.length

    const rollupId = field.rollupFieldId
    if (!rollupId) return null

    const nums = linkedItems.map(li => {
      let d: Record<string, unknown> = {}
      try { d = JSON.parse(li.dataJson) } catch { /* */ }
      const v = d[rollupId]
      if (v === null || v === undefined || v === '') return null
      const n = Number(v)
      return isNaN(n) ? null : n
    }).filter((v): v is number => v !== null)

    if (nums.length === 0) return null
    switch (fn) {
      case 'SUM': return nums.reduce((a, b) => a + b, 0)
      case 'AVG': return parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(4))
      case 'MIN': return Math.min(...nums)
      case 'MAX': return Math.max(...nums)
      default: return null
    }
  }

  return null
}
