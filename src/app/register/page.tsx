import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import RegisterForm from './RegisterForm'
import Link from 'next/link'

export default async function RegisterPage() {
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')

  return (
    <div className="auth-root">
      <div className="auth-bg">
        <div className="beam beam-1" />
        <div className="beam beam-2" />
        <div className="beam beam-3" />
        <div className="noise-layer" />
        <div className="grid-layer" />
      </div>

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
            <div className="hero-label">GET STARTED FREE</div>
            <h1 className="hero-headline">
              Your workspace,<br />
              <span className="hero-accent">your rules.</span>
            </h1>
            <p className="hero-sub">
              Join thousands of teams who build custom apps, track projects, and automate workflows — all without writing a single line of code.
            </p>
          </div>

          <div className="auth-steps">
            {[
              { n: '01', label: 'Create your account' },
              { n: '02', label: 'Set up your workspace' },
              { n: '03', label: 'Build your first app' },
            ].map((s, i) => (
              <div key={i} className="auth-step" style={{ animationDelay: `${0.5 + i * 0.1}s` }}>
                <span className="step-num">{s.n}</span>
                <span className="step-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-container">
          <div className="auth-form-header">
            <p className="form-eyebrow">CREATE ACCOUNT</p>
            <h2 className="form-title">Start for free</h2>
            <p className="form-subtitle">No credit card required. Set up in under a minute.</p>
          </div>
          <RegisterForm />
          <p className="auth-switch-link">
            Already have an account?{' '}
            <Link href="/login">Sign in →</Link>
          </p>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap');
        .auth-root { min-height:100vh; display:flex; background:#05050a; overflow:hidden; position:relative; }
        .auth-bg { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
        .beam { position:absolute; border-radius:50%; filter:blur(120px); opacity:0.12; animation:driftBeam 12s ease-in-out infinite alternate; }
        .beam-1 { width:600px; height:600px; background:radial-gradient(circle,#8b5cf6 0%,transparent 70%); top:-160px; left:-80px; animation-delay:0s; }
        .beam-2 { width:440px; height:440px; background:radial-gradient(circle,#6366f1 0%,transparent 70%); bottom:-80px; right:-60px; animation-delay:-4s; }
        .beam-3 { width:280px; height:280px; background:radial-gradient(circle,#ec4899 0%,transparent 70%); top:35%; right:35%; opacity:0.06; animation-delay:-7s; }
        .noise-layer { position:absolute; inset:0; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E"); background-size:160px; opacity:0.4; }
        .grid-layer { position:absolute; inset:0; background-image:linear-gradient(rgba(99,102,241,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.04) 1px,transparent 1px); background-size:48px 48px; }
        @keyframes driftBeam { from{transform:translate(0,0) scale(1)} to{transform:translate(25px,16px) scale(1.06)} }
        .auth-left { flex:1; display:flex; align-items:center; padding:60px 64px; position:relative; z-index:1; border-right:1px solid rgba(99,102,241,0.08); }
        .auth-left-content { max-width:420px; display:flex; flex-direction:column; gap:48px; animation:revealLeft 0.8s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes revealLeft { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:translateX(0)} }
        .auth-brand-mark { display:flex; align-items:center; gap:12px; }
        .brand-hexagon { width:42px; height:42px; background:linear-gradient(135deg,#4f46e5,#8b5cf6); border-radius:12px; display:flex; align-items:center; justify-content:center; box-shadow:0 0 32px rgba(99,102,241,0.4),inset 0 1px 0 rgba(255,255,255,0.15); animation:glowPulse 3s ease-in-out infinite; }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 24px rgba(99,102,241,0.3),inset 0 1px 0 rgba(255,255,255,0.15)} 50%{box-shadow:0 0 48px rgba(99,102,241,0.5),inset 0 1px 0 rgba(255,255,255,0.15)} }
        .brand-name { font-family:'Syne',sans-serif; font-size:22px; font-weight:800; background:linear-gradient(135deg,#fff 0%,#a5b4fc 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; letter-spacing:-0.4px; }
        .hero-label { font-family:'DM Mono',monospace; font-size:10px; font-weight:500; color:#8b5cf6; letter-spacing:3px; margin-bottom:16px; }
        .hero-headline { font-family:'Syne',sans-serif; font-size:clamp(34px,4vw,50px); font-weight:800; line-height:1.1; letter-spacing:-1.5px; color:rgba(255,255,255,0.95); margin-bottom:20px; }
        .hero-accent { background:linear-gradient(135deg,#c084fc 0%,#f472b6 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .hero-sub { font-size:14px; color:rgba(255,255,255,0.42); line-height:1.65; max-width:340px; }
        .auth-steps { display:flex; flex-direction:column; gap:14px; }
        .auth-step { display:flex; align-items:center; gap:14px; animation:fadeInUp 0.5s ease both; }
        .step-num { font-family:'DM Mono',monospace; font-size:11px; font-weight:500; color:#8b5cf6; letter-spacing:1px; min-width:24px; }
        .step-label { font-size:13.5px; color:rgba(255,255,255,0.5); }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .auth-right { width:480px; flex-shrink:0; display:flex; align-items:center; justify-content:center; padding:60px 48px; position:relative; z-index:1; background:linear-gradient(180deg,rgba(139,92,246,0.03) 0%,transparent 50%); }
        .auth-form-container { width:100%; max-width:380px; animation:revealRight 0.8s cubic-bezier(0.16,1,0.3,1) 0.15s both; }
        @keyframes revealRight { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .auth-form-header { margin-bottom:28px; }
        .form-eyebrow { font-family:'DM Mono',monospace; font-size:10px; font-weight:500; color:#8b5cf6; letter-spacing:3px; margin-bottom:10px; }
        .form-title { font-family:'Syne',sans-serif; font-size:28px; font-weight:800; color:rgba(255,255,255,0.95); letter-spacing:-0.7px; line-height:1.1; margin-bottom:8px; }
        .form-subtitle { font-size:13.5px; color:rgba(255,255,255,0.38); line-height:1.5; }
        .auth-switch-link { margin-top:22px; text-align:center; font-size:13px; color:rgba(255,255,255,0.32); }
        .auth-switch-link a { color:#a78bfa; text-decoration:none; font-weight:600; transition:color 150ms; }
        .auth-switch-link a:hover { color:#c4b5fd; }
        @media(max-width:900px){.auth-left{display:none}.auth-right{width:100%}}
      `}</style>
    </div>
  )
}
