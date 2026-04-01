'use client'

import { useState, useTransition } from 'react'
import { updateProfile, changePassword } from '@/lib/actions/profile'
import { useT } from '@/contexts/LanguageContext'

type Props = {
  user: { id: string; name: string | null; email: string }
}

export default function ProfileSettings({ user }: Props) {
  // Profile tab
  const [name, setName] = useState(user.name ?? '')
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [isSavingProfile, startSaveProfile] = useTransition()

  // Password tab
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [isSavingPw, startSavePw] = useTransition()

  const [tab, setTab] = useState<'profile' | 'password'>('profile')

  const { t } = useT()

  function saveProfile() {
    setProfileMsg(null)
    startSaveProfile(async () => {
      const result = await updateProfile({ name })
      if (result?.error) setProfileMsg({ type: 'err', text: result.error })
      else setProfileMsg({ type: 'ok', text: t('profileSettings.savedOk') })
    })
  }

  function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg(null)
    if (next !== confirm) { setPwMsg({ type: 'err', text: t('profileSettings.pwMismatch') }); return }
    if (next.length < 8) { setPwMsg({ type: 'err', text: t('profileSettings.pwTooShort') }); return }
    startSavePw(async () => {
      const result = await changePassword({ current, next })
      if (result?.error) setPwMsg({ type: 'err', text: result.error })
      else {
        setPwMsg({ type: 'ok', text: t('profileSettings.pwChangedOk') })
        setCurrent(''); setNext(''); setConfirm('')
      }
    })
  }

  const initials = (user.name ?? user.email)[0].toUpperCase()

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Avatar card */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        marginBottom: 24,
      }}>
        <div style={{
          width: 64, height: 64,
          borderRadius: 18,
          background: 'linear-gradient(135deg, var(--brand-600), var(--accent-violet))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 800, color: '#fff',
          boxShadow: 'var(--shadow-glow-sm)',
          flexShrink: 0,
        }}>{initials}</div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>{user.name ?? user.email}</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>{user.email}</div>
          <div style={{
            marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700,
            background: 'rgba(99,102,241,0.12)', color: 'var(--brand-300)',
            border: '1px solid rgba(99,102,241,0.2)',
          }}>✦ Flexora member</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="settings-tab-bar" style={{ marginBottom: 20 }}>
        {[
          { id: 'profile', label: t('profileSettings.tabProfile') },
          { id: 'password', label: t('profileSettings.tabPassword') },
        ].map(tab_ => (
          <button
            key={tab_.id}
            className={`settings-tab-btn${tab === tab_.id ? ' active' : ''}`}
            onClick={() => setTab(tab_.id as typeof tab)}
          >{tab_.label}</button>
        ))}
      </div>

      {tab === 'profile' && (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)', padding: '22px 24px',
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 800 }}>{t('profileSettings.personalInfo')}</h2>
          <div className="form-group">
            <label className="form-label">{t('profile.displayName')}</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder={t('profileSettings.namePlaceholder')} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('profileSettings.emailLabel')}</label>
            <input className="form-input" value={user.email} disabled style={{ opacity: 0.5 }} />
            <p style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 4 }}>{t('profileSettings.emailNote')}</p>
          </div>
          {profileMsg && (
            <p style={{ fontSize: 12, color: profileMsg.type === 'ok' ? 'var(--success)' : 'var(--error)' }}>
              {profileMsg.text}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={saveProfile} disabled={isSavingProfile || !name.trim()}>
              {isSavingProfile ? <><span className="spinner" style={{ width: 13, height: 13 }} /> {t('profileSettings.saving')}</> : t('profileSettings.saveBtn')}
            </button>
          </div>
        </div>
      )}

      {tab === 'password' && (
        <form onSubmit={savePassword} style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)', padding: '22px 24px',
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 800 }}>{t('profileSettings.changePw')}</h2>
          <div className="form-group">
            <label className="form-label">{t('profileSettings.currentPw')}</label>
            <input type="password" className="form-input" value={current} onChange={e => setCurrent(e.target.value)} required autoComplete="current-password" />
          </div>
          <div className="form-group">
            <label className="form-label">{t('profileSettings.newPw')}</label>
            <input type="password" className="form-input" value={next} onChange={e => setNext(e.target.value)} required minLength={8} autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label className="form-label">{t('profileSettings.confirmPw')}</label>
            <input type="password" className="form-input" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
          </div>
          {pwMsg && (
            <p style={{ fontSize: 12, color: pwMsg.type === 'ok' ? 'var(--success)' : 'var(--error)' }}>
              {pwMsg.text}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={isSavingPw || !current || !next || !confirm}>
              {isSavingPw ? <><span className="spinner" style={{ width: 13, height: 13 }} /> {t('profileSettings.changing')}</> : t('profileSettings.changePwBtn')}
            </button>
          </div>

        </form>
      )}
      <style>{`
        .settings-tab-bar {
          display: flex;
          gap: 2px;
          border-bottom: 1px solid var(--border-default);
        }
        .settings-tab-btn {
          padding: 10px 18px;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
          margin-bottom: -1px;
        }
        .settings-tab-btn:hover {
          color: var(--text-primary);
          background: var(--bg-hover);
        }
        .settings-tab-btn.active {
          color: var(--brand-400);
          border-bottom-color: var(--brand-500);
          background: none;
        }
      `}</style>
    </div>
  )
}
