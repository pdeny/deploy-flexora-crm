import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse @[displayName](userId) tokens from a message and return unique user IDs */
function parseMentionIds(content: string): string[] {
  const ids: string[] = []
  const re = /@\[[^\]]*\]\(([^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    if (!ids.includes(m[1])) ids.push(m[1])
  }
  return ids
}

/** Strip mention markup for plain-text rendering */
function stripMentions(content: string): string {
  return content.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1')
}

async function sendMentionEmail(opts: {
  toEmail: string
  toName: string | null
  fromName: string
  workspaceName: string
  content: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const from = process.env.RESEND_FROM ?? 'Flexora <onboarding@resend.dev>'
  const plainContent = stripMentions(opts.content)
  const recipientLabel = opts.toName ?? opts.toEmail

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: opts.toEmail,
      subject: `${opts.fromName} mentioned you in ${opts.workspaceName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="margin:0 0 8px;font-size:18px;color:#111">
            You were mentioned in <strong>${opts.workspaceName}</strong>
          </h2>
          <p style="margin:0 0 20px;color:#555;font-size:14px">
            ${opts.fromName} mentioned you in a chat message.
          </p>
          <blockquote style="margin:0 0 24px;padding:12px 16px;background:#f5f5f5;border-left:3px solid #6366f1;border-radius:4px;font-size:14px;color:#333;white-space:pre-wrap">${plainContent}</blockquote>
          <p style="margin:0;font-size:12px;color:#999">
            You're receiving this because you're a member of ${opts.workspaceName} on Flexora.
          </p>
        </div>
      `,
    }),
  }).catch(() => { /* email failures are non-fatal */ })
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspaceId } = await params

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const since = req.nextUrl.searchParams.get('since')

  const [messages, members] = await Promise.all([
    prisma.message.findMany({
      where: {
        workspaceId,
        ...(since ? { createdAt: { gt: new Date(since) } } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
      take: since ? 50 : 100,
    }),
    // Only fetch members on initial load (no `since`)
    since ? Promise.resolve(null) : prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ])

  return NextResponse.json({
    messages,
    ...(members ? { members: members.map(m => m.user) } : {}),
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspaceId } = await params

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    include: { workspace: { select: { name: true } } },
  })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const content: string = body?.content ?? ''
  if (!content.trim()) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  }

  const message = await prisma.message.create({
    data: { workspaceId, userId: user.id, content: content.trim() },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  // ── Process mentions asynchronously ────────────────────────────────────────
  const mentionedIds = parseMentionIds(content)
  if (mentionedIds.length > 0) {
    const senderName = user.name ?? user.email
    const workspaceName = membership.workspace.name

    // Fetch mentioned users (must be workspace members)
    const mentionedMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        userId: { in: mentionedIds },
        NOT: { userId: user.id }, // don't notify self
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    await Promise.all(
      mentionedMembers.map(async m => {
        // In-app notification
        await prisma.notification.create({
          data: {
            userId: m.userId,
            title: `${senderName} mentioned you`,
            body: stripMentions(content).slice(0, 120),
            link: `/dashboard/${workspaceId}`,
          },
        })

        // Email notification (fire-and-forget)
        sendMentionEmail({
          toEmail: m.user.email,
          toName: m.user.name,
          fromName: senderName,
          workspaceName,
          content: content.trim(),
        })
      })
    )
  }

  return NextResponse.json({ message })
}
