'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, LogIn, AlertCircle, ShieldCheck, ClipboardCheck, FlaskConical } from 'lucide-react';

const PERSONAS = [
  {
    username: 'leader',
    password: 'leader123',
    name: 'Sarah Wijaya',
    role: 'QA Leader',
    icon: ShieldCheck,
    color: '#8a3ffc',
    blurb: 'Owns the QA strategy. Reviews dashboards, approves test plans, signs off releases.',
  },
  {
    username: 'qc',
    password: 'qc123',
    name: 'Budi Santoso',
    role: 'QC Analyst',
    icon: ClipboardCheck,
    color: '#0f62fe',
    blurb: 'Validates pipelines & data quality. Triages defects, audits traceability.',
  },
  {
    username: 'tester',
    password: 'test123',
    name: 'Diana Putri',
    role: 'Tester',
    icon: FlaskConical,
    color: '#198038',
    blurb: 'Generates scenarios from FSDs, runs automation, files defects.',
  },
];

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!username || !password) {
      setError('Enter username and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    // submit on next tick so state has settled
    setTimeout(() => submit(), 50);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#161616] via-[#0f1f3d] to-[#0f62fe] p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white shadow-2xl">
        {/* Left — Branding + login form */}
        <div className="p-10 flex flex-col justify-center">
          <div className="mb-8">
            <div className="text-[10px] font-medium tracking-widest text-[#0f62fe] uppercase">QAQC4BI</div>
            <h1 className="text-2xl font-light text-[#161616] mt-1">Sign in to QA/QC Platform</h1>
            <p className="text-sm text-[#525252] mt-1">
              IBM Consulting · Bank Indonesia Payment Infrastructure
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#525252] mb-1">Username</label>
              <input
                type="text"
                className="ibm-input w-full"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="leader / qc / tester"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#525252] mb-1">Password</label>
              <input
                type="password"
                className="ibm-input w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="ibm-notification ibm-notification-error flex items-center gap-2">
                <AlertCircle size={14} className="text-[#da1e28] flex-shrink-0" />
                <span className="text-xs text-[#da1e28]">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-[11px] text-[#6f6f6f] mt-6 leading-relaxed">
            Demo build. Persistent users seeded in <code className="bg-[#f4f4f4] px-1">data/users.json</code>.
            Sessions are signed cookies (HMAC-SHA256), 8-hour TTL.
          </p>
        </div>

        {/* Right — Personas / quick-login */}
        <div className="bg-[#161616] text-white p-10 flex flex-col">
          <div>
            <div className="text-[10px] font-medium tracking-widest text-[#78a9ff] uppercase">Demo personas</div>
            <h2 className="text-lg font-light mt-1">Pick a role to sign in</h2>
            <p className="text-xs text-[#a8a8a8] mt-1">
              Click any card below to auto-fill credentials and sign in instantly.
            </p>
          </div>

          <div className="space-y-3 mt-6 flex-1">
            {PERSONAS.map(p => {
              const Icon = p.icon;
              return (
                <button
                  key={p.username}
                  onClick={() => quickLogin(p.username, p.password)}
                  className="w-full text-left p-4 border border-[#393939] hover:border-[#0f62fe] bg-[#262626] hover:bg-[#1f2a44] transition-colors group"
                  disabled={loading}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                      style={{ background: p.color + '22', color: p.color }}
                    >
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{p.name}</span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: p.color + '33', color: p.color }}
                        >
                          {p.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#a8a8a8] mt-1 leading-relaxed">{p.blurb}</p>
                      <div className="text-[10px] text-[#6f6f6f] mt-2 font-mono">
                        {p.username} · {p.password}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#161616] text-white">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}
