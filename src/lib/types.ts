export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'category'
  | 'multiselect'
  | 'rating'
  | 'progress'
  | 'relation'
  | 'calculation'
  | 'email'
  | 'url'
  | 'phone'
  | 'toggle'
  | 'image'
  | 'lookup'
  | 'rollup'

export type RollupFunction = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX'

export interface CategoryOption {
  id: string
  label: string
  color: string
}

export interface AppField {
  id: string
  name: string
  type: FieldType
  required?: boolean
  options?: CategoryOption[]      // for 'category'
  relatedAppId?: string           // for 'relation'
  calcFormula?: string            // for 'calculation' (JS expression)
  description?: string
  linkedFieldId?: string          // for 'lookup'/'rollup': which relation field to aggregate
  lookupFieldId?: string          // for 'lookup': '__title__' or a field id from the linked app
  rollupFunction?: RollupFunction // for 'rollup': COUNT | SUM | AVG | MIN | MAX
  rollupFieldId?: string          // for 'rollup': which numeric field to aggregate (not needed for COUNT)
}

export interface ItemData {
  [fieldId: string]: unknown
}

export interface ColorRuleCondition {
  fieldId: string   // '__title__' or a field id
  op: string        // FilterOperator value
  value: unknown
}

export interface ColorRule {
  id: string
  name: string
  color: string           // hex color
  conditions: ColorRuleCondition[]  // AND logic (all must match); empty = always match
}

export interface AutomationTrigger {
  type: 'item_created' | 'item_updated' | 'comment_added' | 'scheduled'
  conditions?: { fieldId: string; operator: string; value: unknown }[]
  scheduleAt?: string
}

export interface AutomationAction {
  type: 'send_email' | 'create_item' | 'webhook' | 'notify'
  config: Record<string, unknown>
}
