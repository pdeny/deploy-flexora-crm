import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiKey } from '@/app/api/v1/_auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string; itemId: string }> },
) {
  const { appId, itemId } = await params
  return withApiKey(req, async authed => {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: { creator: { select: { id: true, name: true, email: true } } },
    })
    if (!item || item.appId !== appId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const app = await prisma.app.findUnique({ where: { id: appId } })
    if (!app || app.workspaceId !== authed.workspaceId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({
      id: item.id, title: item.title,
      data: JSON.parse(item.dataJson),
      creator: item.creator, createdAt: item.createdAt, updatedAt: item.updatedAt,
    })
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string; itemId: string }> },
) {
  const { appId, itemId } = await params
  return withApiKey(req, async authed => {
    const item = await prisma.item.findUnique({ where: { id: itemId } })
    if (!item || item.appId !== appId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const app = await prisma.app.findUnique({ where: { id: appId } })
    if (!app || app.workspaceId !== authed.workspaceId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let body: { title?: string; data?: Record<string, unknown> } = {}
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const existing = JSON.parse(item.dataJson) as Record<string, unknown>
    const updated = await prisma.item.update({
      where: { id: itemId },
      data: {
        ...(body.title ? { title: body.title.trim() } : {}),
        ...(body.data ? { dataJson: JSON.stringify({ ...existing, ...body.data }) } : {}),
      },
    })
    return NextResponse.json({ id: updated.id, title: updated.title, data: JSON.parse(updated.dataJson), updatedAt: updated.updatedAt })
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string; itemId: string }> },
) {
  const { appId, itemId } = await params
  return withApiKey(req, async authed => {
    const item = await prisma.item.findUnique({ where: { id: itemId } })
    if (!item || item.appId !== appId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const app = await prisma.app.findUnique({ where: { id: appId } })
    if (!app || app.workspaceId !== authed.workspaceId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await prisma.item.delete({ where: { id: itemId } })
    return new NextResponse(null, { status: 204 })
  })
}
