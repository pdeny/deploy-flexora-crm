'use client'

import { useState, useTransition } from 'react'
import { updateWorkspace, inviteMember, removeMember, updateMemberRole, deleteWorkspace, setWorkspaceNotifications } from '@/lib/actions/settings'
import { useT } from '@/contexts/LanguageContext'

type MemberRow = {
  id: string
  role: string
  user: { id: string; name: string | null; email: string }
}

type WorkspaceSnap = {
  id: string
  name: string
  description: string | null
  iconEmoji: string
  color: string
}

type Props = {
  workspace: WorkspaceSnap
  members: MemberRow[]
  currentUserId: string
  currentUserRole: string
  currentUserNotificationsEnabled: boolean
}

const EMOJI_OPTIONS = ['🏢','🏠','🚀','💡','🎯','🔥','⭐','🌍','🎨','🛠','📊','💼','🤝','🎓','🌱']
const COLOR_OPTIONS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f59e0b','#10b981','#06b6d4','#3b82f6']

type Tab = 'general' | 'members' | 'danger'

export default function WorkspaceSettings({ workspace, members, currentUserId, currentUserRole, currentUserNotificationsEnabled }: Props) {
  const [tab, setTab] = useState<Tab>('general')

  // Notification preference
  const [notifEnabled, setNotifEnabled] = useState(currentUserNotificationsEnabled)
  const [isTogglingNotif, startToggleNotif] = useTransition()

  function handleNotifToggle(checked: boolean) {
    setNotifEnabled(checked)
    startToggleNotif(async () => {
      await setWorkspaceNotifications(workspace.id, checked)
    })
  }

  // General tab state
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description ?? '')
  const [emoji, setEmoji] = useState(workspace.iconEmoji)
  const [color, setColor] = useState(workspace.color)
  const [generalError, setGeneralError] = useState('')
  const [generalSuccess, setGeneralSuccess] = useState(false)
  const [isSavingGeneral, startSaveGeneral] = useTransition()

  // Members tab state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [isInviting, startInvite] = useTransition()
  const [memberAction, startMemberAction] = useTransition()

  // Danger zone
  const [confirmName, setConfirmName] = useState('')
  const [isDeleting, startDelete] = useTransition()
  const [deleteError, setDeleteError] = useState('')

  const isOwner = currentUserRole === 'owner'
  const { t } = useT()

  function saveGeneral() {
    setGeneralError('')
    setGeneralSuccess(false)
    startSaveGeneral(async () => {
      const result = await updateWorkspace(workspace.id, { name, description, iconEmoji: emoji, color })
      if (result?.error) setGeneralError(result.error)
      else setGeneralSuccess(true)
    })
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    setInviteSuccess(false)
    if (!inviteEmail.trim()) return
    startInvite(async () => {
      const result = await inviteMember(workspace.id, inviteEmail)
      if (result?.error) setInviteError(result.error)
      else { setInviteSuccess(true); setInviteEmail('') }
    })
  }

  function handleRemove(userId: string) {
    startMemberAction(async () => {
      await removeMember(workspace.id, userId)
    })
  }

  function handleRoleChange(userId: string, role: string) {
    startMemberAction(async () => {
      await updateMemberRole(workspace.id, userId, role)
    })
  }

  function handleDelete() {
    if (confirmName !== workspace.name) return
    setDeleteError('')
    startDelete(async () => {
      const result = await deleteWorkspace(workspace.id)
      if (result?.error) setDeleteError(result.error)
    })
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Tab bar */}
      <div className="settings-tab-bar">
        {([
          { id: 'general', label: t('wsSettings.general') },
          { id: 'members', label: t('wsSettings.membersTab', { n: members.length }) },
          { id: 'danger',  label: t('wsSettings.danger') },
        ] as { id: Tab; label: string }[]).map(tab_ => (
          <button
            key={tab_.id}
            className={`settings-tab-btn${tab === tab_.id ? ' active' : ''}${tab_.id === 'danger' ? ' danger' : ''}`}
            onClick={() => setTab(tab_.id)}
          >
            {tab_.label}
          </button>
        ))}
      </div>

      {/* ── My Preferences (always visible) ── */}
      <div className="settings-panel" style={{ marginBottom: 16 }}>
        <div className="settings-section" style={{ paddingBottom: 0 }}>
          <h2 className="settings-section-title">{t('wsSettings.myPreferences')}</h2>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {t('wsSettings.notifToggleLabel')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {t('wsSettings.notifToggleHint')}
              </div>
            </div>
            <div
              onClick={() => handleNotifToggle(!notifEnabled)}
              style={{
                width: 40, height: 22, borderRadius: 11, flexShrink: 0,
                background: notifEnabled ? 'var(--brand-500)' : 'var(--border-default)',
                position: 'relative',
                transition: 'background 200ms',
                opacity: isTogglingNotif ? 0.6 : 1,
                cursor: 'pointer',
              }}
            >
              <div style={{
                position: 'absolute',
                top: 3, left: notifEnabled ? 21 : 3,
                width: 16, height: 16, borderRadius: '50%',
                background: '#fff',
                transition: 'left 200ms',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
          </label>
        </div>
      </div>

      {/* ── General ── */}
      {tab === 'general' && (
        <div className="settings-panel">
          <div className="settings-section">
            <h2 className="settings-section-title">{t('wsSettings.workspaceInfo')}</h2>

            <div className="form-group">
              <label className="form-label">{t('common.icon')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {EMOJI_OPTIONS.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    style={{
                      width: 38, height: 38, fontSize: 20, borderRadius: 10, border: 'none',
                      background: emoji === e ? 'rgba(99,102,241,0.2)' : 'var(--bg-overlay)',
                      cursor: 'pointer',
                      outline: emoji === e ? '2px solid var(--brand-500)' : 'none',
                      transition: 'all var(--transition-fast)',
                    }}
                  >{e}</button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('common.name')} <span style={{ color: 'var(--error)' }}>*</span></label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder={t('wsSettings.namePlaceholder')} />
            </div>

            <div className="form-group">
              <label className="form-label">{t('common.description')}</label>
              <textarea className="form-input form-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder={t('wsSettings.descPlaceholder')} rows={3} />
            </div>

            <div className="form-group">
              <label className="form-label">{t('common.color')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', border: 'none',
                      background: c, cursor: 'pointer',
                      outline: color === c ? `3px solid ${c}` : 'none',
                      outlineOffset: 2,
                      transition: 'all var(--transition-fast)',
                    }}
                  />
                ))}
              </div>
            </div>

            {generalError && <p className="form-error">{generalError}</p>}
            {generalSuccess && <p style={{ fontSize: 12, color: 'var(--success)' }}>{t('wsSettings.savedOk')}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={saveGeneral} disabled={isSavingGeneral || !isOwner}>
                {isSavingGeneral ? <><span className="spinner" style={{ width: 13, height: 13 }} /> {t('wsSettings.saving')}</> : t('wsSettings.saveChanges')}
              </button>
            </div>

            {!isOwner && <p style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 8 }}>{t('wsSettings.ownerOnly')}</p>}
          </div>
        </div>
      )}

      {/* ── Members ── */}
      {tab === 'members' && (
        <div className="settings-panel">
          {isOwner && (
            <div className="settings-section">
              <h2 className="settings-section-title">{t('wsSettings.inviteMember')}</h2>
              <form onSubmit={handleInvite} style={{ display: 'flex', gap: 10 }}>
                <input
                  className="form-input"
                  style={{ flex: 1 }}
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder={t('wsSettings.invitePlaceholder')}
                />
                <button type="submit" className="btn btn-primary" disabled={isInviting || !inviteEmail.trim()}>
                  {isInviting ? <><span className="spinner" style={{ width: 13, height: 13 }} /> {t('wsSettings.inviting')}</> : t('wsSettings.invite')}
                </button>
              </form>
              {inviteError && <p className="form-error" style={{ marginTop: 8 }}>{inviteError}</p>}
              {inviteSuccess && <p style={{ fontSize: 12, color: 'var(--success)', marginTop: 8 }}>{t('wsSettings.memberAdded')}</p>}
            </div>
          )}

          <div className="settings-section">
            <h2 className="settings-section-title">{t('wsSettings.currentMembers')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.map(m => (
                <div key={m.id} className="member-row">
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--brand-600), var(--accent-violet))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, color: '#fff',
                  }}>
                    {(m.user.name ?? m.user.email)[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m.user.name ?? m.user.email}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m.user.email}</div>
                  </div>
                  {isOwner && m.user.id !== currentUserId ? (
                    <select
                      className="form-input form-select"
                      style={{ width: 'auto', padding: '4px 28px 4px 8px', fontSize: 12 }}
                      value={m.role}
                      onChange={e => handleRoleChange(m.user.id, e.target.value)}
                      disabled={memberAction !== undefined && false}
                    >
                      <option value="member">{t('wsSettings.roleMember')}</option>
                      <option value="admin">{t('wsSettings.roleAdmin')}</option>
                    </select>
                  ) : (
                    <span style={{
                      padding: '3px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 700,
                      background: m.role === 'owner' ? 'rgba(99,102,241,0.15)' : 'var(--bg-overlay)',
                      color: m.role === 'owner' ? 'var(--brand-300)' : 'var(--text-secondary)',
                      border: m.role === 'owner' ? '1px solid rgba(99,102,241,0.2)' : undefined,
                      textTransform: 'capitalize',
                    }}>{m.role}</span>
                  )}
                  {isOwner && m.user.id !== currentUserId && m.role !== 'owner' && (
                    <button
                      className="btn btn-ghost btn-sm btn-icon"
                      onClick={() => handleRemove(m.user.id)}
                      title={t('wsSettings.removeMember')}
                      style={{ color: 'var(--error)', opacity: 0.7 }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <line x1="17" y1="8" x2="23" y2="8"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Danger Zone ── */}
      {tab === 'danger' && (
        <div className="settings-panel">
          <div className="settings-section danger-zone">
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--error)', marginBottom: 8 }}>{t('wsSettings.deleteWs')}</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              {t('wsSettings.deleteWsDesc', { name: workspace.name })}
            </p>

            {isOwner ? (
              <>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">{t('wsSettings.confirmType', { name: workspace.name })}</label>
                  <input
                    className="form-input"
                    value={confirmName}
                    onChange={e => setConfirmName(e.target.value)}
                    placeholder={workspace.name}
                    style={{ borderColor: confirmName && confirmName !== workspace.name ? 'var(--error)' : undefined }}
                  />
                </div>
                {deleteError && <p className="form-error" style={{ marginBottom: 12 }}>{deleteError}</p>}
                <button
                  className="btn btn-danger"
                  onClick={handleDelete}
                  disabled={isDeleting || confirmName !== workspace.name}
                >
                  {isDeleting ? <><span className="spinner" style={{ width: 13, height: 13 }} /> {t('wsSettings.deleting')}</> : t('wsSettings.deleteWs')}
                </button>
              </>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-disabled)' }}>{t('wsSettings.ownerOnlyDelete')}</p>
            )}
          </div>
        </div>
      )}

      <style>{`
        .settings-tab-bar {
          display: flex;
          gap: 2px;
          border-bottom: 1px solid var(--border-subtle);
          margin-bottom: 28px;
        }
        .settings-tab-btn {
          padding: 10px 18px;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all var(--transition-fast);
          margin-bottom: -1px;
        }
        .settings-tab-btn:hover { color: var(--text-primary); }
        .settings-tab-btn.active {
          color: var(--brand-400);
          border-bottom-color: var(--brand-500);
        }
        .settings-tab-btn.danger:hover { color: var(--error); }
        .settings-tab-btn.danger.active {
          color: var(--error);
          border-bottom-color: var(--error);
        }
        .settings-panel {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .settings-section {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 22px 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .settings-section-title {
          font-size: 14px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.2px;
        }
        .danger-zone {
          border-color: rgba(239,68,68,0.2);
          background: rgba(239,68,68,0.03);
        }
        .member-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          transition: border-color var(--transition-fast);
        }
        .member-row:hover { border-color: var(--border-default); }
      `}</style>
    </div>
  )
}
