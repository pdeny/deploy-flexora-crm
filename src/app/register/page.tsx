import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import RegisterPageContent from './RegisterPageContent'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>
}) {
  const user = await getCurrentUser()
  const { invite } = await searchParams
  if (user) {
    // If logged in and has invite, redirect to accept it
    if (invite) redirect(`/invite/${invite}`)
    redirect('/dashboard')
  }
  return <RegisterPageContent inviteToken={invite} />
}
