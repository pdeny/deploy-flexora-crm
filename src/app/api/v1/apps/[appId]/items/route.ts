import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiKey } from '@/app/api/v1/_auth'
import type { AppField } from '@/lib/types'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params
  return withApiKey(req, async authed => {
    const app = await prisma.app.findUnique({ where: { id: appId } })
    if (!app || app.workspaceId !== authed.workspaceId) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 })
    }
    const sp = req.nextUrl.searchParams
    const limit = Math.min(Number(sp.get('limit') ?? 100), 1000)
    const offset = Number(sp.get('offset') ?? 0)

    const [items, total] = await prisma.$transaction([
      prisma.item.findMany({
        where: { appId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { creator: { select: { id: true, name: true, email: true } } },
      }),
      prisma.item.count({ where: { appId } }),
    ])

    return NextResponse.json({
      total,
      limit,
      offset,
      items: items.map(i => ({
        id: i.id,
        title: i.title,
        data: JSON.parse(i.dataJson),
        creatorId: i.creatorId,
        creator: i.creator,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      })),
    })
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params
  return withApiKey(req, async authed => {
    const app = await prisma.app.findUnique({ where: { id: appId } })
    if (!app || app.workspaceId !== authed.workspaceId) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 })
    }

    let body: { title?: string; data?: Record<string, unknown> } = {}
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.title?.trim()) {
      return NextResponse.json({ error: '"title" is required' }, { status: 400 })
    }

    // Validate required fields
    const fields: AppField[] = JSON.parse(app.fieldsJson)
    const data = body.data ?? {}
    for (const field of fields) {
      if (!field.required) continue
      const val = data[field.id]
      const isEmpty = val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0)
      if (isEmpty) return NextResponse.json({ error: `"${field.name}" is required` }, { status: 422 })
    }

    const item = await prisma.item.create({
      data: {
        appId,
        title: body.title.trim(),
        dataJson: JSON.stringify(data),
        creatorId: authed.userId,
      },
      include: { creator: { select: { id: true, name: true, email: true } } },
    })
    return NextResponse.json({
      id: item.id,
      title: item.title,
      data: JSON.parse(item.dataJson),
      creator: item.creator,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }, { status: 201 })
  })
}
