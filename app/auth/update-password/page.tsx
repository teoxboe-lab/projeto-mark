'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  const doUpdate = async () => {
    setErr(''); setOk('')
    if (password.length < 6) { setErr('Senha mínima de 6 caracteres.'); return }
    if (password !== confirm) { setErr('As senhas não coincidem.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setErr(error.message); setLoading(false); return }
    setOk('Senha atualizada com sucesso!')
    setTimeout(() => router.push('/auth'), 2000)
    setLoading(false)
  }

  const inp: React.CSSProperties = {
    width: '100%', border: '1px solid var(--border-2)', borderRadius: 'var(--r)',
    padding: '10px 14px', fontSize: 14, fontFamily: 'Inter,sans-serif',
    outline: 'none', color: 'var(--text)', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: 420, padding: '36px 32px' }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--blue)', letterSpacing: '-.03em', fontStyle: 'italic', textAlign: 'center', marginBottom: 6 }}>GGMAX</div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Nova senha</div>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Digite sua nova senha abaixo.</p>
        </div>

        {err && <div style={{ padding: '10px 14px', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, marginBottom: 14, background: '#FEF2F2', borderLeft: '3px solid var(--red)', color: '#991B1B' }}>✗ {err}</div>}
        {ok  && <div style={{ padding: '10px 14px', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, marginBottom: 14, background: '#ECFDF5', borderLeft: '3px solid var(--green)', color: '#065F46' }}>✓ {ok}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>Nova senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>Confirmar senha</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repita a nova senha"
              onKeyDown={e => e.key === 'Enter' && doUpdate()} style={inp} />
          </div>
          <button onClick={doUpdate} disabled={loading}
            style={{ width: '100%', background: loading ? 'var(--border-2)' : 'var(--blue)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '12px 24px', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4 }}>
            {loading ? 'Salvando...' : '✅ Salvar nova senha'}
          </button>
        </div>
      </div>
    </div>
  )
}