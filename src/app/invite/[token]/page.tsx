import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import InviteClient from './InviteClient'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const user = await getCurrentUser()

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
    include: {
      workspace: { select: { id: true, name: true, iconEmoji: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  })

  if (!invite || invite.expiresAt < new Date()) {
    return <InviteClient status="expired" />
  }

  // If not logged in, redirect to register with invite token
  if (!user) {
    redirect(`/register?invite=${token}`)
  }

  // If email-bound, verify match
  if (invite.email && invite.email !== user.email) {
    return <InviteClient status="wrong-email" inviteEmail={invite.email} />
  }

  // Check if already a member
  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
  })
  if (existing) {
    redirect(`/dashboard/${invite.workspaceId}`)
  }

  return (
    <InviteClient
      status="pending"
      token={token}
      workspaceName={invite.workspace.name}
      workspaceEmoji={invite.workspace.iconEmoji}
      invitedByName={invite.invitedBy.name ?? invite.invitedBy.email}
    />
  )
}
