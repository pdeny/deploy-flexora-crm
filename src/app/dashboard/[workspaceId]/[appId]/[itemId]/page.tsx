import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import ItemDetail from '@/components/ItemDetail'
import type { AppField } from '@/lib/types'

export default async function ItemPage({
  params,
}: {
  params: Promise<{ workspaceId: string; appId: string; itemId: string }>
}) {
  let user
  try { user = await requireUser() } catch { redirect('/login') }

  const { workspaceId, appId, itemId } = await params

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: {
      app: { include: { workspace: { include: { members: true } } } },
      creator: true,
      comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
      tasks: { include: { assignee: true, creator: true }, orderBy: { createdAt: 'desc' } },
    },
  })

  if (!item || item.appId !== appId) notFound()

  const isMember = item.app.workspace.members.some(m => m.userId === user.id)
  if (!isMember) redirect('/dashboard')

  const fields: AppField[] = JSON.parse(item.app.fieldsJson)

  // Fetch relations per relation field
  const relationFields = fields.filter(f => f.type === 'relation' && f.relatedAppId)
  const [workspaceMembers, activityLogs, workspaceApps, ...relationResults] = await Promise.all([
    prisma.user.findMany({
      where: { workspaceMembers: { some: { workspaceId: item.app.workspaceId } } },
      select: { id: true, name: true, email: true },
    }),
    prisma.activityLog.findMany({
      where: { itemId: item.id },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
    prisma.app.findMany({
      where: { workspaceId: item.app.workspaceId },
      select: { id: true, name: true, iconEmoji: true, fieldsJson: true },
    }),
    ...relationFields.map(f =>
      prisma.itemRelation.findMany({
        where: { fieldId: f.id, fromItemId: item.id },
        include: { toItem: { select: { id: true, title: true, dataJson: true } } },
      })
    ),
  ])

  // Build a map: fieldId → linked items (with dataJson for lookup/rollup computation)
  const linkedByField: Record<string, { id: string; title: string; dataJson: string }[]> = {}
  relationFields.forEach((f, i) => {
    linkedByField[f.id] = (relationResults[i] ?? []).map((r: { toItem: { id: string; title: string; dataJson: string } }) => r.toItem)
  })

  return (
    <ItemDetail
      item={item}
      fields={fields}
      user={user}
      workspaceId={workspaceId}
      workspaceMembers={workspaceMembers}
      activityLogs={activityLogs}
      workspaceApps={workspaceApps}
      linkedByField={linkedByField}
    />
  )
}
