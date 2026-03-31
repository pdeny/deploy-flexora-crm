'use server'

import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function markAllNotificationsRead() {
  const user = await requireUser()
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  })
  revalidatePath('/dashboard', 'layout')
}

export async function markNotificationRead(notificationId: string) {
  const user = await requireUser()
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id },
    data: { isRead: true },
  })
  revalidatePath('/dashboard', 'layout')
}
