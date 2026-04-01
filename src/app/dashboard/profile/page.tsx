import { requireUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ProfileSettings from '@/components/ProfileSettings'
import PageHeader from '@/components/PageHeader'

export default async function ProfilePage() {
  let user
  try { user = await requireUser() } catch { redirect('/login') }

  return (
    <div className="page-body">
      <div className="page-header">
        <PageHeader titleKey="profile.title" subtitleKey="profile.subtitle" />
      </div>
      <ProfileSettings user={{ id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl }} />
    </div>
  )
}
