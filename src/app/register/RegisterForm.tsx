'use client'

import { useState, useTransition } from 'react'
import { register } from '@/lib/actions/auth'
import { useT } from '@/contexts/LanguageContext'

export default function RegisterForm({ inviteToken }: { inviteToken?: string }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { t } = useT()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await register(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rf-form">
      {inviteToken && <input type="hidden" name="inviteToken" value={inviteToken} />}
      {error && (
        <div className="rf-error">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      <div className="rf-field">
        <label className="rf-label" htmlFor="rf-name">{t('auth.fullName')}</label>
        <div className="rf-input-wrap">
          <svg className="rf-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <input id="rf-name" className="rf-input" type="text" name="name" placeholder={t('auth.fullNamePlaceholder')} required autoComplete="name" autoFocus />
        </div>
      </div>

      <div className="rf-field">
        <label className="rf-label" htmlFor="rf-email">{t('auth.workEmail')}</label>
        <div className="rf-input-wrap">
          <svg className="rf-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
          <input id="rf-email" className="rf-input" type="email" name="email" placeholder={t('auth.workEmailPlaceholder')} required autoComplete="email" />
        </div>
      </div>

      <div className="rf-field">
        <label className="rf-label" htmlFor="rf-password">{t('auth.password')}</label>
        <div className="rf-input-wrap">
          <svg className="rf-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <input id="rf-password" className="rf-input" type="password" name="password" placeholder={t('auth.passwordMinPlaceholder')} required autoComplete="new-password" />
        </div>
      </div>

      <button type="submit" className="rf-btn" disabled={isPending}>
        {isPending ? (
          <><span className="rf-spinner" /> {t('auth.creatingAccount')}</>
        ) : (
          <>
            {t('auth.createAccount')}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </>
        )}
        <span className="rf-btn-shine" />
      </button>

      <p className="rf-terms">{t('auth.terms')}</p>

      <style>{`
        .rf-form { display:flex; flex-direction:column; gap:16px; }
        .rf-error { display:flex; align-items:center; gap:8px; padding:10px 13px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); border-radius:10px; color:#fca5a5; font-size:13px; animation:shakeErr 0.3s ease; }
        @keyframes shakeErr { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
        .rf-field { display:flex; flex-direction:column; gap:6px; }
        .rf-label { font-size:11px; font-weight:700; color:rgba(255,255,255,0.28); letter-spacing:0.9px; text-transform:uppercase; }
        .rf-input-wrap { position:relative; }
        .rf-icon { position:absolute; left:13px; top:50%; transform:translateY(-50%); color:rgba(255,255,255,0.18); pointer-events:none; transition:color 150ms; }
        .rf-input-wrap:focus-within .rf-icon { color:#a78bfa; }
        .rf-input { width:100%; padding:11px 14px 11px 40px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:10px; color:rgba(255,255,255,0.9); font-size:14px; font-family:inherit; outline:none; transition:border-color 150ms,background 150ms,box-shadow 150ms; }
        .rf-input::placeholder { color:rgba(255,255,255,0.15); }
        .rf-input:hover { border-color:rgba(255,255,255,0.11); }
        .rf-input:focus { background:rgba(139,92,246,0.05); border-color:rgba(139,92,246,0.5); box-shadow:0 0 0 3px rgba(139,92,246,0.1); }
        .rf-btn { margin-top:4px; width:100%; padding:13px 20px; background:linear-gradient(135deg,#7c3aed 0%,#6366f1 100%); color:#fff; font-size:14px; font-weight:700; font-family:inherit; border:none; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; position:relative; overflow:hidden; transition:transform 150ms,box-shadow 150ms,filter 150ms; box-shadow:0 2px 16px rgba(124,58,237,0.4),inset 0 1px 0 rgba(255,255,255,0.12); }
        .rf-btn:hover:not(:disabled) { transform:translateY(-1px); filter:brightness(1.1); box-shadow:0 6px 28px rgba(124,58,237,0.55),inset 0 1px 0 rgba(255,255,255,0.12); }
        .rf-btn:active:not(:disabled) { transform:translateY(0); filter:brightness(1); }
        .rf-btn:disabled { opacity:0.45; cursor:not-allowed; }
        .rf-btn-shine { position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent); transform:skewX(-15deg); animation:shine 3s ease-in-out infinite; }
        @keyframes shine { 0%,60%{left:-100%} 80%,100%{left:160%} }
        .rf-spinner { width:14px; height:14px; border:2px solid rgba(255,255,255,0.2); border-top-color:#fff; border-radius:50%; animation:spin 0.7s linear infinite; }
        .rf-terms { font-size:11.5px; color:rgba(255,255,255,0.2); text-align:center; line-height:1.5; }
      `}</style>
    </form>
  )
}
