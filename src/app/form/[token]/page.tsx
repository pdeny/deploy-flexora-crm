import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import type { AppField } from '@/lib/types'
import type { FormConfig } from '@/lib/actions/settings'
import PublicFormClient from './PublicFormClient'

export default async function FormPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ embed?: string }>
}) {
  const { token } = await params
  const { embed } = await searchParams
  const isEmbed = embed === '1'

  const app = await prisma.app.findUnique({ where: { formToken: token } })
  if (!app) notFound()

  const allFields: AppField[] = JSON.parse(app.fieldsJson)

  let config: FormConfig = {
    title: `Submit to ${app.name}`,
    description: '',
    fieldIds: allFields.map(f => f.id),
    submitLabel: 'Submit',
  }
  try {
    const parsed = JSON.parse(app.formFieldsJson)
    if (parsed && typeof parsed === 'object' && 'fieldIds' in parsed) {
      config = { ...config, ...parsed }
    }
  } catch { /* ignore */ }

  const fields = allFields.filter(f => config.fieldIds.includes(f.id))

  return (
    <PublicFormClient
      token={token}
      app={{ name: app.name, iconEmoji: app.iconEmoji, color: app.color, description: app.description }}
      config={config}
      fields={fields}
      embed={isEmbed}
    />
  )
}
