'use client'

import { useState, useTransition } from 'react'
import { login } from '@/lib/actions/auth'
import { useT } from '@/contexts/LanguageContext'

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { t } = useT()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await login(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="lf-form">
      {error && (
        <div className="lf-error">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      <div className="lf-field">
        <label className="lf-label" htmlFor="lf-email">{t('auth.email')}</label>
        <div className="lf-input-wrap">
          <svg className="lf-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
          <input id="lf-email" className="lf-input" type="email" name="email" placeholder={t('auth.emailPlaceholder')} required autoComplete="email" />
        </div>
      </div>

      <div className="lf-field">
        <label className="lf-label" htmlFor="lf-password">{t('auth.password')}</label>
        <div className="lf-input-wrap">
          <svg className="lf-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <input id="lf-password" className="lf-input" type="password" name="password" placeholder={t('auth.passwordPlaceholder')} required autoComplete="current-password" />
        </div>
      </div>

      <button type="submit" className="lf-btn" disabled={isPending}>
        {isPending ? (
          <><span className="lf-spinner" /> {t('auth.signingIn')}</>
        ) : (
          <>
            {t('auth.signIn')}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </>
        )}
        <span className="lf-btn-shine" />
      </button>

      <style>{`
        .lf-form { display: flex; flex-direction: column; gap: 18px; }
        .lf-error {
          display: flex; align-items: center; gap: 8px;
          padding: 11px 14px;
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px; color: #fca5a5; font-size: 13px;
          animation: shakeErr 0.3s ease;
        }
        @keyframes shakeErr {
          0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)}
        }
        .lf-field { display: flex; flex-direction: column; gap: 7px; }
        .lf-label { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.32); letter-spacing: 0.9px; text-transform: uppercase; }
        .lf-input-wrap { position: relative; }
        .lf-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.2); pointer-events: none; transition: color 150ms; }
        .lf-input-wrap:focus-within .lf-icon { color: #818cf8; }
        .lf-input {
          width: 100%; padding: 12px 14px 12px 40px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; color: rgba(255,255,255,0.9); font-size: 14px; font-family: inherit;
          outline: none; transition: border-color 150ms, background 150ms, box-shadow 150ms;
        }
        .lf-input::placeholder { color: rgba(255,255,255,0.16); }
        .lf-input:hover { border-color: rgba(255,255,255,0.12); }
        .lf-input:focus {
          background: rgba(99,102,241,0.06); border-color: rgba(99,102,241,0.5);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .lf-btn {
          margin-top: 6px; width: 100%; padding: 13px 20px;
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          color: #fff; font-size: 14px; font-weight: 700; font-family: inherit;
          border: none; border-radius: 10px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          position: relative; overflow: hidden;
          transition: transform 150ms, box-shadow 150ms, filter 150ms;
          box-shadow: 0 2px 16px rgba(79,70,229,0.4), inset 0 1px 0 rgba(255,255,255,0.12);
        }
        .lf-btn:hover:not(:disabled) {
          transform: translateY(-1px); filter: brightness(1.1);
          box-shadow: 0 6px 28px rgba(79,70,229,0.55), inset 0 1px 0 rgba(255,255,255,0.12);
        }
        .lf-btn:active:not(:disabled) { transform: translateY(0); filter: brightness(1); }
        .lf-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .lf-btn-shine {
          position: absolute; top: 0; left: -100%; width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          transform: skewX(-15deg); animation: shine 3s ease-in-out infinite;
        }
        @keyframes shine { 0%,60%{left:-100%} 80%,100%{left:160%} }
        .lf-spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff;
          border-radius: 50%; animation: spin 0.7s linear infinite;
        }
      `}</style>
    </form>
  )
}
