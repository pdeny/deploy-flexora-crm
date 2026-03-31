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
