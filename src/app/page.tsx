import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  let user
  try { user = await requireUser() } catch { redirect('/login') }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { joinedAt: 'asc' },
  })

  if (membership) {
    redirect(`/dashboard/${membership.workspaceId}`)
  }

  redirect('/dashboard')
}
