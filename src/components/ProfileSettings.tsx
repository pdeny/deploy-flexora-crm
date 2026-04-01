'use client'

import { useState, useTransition, useRef } from 'react'
import { updateProfile, changePassword, updateAvatar, removeAvatar } from '@/lib/actions/profile'
import { useT } from '@/contexts/LanguageContext'

type Props = {
  user: { id: string; name: string | null; email: string; avatarUrl: string | null }
}

/** Resize a File to at most maxPx × maxPx and return a JPEG data URL. */
function resizeImage(file: File, maxPx = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.88))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}

export default function ProfileSettings({ user }: Props) {
  // Avatar
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatarUrl)
  const [avatarMsg, setAvatarMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [isSavingAvatar, startSaveAvatar] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarMsg({ type: 'err', text: t('profileSettings.avatarInvalidType') })
      return
    }
    setAvatarMsg(null)
    try {
      const dataUrl = await resizeImage(file, 256)
      setAvatarPreview(dataUrl)
      startSaveAvatar(async () => {
        const result = await updateAvatar(dataUrl)
        if (result?.error) setAvatarMsg({ type: 'err', text: result.error })
        else setAvatarMsg({ type: 'ok', text: t('profileSettings.avatarSaved') })
      })
    } catch {
      setAvatarMsg({ type: 'err', text: t('profileSettings.avatarError') })
    }
    // reset so same file can be re-picked
    e.target.value = ''
  }

  function handleRemoveAvatar() {
    setAvatarPreview(null)
    setAvatarMsg(null)
    startSaveAvatar(async () => {
      await removeAvatar()
    })
  }

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

  const displayName = user.name ?? user.email

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
        {/* Clickable avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 64, height: 64,
              borderRadius: 18,
              overflow: 'hidden',
              cursor: 'pointer',
              position: 'relative',
              boxShadow: 'var(--shadow-glow-sm)',
            }}
            title={t('profileSettings.changeAvatar')}
          >
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarPreview}
                alt={displayName}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(135deg, var(--brand-600), var(--accent-violet))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 800, color: '#fff',
              }}>
                {displayName[0].toUpperCase()}
              </div>
            )}
            {/* Hover overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0,
              transition: 'opacity 150ms',
            }}
              className="avatar-overlay"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          </div>

          {/* Remove button */}
          {avatarPreview && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={isSavingAvatar}
              title={t('profileSettings.removeAvatar')}
              style={{
                position: 'absolute', top: -6, right: -6,
                width: 20, height: 20, borderRadius: '50%',
                background: 'var(--error)', border: '2px solid var(--bg-surface)',
                color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0, fontSize: 12, lineHeight: 1,
              }}
            >×</button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>{displayName}</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>{user.email}</div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700,
              background: 'rgba(99,102,241,0.12)', color: 'var(--brand-300)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}>✦ Flexora member</div>
            {isSavingAvatar && <span className="spinner" style={{ width: 12, height: 12 }} />}
            {avatarMsg && (
              <span style={{ fontSize: 11, color: avatarMsg.type === 'ok' ? 'var(--success)' : 'var(--error)' }}>
                {avatarMsg.text}
              </span>
            )}
          </div>
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
        .settings-tab-btn.danger { color: var(--error); }
        .settings-tab-btn.danger:hover { background: rgba(239,68,68,0.08); }
        .settings-tab-btn.danger.active { border-bottom-color: var(--error); }
        div:hover > .avatar-overlay { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
