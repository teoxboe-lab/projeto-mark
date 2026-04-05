'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Listing } from '@/lib/types'
import { showToast } from './ToastRoot'

type Props = { listing: Listing | null; onClose: () => void }

function maskCard(v: string) { return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim() }
function maskExp(v: string) { v = v.replace(/\D/g, '').slice(0, 4); return v.length > 2 ? v.slice(0, 2) + '/' + v.slice(2) : v }

export default function CheckoutModal({ listing, onClose }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'pix' | 'card'>('pix')
  const [card, setCard] = useState({ num: '', exp: '', cvv: '', name: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!listing) return null

  const isFree = listing.price === 0
  const price = Number(listing.price)

  const handlePurchase = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    // Registra compra no banco
    const { error } = await supabase.from('purchases').insert({
      buyer_id: user.id,
      listing_id: listing.id,
      amount: listing.price,
      status: 'completed'
    })

    if (error) {
      showToast('Erro ao processar compra. Tente novamente.', 'err')
      setLoading(false)
      return
    }

    // Incrementa contador de vendas
await supabase.rpc('increment_sales', { listing_id: listing.id })
    setLoading(false)
    setSuccess(true)
    showToast('🎉 Compra realizada com sucesso!', 'ok')
  }

  return (
    <div className="animate-fade-in" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
      zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="animate-slide-up" style={{
        background: '#fff', borderRadius: 12, boxShadow: 'var(--shadow-lg)',
        width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', borderRadius: '12px 12px 0 0', zIndex: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>
            {success ? '✅ Pagamento confirmado' : '💳 Finalizar compra'}
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-3)' }}>×</button>
        </div>

        <div style={{ padding: 22 }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)', marginBottom: 10 }}>Compra realizada!</h2>
              <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 22 }}>O produto foi adicionado à sua biblioteca.</p>
              <button onClick={() => { onClose(); router.push('/dashboard') }}
                style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginRight: 10 }}>
                Ver minha biblioteca
              </button>
              <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', borderRadius: 'var(--r)', padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Fechar</button>
            </div>
          ) : (
            <>
              {/* Resumo */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span>{listing.emoji} {listing.title.slice(0, 32)}{listing.title.length > 32 ? '…' : ''}</span>
                  <span>{isFree ? 'Grátis' : `R$ ${price.toFixed(2).replace('.', ',')}`}</span>
                </div>
                {listing.price_old && listing.price_old > listing.price && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, padding: '6px 0', borderBottom: '1px solid var(--border)', color: 'var(--green)' }}>
                    <span>Desconto</span>
                    <span>- R$ {(Number(listing.price_old) - price).toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, padding: '8px 0', color: 'var(--blue)' }}>
                  <span>Total</span>
                  <span>{isFree ? 'Grátis' : `R$ ${price.toFixed(2).replace('.', ',')}`}</span>
                </div>
              </div>

              {!isFree && (
                <>
                  {/* Tabs pagamento */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    {(['pix', 'card'] as const).map(t => (
                      <button key={t} onClick={() => setTab(t)}
                        style={{ flex: 1, padding: '10px 8px', borderRadius: 'var(--r)', border: '1px solid', borderColor: tab === t ? 'var(--blue)' : 'var(--border)', background: tab === t ? 'var(--blue)' : '#fff', color: tab === t ? '#fff' : 'var(--text-2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all .15s' }}>
                        {t === 'pix' ? '⚡ Pix' : '💳 Cartão'}
                      </button>
                    ))}
                  </div>

                  {tab === 'pix' ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <div style={{ width: 120, height: 120, background: 'var(--surface)', borderRadius: 'var(--r)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, border: '2px dashed var(--border-2)' }}>📱</div>
                      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>Escaneie o QR Code ou use a chave Pix abaixo</p>
                      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
                        ggmax@pix.com.br
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Confirmação automática em até 1 minuto</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>Número do cartão</label>
                        <input value={card.num} onChange={e => setCard(c => ({ ...c, num: maskCard(e.target.value) }))} placeholder="0000 0000 0000 0000" maxLength={19}
                          style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 14, fontFamily: 'Inter,sans-serif', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>Validade</label>
                          <input value={card.exp} onChange={e => setCard(c => ({ ...c, exp: maskExp(e.target.value) }))} placeholder="MM/AA" maxLength={5}
                            style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 14, fontFamily: 'Inter,sans-serif', outline: 'none' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>CVV</label>
                          <input value={card.cvv} onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) }))} placeholder="123" maxLength={3}
                            style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 14, fontFamily: 'Inter,sans-serif', outline: 'none' }} />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>Nome no cartão</label>
                        <input value={card.name} onChange={e => setCard(c => ({ ...c, name: e.target.value.toUpperCase() }))} placeholder="NOME COMPLETO"
                          style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 14, fontFamily: 'Inter,sans-serif', outline: 'none' }} />
                      </div>
                    </div>
                  )}
                </>
              )}

              <button
                onClick={handlePurchase} disabled={loading}
                className="checkout-shimmer"
                style={{
                  width: '100%', marginTop: 20, padding: 14, borderRadius: 'var(--r)',
                  background: loading ? 'var(--border-2)' : 'var(--blue)', color: '#fff',
                  fontSize: 15, fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background .15s'
                }}
              >
                {loading ? '⏳ Processando...' : isFree ? '✅ Obter gratuitamente' : `🔒 Pagar R$ ${price.toFixed(2).replace('.', ',')}`}
              </button>
              <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>🛡️ Compra segura · Garantia de 7 dias</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
