import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LoginPageContent from './LoginPageContent'

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')
  return <LoginPageContent />
}
