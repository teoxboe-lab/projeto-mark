'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import ToastRoot, { showToast } from '@/components/ToastRoot'
import type { Listing, Profile, Purchase } from '@/lib/types'

type SellerProfile = Profile & {
  total_listings: number
  positive_reviews: number
  member_since: string
}

export default function AnuncioPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [listing, setListing] = useState<Listing | null>(null)
  const [seller, setSeller] = useState<SellerProfile | null>(null)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [activeImg, setActiveImg] = useState(0)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(false)
  const [alreadyOwned, setAlreadyOwned] = useState(false)

  // Images: thumbnail + media se for imagem
  const [images, setImages] = useState<string[]>([])

  useEffect(() => {
    loadListing()
    loadCurrentUser()
  }, [id])

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) setCurrentUser(data)

    // Verifica se já comprou
    const { data: purchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('listing_id', id)
      .eq('status', 'completed')
      .single()
    if (purchase) setAlreadyOwned(true)
  }

  const loadListing = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('listings')
      .select('*, profiles(id, nome, role, avatar_url, created_at)')
      .eq('id', id)
      .single()

    if (error || !data) { router.push('/vitrine'); return }
    setListing(data)

    // Monta galeria de imagens
    const imgs: string[] = []
    if (data.thumbnail_url) imgs.push(data.thumbnail_url)
    if (data.media_url && !data.media_url.match(/\.(mp4|mov|webm|avi)$/i)) imgs.push(data.media_url)
    if (imgs.length === 0) imgs.push('')
    setImages(imgs)

    // Busca stats do vendedor
    if (data.profiles?.id) {
      const { data: sellerListings } = await supabase
        .from('listings')
        .select('id', { count: 'exact' })
        .eq('seller_id', data.profiles.id)
        .eq('status', 'live')

      setSeller({
        ...data.profiles,
        total_listings: sellerListings?.length || 0,
        positive_reviews: 100,
        member_since: data.profiles.created_at
          ? new Date(data.profiles.created_at).toLocaleDateString('pt-BR')
          : '-',
      })
    }
    setLoading(false)
  }

  const handleBuy = async () => {
    if (!currentUser) { router.push('/auth'); return }
    if (alreadyOwned) { router.push('/dashboard'); return }
    if (currentUser.id === listing?.seller_id) {
      showToast('Voce nao pode comprar seu proprio anuncio', 'warn')
      return
    }

    if (Number(listing?.price) === 0) {
      // Gratis - registra direto
      setBuying(true)
      const { error } = await supabase.from('purchases').insert({
        buyer_id: currentUser.id,
        listing_id: listing!.id,
        amount: 0,
        status: 'completed',
      })
      if (!error) {
        setAlreadyOwned(true)
        showToast('Produto adicionado a sua biblioteca!', 'ok')
        setTimeout(() => router.push('/dashboard'), 1500)
      }
      setBuying(false)
      return
    }

    // Redireciona para Stripe checkout
    setBuying(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listing!.id }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        showToast(data.error || 'Erro ao iniciar pagamento', 'err')
      }
    } catch {
      showToast('Erro de conexao. Tente novamente.', 'err')
    }
    setBuying(false)
  }

  const isVideo = listing?.media_url?.match(/\.(mp4|mov|webm|avi)$/i)
  const isFree = Number(listing?.price) === 0
  const price = Number(listing?.price)
  const priceOld = listing?.price_old ? Number(listing.price_old) : null
  const discount = priceOld && priceOld > price ? Math.round((1 - price / priceOld) * 100) : null
  const sellerInitials = seller?.nome?.slice(0, 2).toUpperCase() || 'VD'

  if (loading) return (
    <>
      <Header />
      <div style={{ maxWidth: 1100, margin: '40px auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#f3f4f6', borderRadius: 8, height: 400, animation: 'pulse 1.5s infinite' }} />
            <div style={{ background: '#f3f4f6', borderRadius: 8, height: 80, animation: 'pulse 1.5s infinite' }} />
            <div style={{ background: '#f3f4f6', borderRadius: 8, height: 200, animation: 'pulse 1.5s infinite' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#f3f4f6', borderRadius: 8, height: 300, animation: 'pulse 1.5s infinite' }} />
            <div style={{ background: '#f3f4f6', borderRadius: 8, height: 180, animation: 'pulse 1.5s infinite' }} />
          </div>
        </div>
      </div>
    </>
  )

  if (!listing) return null

  return (
    <>
      <Header />
      <ToastRoot />

      {/* Breadcrumb */}
      <div style={{ borderBottom: '1px solid var(--border)', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-3)' }}>
          <span style={{ cursor: 'pointer', color: 'var(--blue)' }} onClick={() => router.push('/vitrine')}>Inicio</span>
          <span>/</span>
          <span style={{ cursor: 'pointer', color: 'var(--blue)', textTransform: 'capitalize' }}>{listing.niche}</span>
          <span>/</span>
          <span style={{ color: 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>{listing.title}</span>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 64px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32, alignItems: 'start' }}>

          {/* ─── COLUNA ESQUERDA ─── */}
          <div>
            {/* Titulo */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em', lineHeight: 1.3 }}>
                  {listing.title}
                </h1>
                {listing.niche && (
                  <span style={{ background: 'var(--blue)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--r-full)', textTransform: 'uppercase', letterSpacing: '.06em', flexShrink: 0 }}>
                    {listing.niche}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 13, color: 'var(--text-3)' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>Disponivel:</span>
                  <span style={{ fontWeight: 700, color: 'var(--green)' }}>{listing.status === 'live' ? '1' : '0'}</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>Vendas:</span>
                  <span style={{ fontWeight: 700 }}>{listing.sales_count || 0}</span>
                </div>
                {listing.rating && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#F59E0B' }}>{'★'.repeat(Math.round(Number(listing.rating)))}</span>
                    <span>{Number(listing.rating).toFixed(1)} ({listing.reviews_count || 0})</span>
                  </div>
                )}
              </div>
              {!isFree && (
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>
                  Voce ganha {Math.round(price * 8)} FF Points nessa compra
                </div>
              )}
            </div>

            {/* Galeria de imagens */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', marginBottom: 20 }}>
              {/* Imagem principal */}
              <div style={{ background: '#1a1a2e', minHeight: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                {isVideo && activeImg === 0 ? (
                  <video src={listing.media_url!} controls style={{ maxWidth: '100%', maxHeight: 380, display: 'block' }} />
                ) : images[activeImg] ? (
                  <img
                    src={images[activeImg]}
                    alt={listing.title}
                    style={{ maxWidth: '100%', maxHeight: 380, objectFit: 'contain', display: 'block' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <div style={{ fontSize: 80, opacity: .4 }}>{listing.emoji}</div>
                )}
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div style={{ display: 'flex', gap: 8, padding: 12, background: 'var(--surface)', borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
                  {images.map((img, i) => (
                    <div key={i} onClick={() => setActiveImg(i)}
                      style={{ width: 64, height: 48, borderRadius: 6, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', border: `2px solid ${activeImg === i ? 'var(--blue)' : 'var(--border)'}`, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color .15s' }}>
                      {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 20 }}>{listing.emoji}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Caracteristicas */}
            {(listing.tags?.length > 0) && (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', marginBottom: 20, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text)' }}>Caracteristicas</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', background: 'var(--surface)', borderBottom: '1px solid var(--border)', width: '35%' }}>Tipo do Anuncio</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)', textTransform: 'capitalize' }}>{listing.niche}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', background: 'var(--surface)', borderBottom: '1px solid var(--border)', width: '35%' }}>Categoria</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)', textTransform: 'capitalize' }}>{listing.category}</td>
                    </tr>
                    {listing.tags?.slice(0, 4).map((tag, i) => (
                      <tr key={tag}>
                        <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', background: 'var(--surface)', borderBottom: i < 3 ? '1px solid var(--border)' : 'none', width: '35%' }}>
                          Feature {i + 1}
                        </td>
                        <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text)', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                          {tag}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Descricao */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                <div style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text)' }}>Descricao do Anuncio</div>
              </div>
              <div style={{ padding: '20px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {listing.description}
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  CRIADO EM: {new Date(listing.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>
                  COMPARTILHAR:
                  {[
                    { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(listing.title + ' - ' + window.location.href)}`, color: '#25D366' },
                    { label: 'Twitter/X', href: `https://x.com/intent/tweet?text=${encodeURIComponent(listing.title)}&url=${encodeURIComponent(window.location.href)}`, color: '#000' },
                  ].map(s => (
                    <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                      style={{ color: s.color, fontSize: 12, fontWeight: 700, padding: '2px 8px', border: `1px solid ${s.color}`, borderRadius: 4, textDecoration: 'none' }}>
                      {s.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Denunciar */}
            <div style={{ textAlign: 'right' }}>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--red)', fontWeight: 600 }}
                onClick={() => showToast('Denuncia enviada para moderacao', 'warn')}>
                Denunciar
              </button>
            </div>
          </div>

          {/* ─── COLUNA DIREITA ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 80 }}>

            {/* Box de compra */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
              <div style={{ padding: '20px 20px 16px' }}>
                {/* Preco */}
                {priceOld && (
                  <div style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'line-through', marginBottom: 2 }}>
                    R$ {priceOld.toFixed(2).replace('.', ',')}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: isFree ? 'var(--green)' : 'var(--blue)', letterSpacing: '-.03em' }}>
                    {isFree ? 'GRATIS' : `R$ ${price.toFixed(2).replace('.', ',')}`}
                  </div>
                  {discount && (
                    <span style={{ background: 'var(--green)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--r-full)' }}>
                      -{discount}%
                    </span>
                  )}
                </div>
                {!isFree && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
                    ou ate 12x de R$ {(price / 12).toFixed(2).replace('.', ',')} sem juros
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={handleBuy}
                  disabled={buying}
                  style={{
                    width: '100%', padding: '14px', background: alreadyOwned ? 'var(--green)' : buying ? 'var(--border-2)' : 'var(--blue)',
                    color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 15, fontWeight: 700,
                    cursor: buying ? 'not-allowed' : 'pointer', transition: 'background .15s', letterSpacing: '.01em'
                  }}
                >
                  {buying ? 'Aguarde...' : alreadyOwned ? 'Ver na biblioteca' : isFree ? 'Obter gratis' : 'COMPRAR'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, fontSize: 12, color: 'var(--text-3)' }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Entrega garantida ou seu dinheiro de volta
                </div>
              </div>
            </div>

            {/* Vendedor */}
            {seller && (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', textAlign: 'center' }}>Vendedor</div>
                </div>
                <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                  {/* Avatar */}
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--blue)', border: '3px solid var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff', margin: '0 auto 10px' }}>
                    {seller.avatar_url
                      ? <img src={seller.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : sellerInitials
                    }
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>{seller.nome}</div>

                  {/* Status online - placeholder */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEF9C3', borderRadius: 'var(--r-full)', padding: '2px 10px', fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 14 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                    Offline
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                    {[
                      ['Membro desde:', seller.member_since],
                      ['Avaliacoes positivas:', `${seller.positive_reviews}%`],
                      ['Total de anuncios:', String(seller.total_listings)],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>{k}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Verificacoes */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', textAlign: 'center' }}>Verificacoes</div>
              </div>
              <div style={{ padding: '16px' }}>
                {[
                  { label: 'E-mail', status: 'Verificado', ok: true },
                  { label: 'Telefone', status: 'Verificado', ok: true },
                  { label: 'Documentos', status: 'Nao Verificado', ok: false },
                ].map(v => (
                  <div key={v.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{v.label}:</span>
                    <span style={{ fontWeight: 700, color: v.ok ? 'var(--blue)' : 'var(--text-3)' }}>{v.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Entrega garantida */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '20px 16px', textAlign: 'center' }}>
              <svg width="32" height="32" fill="none" stroke="var(--blue)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Entrega garantida</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Ou o seu dinheiro de volta</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .anuncio-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>
    </>
  )
}
