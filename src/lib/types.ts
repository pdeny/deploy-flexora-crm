export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'category'
  | 'relation'
  | 'calculation'
  | 'email'
  | 'url'
  | 'phone'
  | 'toggle'
  | 'image'

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
}

export interface ItemData {
  [fieldId: string]: unknown
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
