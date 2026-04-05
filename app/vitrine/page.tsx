'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import ToastRoot from '@/components/ToastRoot'
import ProductCard from '@/components/ProductCard'
import type { Listing } from '@/lib/types'

const CATEGORIES = [
  { id: '', label: 'Tudo' },
  { id: 'free-fire', label: 'Free Fire' },
  { id: 'valorant', label: 'Valorant' },
  { id: 'roblox', label: 'Roblox' },
  { id: 'anime', label: 'Anime' },
  { id: 'vsl', label: 'Funis/VSL' },
  { id: 'outros', label: 'Outros' },
]

function VitrinContent() {
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [niche, setNiche] = useState('')
  const [priceFilter, setPriceFilter] = useState('')
  const [sort, setSort] = useState('newest')

  const loadListings = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('listings')
      .select('*, profiles(id,nome,role)')
      .eq('status', 'live')

    const search = searchParams.get('q')
    if (search) q = q.ilike('title', `%${search}%`)
    if (niche) q = q.eq('niche', niche)
    if (priceFilter === 'free') q = q.eq('price', 0)
    else if (priceFilter === 'u50')  q = q.gt('price', 0).lte('price', 50)
    else if (priceFilter === 'u100') q = q.gt('price', 0).lte('price', 100)
    else if (priceFilter === 'u200') q = q.gt('price', 0).lte('price', 200)
    else if (priceFilter === 'premium') q = q.gt('price', 200)

    if (sort === 'newest')      q = q.order('created_at', { ascending: false })
    else if (sort === 'price_asc')  q = q.order('price', { ascending: true })
    else if (sort === 'price_desc') q = q.order('price', { ascending: false })
    else if (sort === 'rating')     q = q.order('rating', { ascending: false })
    else                            q = q.order('sales_count', { ascending: false })

    const { data } = await q.limit(60)
    setListings(data || [])
    setLoading(false)
  }, [niche, priceFilter, sort, searchParams])

  useEffect(() => { loadListings() }, [loadListings])

  useEffect(() => {
    const channel = supabase.channel('listings-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'listings' }, () => loadListings())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadListings])

  return (
    <>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #007BFF 0%, #0056B3 100%)', padding: '48px 24px', textAlign: 'center', color: '#fff' }}>
        <h1 style={{ fontSize: 'clamp(26px,4vw,46px)', fontWeight: 900, letterSpacing: '-.04em', marginBottom: 10, lineHeight: 1.2 }}>
          O marketplace de itens digitais<br />mais completo do Brasil
        </h1>
        <p style={{ fontSize: 16, opacity: .85, marginBottom: 32 }}>Contas, skins, funis, servicos e muito mais</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap' }}>
          {[['840+', 'Produtos'], ['4.9', 'Avaliacao'], ['24h', 'Suporte'], ['100%', 'Seguro']].map(([v, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-.03em' }}>{v}</div>
              <div style={{ fontSize: 12, opacity: .75, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px 64px' }}>
        {/* Category chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 24, scrollbarWidth: 'none' }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setNiche(c.id)}
              style={{ padding: '8px 18px', borderRadius: 'var(--r-full)', border: `1.5px solid ${niche === c.id ? 'var(--blue)' : 'var(--border)'}`, background: niche === c.id ? 'var(--blue)' : '#fff', color: niche === c.id ? '#fff' : 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.03em' }}>
            {niche ? CATEGORIES.find(c => c.id === niche)?.label : 'Em destaque'}
            {!loading && <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500, marginLeft: 10 }}>{listings.length} anuncios</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { v: priceFilter, set: setPriceFilter, opts: [['','Qualquer preco'],['free','Gratis'],['u50','Ate R$50'],['u100','Ate R$100'],['u200','Ate R$200'],['premium','R$200+']] },
              { v: sort, set: setSort, opts: [['popular','Mais vendidos'],['newest','Mais recentes'],['price_asc','Menor preco'],['price_desc','Maior preco'],['rating','Melhor avaliacao']] }
            ].map((f, i) => (
              <select key={i} value={f.v} onChange={e => f.set(e.target.value)}
                style={{ border: '1px solid var(--border-2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 13, fontFamily: 'Inter,sans-serif', background: '#fff', color: 'var(--text-2)', outline: 'none', cursor: 'pointer' }}>
                {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 16 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', height: 300, opacity: .5 + i * .04 }} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '72px 24px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
            <div style={{ width: 56, height: 56, background: 'var(--surface)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="24" height="24" fill="none" stroke="var(--text-3)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Nenhum anuncio encontrado</div>
            <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 22 }}>Tente outro filtro ou seja o primeiro a anunciar nesta categoria!</p>
            <button onClick={() => { setNiche(''); setPriceFilter('') }}
              style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 'var(--r-full)', padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Ver todos os anuncios
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 16 }}>
            {listings.map(l => <ProductCard key={l.id} listing={l} />)}
          </div>
        )}

        {/* Como funciona */}
        <div style={{ marginTop: 56, borderTop: '1px solid var(--border)', paddingTop: 40 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.03em', marginBottom: 20 }}>Como funciona</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
            {[
              { icon: <svg width="24" height="24" fill="none" stroke="var(--blue)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>, title: '1. Encontre', desc: 'Busque entre centenas de anuncios verificados.' },
              { icon: <svg width="24" height="24" fill="none" stroke="var(--blue)" strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>, title: '2. Compre', desc: 'Pagamento seguro via Stripe. Protecao total.' },
              { icon: <svg width="24" height="24" fill="none" stroke="var(--blue)" strokeWidth="2" viewBox="0 0 24 24"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>, title: '3. Receba', desc: 'Acesso imediato apos confirmacao do pagamento.' },
              { icon: <svg width="24" height="24" fill="none" stroke="var(--blue)" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, title: '4. Protegido', desc: 'Garantia de 7 dias. Suporte dedicado.' },
            ].map(s => (
              <div key={s.title} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 20, textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ width: 48, height: 48, background: 'var(--blue-light)', borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>{s.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{s.title}</div>
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default function VitrinePage() {
  return (
    <>
      <Header />
      <ToastRoot />
      <Suspense fallback={<div style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>Carregando...</div>}>
        <VitrinContent />
      </Suspense>
    </>
  )
}
