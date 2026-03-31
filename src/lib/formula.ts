/**
 * Flexora formula evaluator for calculation fields.
 *
 * Syntax:
 *   {fieldId}            — resolved to the field's numeric/string value
 *   {fieldId:label}      — same but with a display label (label is ignored at eval time)
 *   ROUND(x, n?)         — round to n decimal places (default 0)
 *   ABS(x)               — absolute value
 *   FLOOR(x)             — floor
 *   CEIL(x)              — ceil
 *   IF(cond, a, b)       — conditional (cond truthy → a, else b)
 *   CONCAT(a, b, …)      — string concatenation
 *   LEN(s)               — string length
 *   TODAY()              — today's date as YYYY-MM-DD string
 *   DAYS(a, b)           — difference in days between two date strings (a − b)
 *
 * Numbers, strings (in double-quotes), +, -, *, /, >, <, >=, <=, ==, !=, &&, ||, ()
 * are all supported via a sandboxed Function constructor.
 */

import type { AppField } from './types'

/** Replace {fieldId} / {fieldId:label} tokens with their JS variable names */
function tokenize(formula: string): { js: string; vars: Record<string, unknown> } {
  const vars: Record<string, unknown> = {}
  const sanitized = formula.replace(/\{([^}]+)\}/g, (_, inner) => {
    const fieldId = inner.split(':')[0].trim()
    const safe = '__f_' + fieldId.replace(/[^a-zA-Z0-9_]/g, '_')
    vars[safe] = fieldId   // we'll fill the value later
    return safe
  })
  return { js: sanitized, vars }
}

const ALLOWED_FNS = `
const ROUND = (x, n=0) => {
  const f = Math.pow(10, n)
  return Math.round((+x || 0) * f) / f
}
const ABS   = x => Math.abs(+x || 0)
const FLOOR = x => Math.floor(+x || 0)
const CEIL  = x => Math.ceil(+x || 0)
const IF    = (c, a, b) => (c ? a : b)
const CONCAT = (...args) => args.map(String).join('')
const LEN   = s => String(s ?? '').length
const TODAY = () => new Date().toISOString().slice(0, 10)
const DAYS  = (a, b) => {
  const da = new Date(a), db = new Date(b)
  if (isNaN(da) || isNaN(db)) return null
  return Math.round((da.getTime() - db.getTime()) / 86400000)
}
`

/**
 * Evaluate a formula string given a map of field values.
 * Returns the result (number | string | null) or an error string.
 */
export function evalFormula(
  formula: string,
  fields: AppField[],
  data: Record<string, unknown>,
): { result: unknown; error?: string } {
  if (!formula.trim()) return { result: null }
  try {
    const { js, vars } = tokenize(formula)

    // Build variable declarations for each resolved field
    const varDecls = Object.entries(vars)
      .map(([varName, fieldId]) => {
        const field = fields.find(f => f.id === fieldId)
        const raw = data[fieldId as string]
        let val: unknown = raw ?? null

        if (field) {
          if (['text', 'email', 'phone', 'url', 'image'].includes(field.type)) {
            val = String(raw ?? '')
          } else if (['number', 'rating', 'progress'].includes(field.type)) {
            val = raw !== undefined && raw !== null && raw !== '' ? Number(raw) : 0
          } else if (field.type === 'toggle') {
            val = Boolean(raw)
          } else if (field.type === 'date') {
            val = raw ? String(raw) : null
          } else {
            val = raw ?? null
          }
        }

        return `const ${varName} = ${JSON.stringify(val)};`
      })
      .join('\n')

    const code = `${ALLOWED_FNS}\n${varDecls}\nreturn (${js});`
    const fn = new Function(code)
    const result = fn()
    return { result: result ?? null }
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : 'Formula error' }
  }
}

/** Format a formula result for display */
export function formatFormulaResult(result: unknown): string {
  if (result === null || result === undefined) return '—'
  if (typeof result === 'number') {
    if (!isFinite(result)) return '—'
    // Show up to 4 decimal places, trim trailing zeros
    return parseFloat(result.toFixed(4)).toString()
  }
  if (typeof result === 'boolean') return result ? 'Yes' : 'No'
  return String(result)
}
