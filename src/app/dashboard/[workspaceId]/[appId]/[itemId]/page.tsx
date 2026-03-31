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

  return (
    <ItemDetail
      item={item}
      fields={fields}
      user={user}
      workspaceId={workspaceId}
    />
  )
}
