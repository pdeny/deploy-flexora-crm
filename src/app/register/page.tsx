import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import RegisterPageContent from './RegisterPageContent'

export default async function RegisterPage() {
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')
  return <RegisterPageContent />
}
