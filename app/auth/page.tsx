'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Role = 'comprador' | 'vendedor'
type Tab = 'login' | 'register' | 'reset'

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('login')
  const [role, setRole] = useState<Role>('comprador')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nome, setNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  // Pega o redirect da URL (ex: ?redirect=/admin)
  const redirectTo = searchParams.get('redirect') || null

  // Se vier da aba register via query
  useEffect(() => {
    if (searchParams.get('tab') === 'register') setTab('register')
  }, [])

  const doLogin = async () => {
    setErr(''); setOk(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setErr(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message)
      setLoading(false); return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Se veio com redirect (ex: /admin), vai direto
      if (redirectTo) { router.push(redirectTo); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      router.push(profile?.role === 'vendedor' ? '/upload' : '/vitrine')
    }
  }

  const doRegister = async () => {
    setErr(''); setOk(''); setLoading(true)
    if (!nome.trim()) { setErr('Informe seu nome.'); setLoading(false); return }
    if (password.length < 6) { setErr('Senha mínima de 6 caracteres.'); setLoading(false); return }
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { nome: nome.trim(), role } }
    })
    if (error) { setErr(error.message); setLoading(false); return }
    setOk('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
    setLoading(false)
  }

  const doReset = async () => {
    setErr(''); setOk(''); setLoading(true)
    if (!email.trim()) { setErr('Informe seu e-mail.'); setLoading(false); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    })
    if (error) { setErr(error.message); setLoading(false); return }
    setOk('E-mail enviado! Verifique sua caixa de entrada para redefinir a senha.')
    setLoading(false)
  }

  const inp: React.CSSProperties = {
    width: '100%', border: '1px solid var(--border-2)', borderRadius: 'var(--r)',
    padding: '10px 14px', fontSize: 14, fontFamily: 'Inter,sans-serif',
    outline: 'none', color: 'var(--text)', boxSizing: 'border-box',
  }
  const btn = (disabled?: boolean): React.CSSProperties => ({
    width: '100%', background: disabled ? 'var(--border-2)' : 'var(--blue)',
    color: '#fff', border: 'none', borderRadius: 'var(--r)',
    padding: '12px 24px', fontSize: 15, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer', marginTop: 4,
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: 420, padding: '36px 32px' }}>

        {/* Logo */}
        <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--blue)', letterSpacing: '-.03em', fontStyle: 'italic', textAlign: 'center', marginBottom: 6 }}>GGMAX</div>
        <p style={{ fontSize: 14, color: 'var(--text-3)', textAlign: 'center', marginBottom: 28 }}>O marketplace de itens digitais do Brasil</p>

        {/* Tabs — não mostra na tela de reset */}
        {tab !== 'reset' && (
          <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 'var(--r)', padding: 4, marginBottom: 24 }}>
            {(['login', 'register'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setErr(''); setOk('') }}
                style={{ flex: 1, padding: 8, textAlign: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 6, border: 'none', transition: 'all .15s',
                  background: tab === t ? '#fff' : 'none', color: tab === t ? 'var(--blue)' : 'var(--text-3)',
                  boxShadow: tab === t ? 'var(--shadow-sm)' : 'none' }}>
                {t === 'login' ? 'Entrar' : 'Criar Conta'}
              </button>
            ))}
          </div>
        )}

        {/* Alerts */}
        {err && <div style={{ padding: '10px 14px', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, marginBottom: 14, background: '#FEF2F2', borderLeft: '3px solid var(--red)', color: '#991B1B' }}>✗ {err}</div>}
        {ok  && <div style={{ padding: '10px 14px', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, marginBottom: 14, background: '#ECFDF5', borderLeft: '3px solid var(--green)', color: '#065F46' }}>✓ {ok}</div>}

        {/* ── LOGIN ── */}
        {tab === 'login' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" style={inp} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Senha</label>
                <button onClick={() => { setTab('reset'); setErr(''); setOk('') }}
                  style={{ fontSize: 12, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  Esqueci a senha
                </button>
              </div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && doLogin()} style={inp} />
            </div>
            <button onClick={doLogin} disabled={loading} style={btn(loading)}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />ou acesse como<div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={async () => {
                await supabase.auth.signInWithPassword({ email: 'comprador@demo.com', password: 'demo123' })
                router.push('/vitrine')
              }} style={{ background: '#fff', border: '1px solid var(--border-2)', color: 'var(--text-2)', borderRadius: 'var(--r)', padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                🛒 Demo Comprador
              </button>
              <button onClick={async () => {
                await supabase.auth.signInWithPassword({ email: 'vendedor@demo.com', password: 'demo123' })
                router.push('/upload')
              }} style={{ background: '#fff', border: '1px solid var(--border-2)', color: 'var(--text-2)', borderRadius: 'var(--r)', padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                🏪 Demo Vendedor
              </button>
            </div>
          </div>
        )}

        {/* ── REGISTER ── */}
        {tab === 'register' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>Você é:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(['comprador', 'vendedor'] as const).map(r => (
                  <button key={r} onClick={() => setRole(r)}
                    style={{ border: `2px solid ${role === r ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 'var(--r)', padding: '14px 10px', textAlign: 'center', cursor: 'pointer', background: role === r ? 'var(--blue-light)' : '#fff', transition: 'all .15s' }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{r === 'comprador' ? '🛒' : '🏪'}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>{r}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{r === 'comprador' ? 'Quero comprar' : 'Quero vender'}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>Nome completo</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>Senha <span style={{ color: 'var(--red)' }}>*</span></label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={inp} />
            </div>
            <button onClick={doRegister} disabled={loading} style={btn(loading)}>
              {loading ? 'Criando conta...' : 'Criar Conta Grátis'}
            </button>
          </div>
        )}

        {/* ── RESET SENHA ── */}
        {tab === 'reset' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔑</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Redefinir senha</div>
              <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
                Digite seu e-mail e enviaremos um link para redefinir sua senha.
              </p>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"
                onKeyDown={e => e.key === 'Enter' && doReset()} style={inp} />
            </div>
            <button onClick={doReset} disabled={loading} style={btn(loading)}>
              {loading ? 'Enviando...' : '📧 Enviar link de redefinição'}
            </button>
            <button onClick={() => { setTab('login'); setErr(''); setOk('') }}
              style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center', marginTop: 4 }}>
              ← Voltar ao login
            </button>
          </div>
        )}

      </div>
    </div>
  )
}