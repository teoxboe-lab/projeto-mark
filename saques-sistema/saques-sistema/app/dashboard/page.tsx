'use client'
// app/dashboard/page.tsx — com aba de Saques para vendedores

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import ToastRoot from '@/components/ToastRoot'
import WithdrawTab from '@/components/WithdrawTab'
import type { Profile, Purchase, Listing } from '@/lib/types'

// Estende Profile com os novos campos de saldo
interface SellerProfile extends Profile {
  stripe_account_id?: string
  stripe_onboarding_done?: boolean
  balance_available?: number
  balance_pending?: number
  total_earned?: number
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<SellerProfile | null>(null)
  const [tab, setTab] = useState<'compras' | 'vendas' | 'saques'>('compras')
  const [purchases, setPurchases] = useState<(Purchase & { listings: Listing })[]>([])
  const [myListings, setMyListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async (userId: string) => {
    setLoading(true)
    const [purchasesRes, listingsRes] = await Promise.all([
      supabase.from('purchases').select('*, listings(*)').eq('buyer_id', userId).eq('status', 'completed').order('created_at', { ascending: false }),
      supabase.from('listings').select('*').eq('seller_id', userId).order('created_at', { ascending: false })
    ])
    setPurchases((purchasesRes.data || []) as any)
    setMyListings(listingsRes.data || [])
    setLoading(false)
  }, [supabase])

  // Recarrega saldo do usuário
  const reloadBalance = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('balance_available, balance_pending, total_earned')
      .eq('id', user.id)
      .single()
    if (data) setUser(prev => prev ? { ...prev, ...data } : prev)
  }, [user, supabase])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) { router.push('/auth'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single()
      if (data) {
        setUser(data)
        loadData(u.id)
      }
    })
  }, [])

  const totalGasto = purchases.reduce((s, p) => s + Number(p.amount), 0)
  const totalGratis = purchases.filter(p => p.amount == 0).length
  const isVendedor = user?.role === 'vendedor'

  const TABS = [
    ['compras', '🛒 Minhas Compras'],
    ['vendas',  '📦 Meus Anúncios'],
    ...(isVendedor ? [['saques', '💰 Saques']] : []),
  ] as const

  if (!user) return (
    <><Header /><div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 14 }}>Carregando...</div></>
  )

  return (
    <>
      <Header />
      <ToastRoot />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 64px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em' }}>Minha Conta</h1>
            <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 4 }}>Olá, {user.nome}! 👋</p>
          </div>
          {isVendedor && (
            <button onClick={() => router.push('/upload')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--blue)', color: '#fff', fontSize: 14, fontWeight: 600, padding: '9px 20px', borderRadius: 'var(--r-full)', border: 'none', cursor: 'pointer' }}>
              + Novo Anúncio
            </button>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isVendedor ? 5 : 4},1fr)`, gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Itens Comprados',  value: purchases.length,  color: 'var(--blue)' },
            { label: 'Valor Gasto',      value: `R$ ${totalGasto.toFixed(2).replace('.', ',')}`, color: 'var(--text)' },
            { label: 'Gratuitos',        value: totalGratis,        color: 'var(--green)' },
            { label: 'Meus Anúncios',   value: myListings.length,  color: 'var(--text)' },
            ...(isVendedor ? [{
              label: 'Saldo Disponível',
              value: `R$ ${Number(user.balance_available || 0).toFixed(2).replace('.', ',')}`,
              color: '#059669'
            }] : []),
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.03em', color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
          {TABS.map(([t, l]) => (
            <button key={t} onClick={() => setTab(t as any)}
              style={{
                padding: '12px 20px', fontSize: 14, fontWeight: 600,
                color: tab === t ? 'var(--blue)' : 'var(--text-3)',
                background: 'none', border: 'none',
                borderBottom: `2px solid ${tab === t ? 'var(--blue)' : 'transparent'}`,
                cursor: 'pointer', transition: 'all .15s', marginBottom: -1,
              }}>
              {l}
            </button>
          ))}
        </div>

        {/* ── Aba Compras ── */}
        {tab === 'compras' && (
          loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
              {[1,2,3].map(i => <div key={i} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', height: 200 }} />)}
            </div>
          ) : purchases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '72px 24px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>🛒</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Nenhuma compra ainda</div>
              <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 22 }}>Explore a vitrine e encontre produtos incríveis!</p>
              <button onClick={() => router.push('/vitrine')}
                style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 'var(--r-full)', padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Explorar vitrine
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
              {purchases.map(p => {
                const l = p.listings
                if (!l) return null
                return (
                  <div key={p.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ aspectRatio: '16/9', background: l.thumbnail_url ? undefined : '#EBF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, borderBottom: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                      {l.thumbnail_url ? <img src={l.thumbnail_url} alt={l.title} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} /> : <span>{l.emoji}</span>}
                      <span style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,.5)', padding: '2px 8px', borderRadius: 'var(--r-full)' }}>
                        {new Date(p.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div style={{ padding: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.02em', marginBottom: 4 }}>{l.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>Vendido por {l.seller_id?.slice(0,8)}...</div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-full)', background: p.amount > 0 ? 'var(--blue-light)' : '#ECFDF5', color: p.amount > 0 ? 'var(--blue)' : 'var(--green)' }}>
                        {p.amount > 0 ? `Pago · R$ ${Number(p.amount).toFixed(2).replace('.', ',')}` : 'Gratuito'}
                      </span>
                    </div>
                    <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 8 }}>
                      {l.html_url ? (
                        <a href={l.html_url} target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, background: 'var(--blue)', color: '#fff', borderRadius: 'var(--r)', padding: '8px 14px', fontSize: 12, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>
                          🔗 Acessar produto
                        </a>
                      ) : (
                        <button style={{ flex: 1, background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          📥 Download
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* ── Aba Vendas ── */}
        {tab === 'vendas' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <button onClick={() => router.push('/upload')}
                style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 'var(--r-full)', padding: '9px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                + Novo Anúncio
              </button>
            </div>
            {myListings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '72px 24px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
                <div style={{ fontSize: 52, marginBottom: 14 }}>📦</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Nenhum anúncio publicado</div>
                <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Crie seu primeiro anúncio agora!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myListings.map(l => (
                  <div key={l.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ width: 44, height: 44, background: 'var(--blue-light)', borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                      {l.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{l.niche} · {new Date(l.created_at).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 50 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue)', letterSpacing: '-.03em', lineHeight: 1 }}>{l.sales_count}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Vendas</div>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 70 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--blue)', lineHeight: 1 }}>
                        {l.price === 0 ? 'Grátis' : `R$ ${Number(l.price).toFixed(2).replace('.', ',')}`}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Preço</div>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--r-full)', background: l.status === 'live' ? '#ECFDF5' : '#FFFBEB', color: l.status === 'live' ? 'var(--green)' : 'var(--yellow)' }}>
                      {l.status === 'live' ? '● Publicado' : '⏸ Pausado'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Aba Saques ── */}
        {tab === 'saques' && isVendedor && (
          <WithdrawTab
            userId={user.id}
            userEmail={user.email || ''}
            userName={user.nome || ''}
            balanceAvailable={user.balance_available || 0}
            balancePending={user.balance_pending || 0}
            totalEarned={user.total_earned || 0}
            onBalanceUpdate={reloadBalance}
          />
        )}

      </div>
    </>
  )
}
