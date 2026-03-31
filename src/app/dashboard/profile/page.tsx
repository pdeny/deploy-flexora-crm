import { requireUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ProfileSettings from '@/components/ProfileSettings'

export default async function ProfilePage() {
  let user
  try { user = await requireUser() } catch { redirect('/login') }

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile & Settings</h1>
          <p className="page-subtitle">Manage your account information and security settings.</p>
        </div>
      </div>
      <ProfileSettings user={{ id: user.id, name: user.name, email: user.email }} />
    </div>
  )
}
