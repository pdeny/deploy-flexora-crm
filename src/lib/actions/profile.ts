'use server'

import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

export async function updateProfile(data: { name: string }) {
  const user = await requireUser()
  const name = data.name.trim()
  if (!name) return { error: 'Name is required' }

  await prisma.user.update({
    where: { id: user.id },
    data: { name },
  })
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

export async function updateAvatar(dataUrl: string) {
  const user = await requireUser()
  if (!dataUrl.startsWith('data:image/')) return { error: 'Invalid image format' }
  if (dataUrl.length > 500_000) return { error: 'Image too large — please use a smaller photo' }

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: dataUrl },
  })
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

export async function removeAvatar() {
  const user = await requireUser()
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } })
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

export async function changePassword(data: { current: string; next: string }) {
  const user = await requireUser()

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser) return { error: 'User not found' }

  const valid = await bcrypt.compare(data.current, dbUser.passwordHash)
  if (!valid) return { error: 'Current password is incorrect' }

  if (data.next.length < 8) return { error: 'New password must be at least 8 characters' }

  const hash = await bcrypt.hash(data.next, 12)
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } })
  return { success: true }
}
