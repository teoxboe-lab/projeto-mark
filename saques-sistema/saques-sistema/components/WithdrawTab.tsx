'use client'
// components/WithdrawTab.tsx
// Aba de Saques para vendedores — integração Stripe Connect

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface StripeStatus {
  connected: boolean
  onboarding_done: boolean
  charges_enabled?: boolean
  payouts_enabled?: boolean
}

interface Withdrawal {
  id: string
  amount: number
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled'
  requested_at: string
  paid_at?: string
  failure_reason?: string
}

interface WithdrawTabProps {
  userId: string
  userEmail: string
  userName: string
  balanceAvailable: number
  balancePending: number
  totalEarned: number
  onBalanceUpdate: () => void
}

const STATUS_CONFIG = {
  pending:    { label: 'Aguardando',   bg: '#FFFBEB', color: '#D97706', icon: '⏳' },
  processing: { label: 'Processando',  bg: '#EFF6FF', color: '#2563EB', icon: '🔄' },
  paid:       { label: 'Pago',         bg: '#ECFDF5', color: '#059669', icon: '✅' },
  failed:     { label: 'Falhou',       bg: '#FEF2F2', color: '#DC2626', icon: '❌' },
  cancelled:  { label: 'Cancelado',    bg: '#F9FAFB', color: '#6B7280', icon: '🚫' },
}

export default function WithdrawTab({
  userId, userEmail, userName,
  balanceAvailable, balancePending, totalEarned,
  onBalanceUpdate
}: WithdrawTabProps) {
  const router = useRouter()
  const [stripeStatus, setStripeStatus]   = useState<StripeStatus | null>(null)
  const [withdrawals, setWithdrawals]     = useState<Withdrawal[]>([])
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [loading, setLoading]             = useState(false)
  const [loadingOnboard, setLoadingOnboard] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [toast, setToast]                 = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Carrega status Stripe e histórico
  const loadAll = useCallback(async () => {
    setLoadingHistory(true)
    const [stripeRes, histRes] = await Promise.all([
      fetch(`/api/stripe/connect?userId=${userId}`),
      fetch(`/api/withdrawals?userId=${userId}`)
    ])
    const stripeData = await stripeRes.json()
    const histData   = await histRes.json()
    setStripeStatus(stripeData)
    setWithdrawals(histData.withdrawals || [])
    setLoadingHistory(false)
  }, [userId])

  useEffect(() => { loadAll() }, [loadAll])

  // Verifica retorno do Stripe onboarding
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('stripe') === 'success') {
      loadAll()
      showToast('Conta Stripe conectada com sucesso! ✅')
      router.replace('/dashboard')
    }
    if (params.get('stripe') === 'refresh') {
      showToast('Onboarding expirou. Tente novamente.', 'error')
      router.replace('/dashboard')
    }
  }, [])

  // Inicia onboarding Stripe Connect
  const handleConnectStripe = async () => {
    setLoadingOnboard(true)
    try {
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email: userEmail, nome: userName }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err: any) {
      showToast(err.message || 'Erro ao conectar Stripe', 'error')
      setLoadingOnboard(false)
    }
  }

  // Solicita saque
  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount.replace(',', '.'))
    if (!amount || amount < 10) {
      showToast('Valor mínimo de saque é R$ 10,00', 'error')
      return
    }
    if (amount > balanceAvailable) {
      showToast('Saldo insuficiente', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setWithdrawAmount('')
      showToast(`Saque de R$ ${amount.toFixed(2).replace('.', ',')} solicitado! 🎉`)
      loadAll()
      onBalanceUpdate()
    } catch (err: any) {
      showToast(err.message || 'Erro ao solicitar saque', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fmt = (v: number) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999,
          background: toast.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          color: toast.type === 'success' ? '#065F46' : '#991B1B',
          border: `1px solid ${toast.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
          borderRadius: 12, padding: '14px 20px', fontSize: 14, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,.12)', maxWidth: 360,
          animation: 'fadeInRight .2s ease',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Cards de saldo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {[
          { label: 'Disponível para Saque', value: fmt(balanceAvailable), color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', icon: '💰' },
          { label: 'Pendente (em processamento)', value: fmt(balancePending), color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: '⏳' },
          { label: 'Total Recebido', value: fmt(totalEarned), color: 'var(--blue)', bg: '#EFF6FF', border: '#BFDBFE', icon: '📈' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 'var(--r)', padding: '18px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.color, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
              {c.icon} {c.label}
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.03em', color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Stripe Connect status */}
      {stripeStatus && !stripeStatus.onboarding_done && (
        <div style={{
          background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
          borderRadius: 'var(--r)', padding: '24px 28px',
          color: '#fff', display: 'flex', alignItems: 'center', gap: 20,
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
              💳 Configure sua conta de recebimento
            </div>
            <div style={{ fontSize: 13, opacity: .85, lineHeight: 1.5 }}>
              Para receber saques, você precisa conectar sua conta bancária via Stripe.
              É rápido, seguro e gratuito.
            </div>
          </div>
          <button
            onClick={handleConnectStripe}
            disabled={loadingOnboard}
            style={{
              background: '#fff', color: '#7C3AED', border: 'none',
              borderRadius: 'var(--r-full)', padding: '12px 24px',
              fontSize: 14, fontWeight: 800, cursor: loadingOnboard ? 'wait' : 'pointer',
              flexShrink: 0, opacity: loadingOnboard ? .7 : 1,
              transition: 'all .15s',
            }}>
            {loadingOnboard ? 'Redirecionando...' : '⚡ Conectar Stripe'}
          </button>
        </div>
      )}

      {stripeStatus?.onboarding_done && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 'var(--r)', padding: '12px 16px' }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#065F46' }}>
            Conta Stripe conectada e verificada — saques habilitados
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: '#6B7280' }}>
            {stripeStatus.payouts_enabled ? 'Payouts ativos' : 'Payouts pendentes'}
          </div>
        </div>
      )}

      {/* Formulário de saque */}
      {stripeStatus?.onboarding_done && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '24px 28px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>💸 Solicitar Saque</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
            Mínimo R$ 10,00 · Processamento em até 2 dias úteis
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                Valor (R$)
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 700, color: 'var(--text-3)' }}>R$</span>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  placeholder="0,00"
                  min="10"
                  max={balanceAvailable}
                  step="0.01"
                  style={{
                    width: '100%', padding: '12px 14px 12px 36px',
                    border: '2px solid var(--border)', borderRadius: 'var(--r)',
                    fontSize: 16, fontWeight: 700, background: 'var(--surface)',
                    outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color .15s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            </div>

            {/* Atalhos rápidos */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[25, 50, 100].map(pct => {
                const val = Math.floor(balanceAvailable * pct / 100 * 100) / 100
                if (val < 10) return null
                return (
                  <button key={pct}
                    onClick={() => setWithdrawAmount(val.toFixed(2))}
                    style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', cursor: 'pointer', color: 'var(--text-3)' }}>
                    {pct}%
                  </button>
                )
              })}
              <button
                onClick={() => setWithdrawAmount(balanceAvailable.toFixed(2))}
                style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, background: 'var(--blue-light)', border: '1px solid var(--blue)', borderRadius: 'var(--r)', cursor: 'pointer', color: 'var(--blue)' }}>
                Tudo
              </button>
            </div>

            <button
              onClick={handleWithdraw}
              disabled={loading || !withdrawAmount || parseFloat(withdrawAmount) < 10}
              style={{
                background: loading ? '#94a3b8' : 'var(--blue)',
                color: '#fff', border: 'none', borderRadius: 'var(--r-full)',
                padding: '13px 28px', fontSize: 14, fontWeight: 800,
                cursor: loading ? 'wait' : 'pointer',
                opacity: !withdrawAmount || parseFloat(withdrawAmount) < 10 ? .6 : 1,
                transition: 'all .15s', whiteSpace: 'nowrap',
              }}>
              {loading ? '⏳ Processando...' : '💸 Sacar agora'}
            </button>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>✓ Disponível: <strong>{fmt(balanceAvailable)}</strong></span>
            <span>✓ Taxa da plataforma já descontada das vendas</span>
            <span>✓ Transferência direta para sua conta bancária</span>
          </div>
        </div>
      )}

      {/* Histórico de saques */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>📋 Histórico de Saques</div>
          <button onClick={loadAll} style={{ fontSize: 12, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            ↺ Atualizar
          </button>
        </div>

        {loadingHistory ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            Carregando...
          </div>
        ) : withdrawals.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Nenhum saque ainda</div>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Seus saques aparecerão aqui</p>
          </div>
        ) : (
          <div>
            {withdrawals.map((w, i) => {
              const cfg = STATUS_CONFIG[w.status]
              return (
                <div key={w.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 20px',
                  borderBottom: i < withdrawals.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background .1s',
                }}>
                  <div style={{ fontSize: 24 }}>{cfg.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      {fmt(w.amount)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      Solicitado em {new Date(w.requested_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {w.paid_at && ` · Pago em ${new Date(w.paid_at).toLocaleDateString('pt-BR')}`}
                    </div>
                    {w.failure_reason && (
                      <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>
                        ⚠️ {w.failure_reason}
                      </div>
                    )}
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 700, padding: '4px 12px',
                    borderRadius: 'var(--r-full)',
                    background: cfg.bg, color: cfg.color,
                  }}>
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
