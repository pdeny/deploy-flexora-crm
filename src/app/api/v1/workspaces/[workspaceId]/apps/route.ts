import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiKey } from '@/app/api/v1/_auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params
  return withApiKey(req, async authed => {
    if (authed.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const apps = await prisma.app.findMany({
      where: { workspaceId },
      select: { id: true, name: true, description: true, iconEmoji: true, color: true, fieldsJson: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ apps: apps.map(a => ({ ...a, fields: JSON.parse(a.fieldsJson), fieldsJson: undefined })) })
  })
}
