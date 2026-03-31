import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LoginForm from './LoginForm'
import Link from 'next/link'

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')

  return (
    <div className="auth-root">
      {/* Atmospheric background */}
      <div className="auth-bg">
        <div className="beam beam-1" />
        <div className="beam beam-2" />
        <div className="beam beam-3" />
        <div className="noise-layer" />
        <div className="grid-layer" />
      </div>

      {/* Left decorative panel */}
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-brand-mark">
            <div className="brand-hexagon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z" stroke="white" strokeWidth="1.5" fill="none"/>
                <path d="M12 7l4.5 2.5v5L12 17l-4.5-2.5v-5L12 7z" fill="white" opacity="0.8"/>
              </svg>
            </div>
            <span className="brand-name">Flexora</span>
          </div>

          <div className="auth-hero-text">
            <div className="hero-label">WORK MANAGEMENT</div>
            <h1 className="hero-headline">
              Build your<br />
              <span className="hero-accent">ideal workflow.</span>
            </h1>
            <p className="hero-sub">
              Apps, automations, and collaboration — all in one space designed around how your team actually works.
            </p>
          </div>

          <div className="auth-feature-list">
            {['Custom data apps in minutes', 'Real-time team collaboration', 'Powerful automation engine'].map((f, i) => (
              <div key={i} className="auth-feature" style={{ animationDelay: `${0.6 + i * 0.1}s` }}>
                <div className="feature-dot" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="auth-right">
        <div className="auth-form-container">
          <div className="auth-form-header">
            <p className="form-eyebrow">SIGN IN</p>
            <h2 className="form-title">Welcome back</h2>
            <p className="form-subtitle">Enter your credentials to access your workspace</p>
          </div>
          <LoginForm />
          <p className="auth-switch-link">
            No account?{' '}
            <Link href="/register">Create one free →</Link>
          </p>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap');

        .auth-root {
          min-height: 100vh;
          display: flex;
          background: #05050a;
          overflow: hidden;
          position: relative;
        }

        /* ── Background ── */
        .auth-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .beam {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.12;
          animation: driftBeam 12s ease-in-out infinite alternate;
        }
        .beam-1 {
          width: 640px; height: 640px;
          background: radial-gradient(circle, #6366f1 0%, transparent 70%);
          top: -200px; left: -100px;
          animation-delay: 0s;
        }
        .beam-2 {
          width: 480px; height: 480px;
          background: radial-gradient(circle, #8b5cf6 0%, transparent 70%);
          bottom: -100px; right: -80px;
          animation-delay: -4s;
        }
        .beam-3 {
          width: 320px; height: 320px;
          background: radial-gradient(circle, #06b6d4 0%, transparent 70%);
          top: 40%; left: 45%;
          opacity: 0.07;
          animation-delay: -7s;
        }
        .noise-layer {
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
          background-size: 160px;
          opacity: 0.4;
        }
        .grid-layer {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        @keyframes driftBeam {
          from { transform: translate(0,0) scale(1); }
          to   { transform: translate(30px, 20px) scale(1.08); }
        }

        /* ── Left panel ── */
        .auth-left {
          flex: 1;
          display: flex;
          align-items: center;
          padding: 60px 64px;
          position: relative;
          z-index: 1;
          border-right: 1px solid rgba(99,102,241,0.08);
        }
        .auth-left-content {
          max-width: 420px;
          display: flex;
          flex-direction: column;
          gap: 48px;
          animation: revealLeft 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes revealLeft {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .auth-brand-mark {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .brand-hexagon {
          width: 42px; height: 42px;
          background: linear-gradient(135deg, #4f46e5, #8b5cf6);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 32px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.15);
          animation: glowPulse 3s ease-in-out infinite;
        }
        @keyframes glowPulse {
          0%,100% { box-shadow: 0 0 24px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.15); }
          50%      { box-shadow: 0 0 48px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.15); }
        }
        .brand-name {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 800;
          background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.4px;
        }

        .hero-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          font-weight: 500;
          color: #6366f1;
          letter-spacing: 3px;
          margin-bottom: 16px;
        }
        .hero-headline {
          font-family: 'Syne', sans-serif;
          font-size: clamp(36px, 4vw, 52px);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -1.5px;
          color: rgba(255,255,255,0.95);
          margin-bottom: 20px;
        }
        .hero-accent {
          background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-sub {
          font-size: 14.5px;
          color: rgba(255,255,255,0.45);
          line-height: 1.65;
          max-width: 340px;
        }

        .auth-feature-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .auth-feature {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13.5px;
          color: rgba(255,255,255,0.55);
          animation: fadeInUp 0.5s ease both;
        }
        .feature-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          flex-shrink: 0;
          box-shadow: 0 0 8px rgba(99,102,241,0.6);
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Right panel ── */
        .auth-right {
          width: 480px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 48px;
          position: relative;
          z-index: 1;
          background: linear-gradient(180deg, rgba(99,102,241,0.03) 0%, transparent 50%);
        }
        .auth-form-container {
          width: 100%;
          max-width: 380px;
          animation: revealRight 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
        }
        @keyframes revealRight {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .auth-form-header {
          margin-bottom: 32px;
        }
        .form-eyebrow {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          font-weight: 500;
          color: #6366f1;
          letter-spacing: 3px;
          margin-bottom: 10px;
        }
        .form-title {
          font-family: 'Syne', sans-serif;
          font-size: 28px;
          font-weight: 800;
          color: rgba(255,255,255,0.95);
          letter-spacing: -0.7px;
          line-height: 1.1;
          margin-bottom: 8px;
        }
        .form-subtitle {
          font-size: 13.5px;
          color: rgba(255,255,255,0.4);
          line-height: 1.5;
        }

        .auth-switch-link {
          margin-top: 24px;
          text-align: center;
          font-size: 13px;
          color: rgba(255,255,255,0.35);
        }
        .auth-switch-link a {
          color: #818cf8;
          text-decoration: none;
          font-weight: 600;
          transition: color 150ms;
        }
        .auth-switch-link a:hover { color: #a5b4fc; }

        @media (max-width: 900px) {
          .auth-left { display: none; }
          .auth-right { width: 100%; }
        }
      `}</style>
    </div>
  )
}
