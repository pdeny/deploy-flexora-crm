'use server'

import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return { error: 'Invalid credentials' }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return { error: 'Invalid credentials' }

  const token = uuidv4()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await prisma.session.create({ data: { userId: user.id, token, expiresAt } })

  const cookieStore = await cookies()
  cookieStore.set('flexora_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
  })

  redirect('/dashboard')
}

export async function register(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const inviteToken = formData.get('inviteToken') as string | null

  if (!name || !email || !password) {
    return { error: 'All fields are required' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { error: 'Email already in use' }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  })

  // Create a default workspace for the user
  const slug = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
  await prisma.workspace.create({
    data: {
      name: `${name}'s Workspace`,
      slug,
      description: 'Your personal workspace',
      members: {
        create: { userId: user.id, role: 'owner' },
      },
    },
  })

  // If there's an invite token, accept it
  let inviteWorkspaceId: string | null = null
  if (inviteToken) {
    const invite = await prisma.workspaceInvite.findUnique({ where: { token: inviteToken } })
    if (invite && invite.expiresAt > new Date()) {
      // Verify email match if invite is email-bound
      if (!invite.email || invite.email === email.toLowerCase()) {
        const alreadyMember = await prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
        })
        if (!alreadyMember) {
          await prisma.workspaceMember.create({
            data: { workspaceId: invite.workspaceId, userId: user.id, role: invite.role },
          })
          inviteWorkspaceId = invite.workspaceId
        }
        if (invite.email) {
          await prisma.workspaceInvite.delete({ where: { id: invite.id } })
        }
      }
    }
  }

  const token = uuidv4()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await prisma.session.create({ data: { userId: user.id, token, expiresAt } })

  const cookieStore = await cookies()
  cookieStore.set('flexora_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
  })

  redirect(inviteWorkspaceId ? `/dashboard/${inviteWorkspaceId}` : '/dashboard')
}

export async function logout() {
  const cookieStore = await cookies()
  const token = cookieStore.get('flexora_session')?.value
  if (token) {
    await prisma.session.deleteMany({ where: { token } })
    cookieStore.delete('flexora_session')
  }
  redirect('/login')
}
