'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'

interface Listing {
  id: string
  title: string
  emoji: string
  thumbnail_url: string | null
  price: number
  niche: string
  sales_count: number
}

interface Banner {
  active: boolean
  text: string
  icon: string
  color: string
  bg: string
  border: string
  link?: string
  linkText?: string
}

const CATS = [
  { id: 'free-fire', label: 'Free Fire',   emoji: '🔥' },
  { id: 'valorant',  label: 'Valorant',    emoji: '🎯' },
  { id: 'roblox',    label: 'Roblox',      emoji: '🧱' },
  { id: 'fortnite',  label: 'Fortnite',    emoji: '🏗️' },
  { id: 'anime',     label: 'Anime',       emoji: '⛩️' },
  { id: 'vsl',       label: 'Funis/VSL',   emoji: '📈' },
  { id: 'ebook',     label: 'E-books',     emoji: '📚' },
  { id: 'social',    label: 'Redes Soc.',  emoji: '📱' },
  { id: 'outros',    label: 'Outros',      emoji: '📦' },
]

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()
  const [produtos, setProdutos]   = useState<Listing[]>([])
  const [loading, setLoading]     = useState(true)
  const [banner, setBanner]       = useState<Banner | null>(null)
  const [stats, setStats]         = useState({ produtos: '840+', vendedores: '120+' })

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    const [prodRes, bannerRes, statsProds, statsSellers] = await Promise.all([
      supabase.from('listings').select('id,title,emoji,thumbnail_url,price,niche,sales_count')
        .eq('status','live').order('sales_count',{ascending:false}).limit(8),
      supabase.from('site_config').select('value').eq('key','banner').single(),
      supabase.from('listings').select('id',{count:'exact',head:true}).eq('status','live'),
      supabase.from('profiles').select('id',{count:'exact',head:true}).eq('role','vendedor'),
    ])

    setProdutos(prodRes.data || [])
    setLoading(false)

    if (bannerRes.data?.value) {
      const b = JSON.parse(bannerRes.data.value)
      if (b.active) setBanner(b)
    }

    setStats({
      produtos:   (statsProds.count  || 0) > 0 ? statsProds.count + '+' : '840+',
      vendedores: (statsSellers.count|| 0) > 0 ? statsSellers.count+'+' : '120+',
    })
  }

  const fmt = (p: number) => p === 0 ? 'Grátis' : `R$ ${p.toFixed(2).replace('.', ',')}`

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.5)} 50%{box-shadow:0 0 0 6px rgba(16,185,129,0)} }
        @keyframes skel   { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .fade1{animation:fadeUp .7s .1s ease both}
        .fade2{animation:fadeUp .7s .2s ease both}
        .fade3{animation:fadeUp .7s .3s ease both}
        .fade4{animation:fadeUp .7s .4s ease both}
        .cat-card:hover{border-color:#2563EB!important;background:#EFF6FF!important;transform:translateY(-3px);box-shadow:0 8px 24px rgba(37,99,235,.12);}
        .prod-card:hover{box-shadow:0 12px 32px rgba(0,0,0,.1)!important;transform:translateY(-4px);}
        .btn-primary:hover{background:#3B82F6!important;transform:translateY(-1px);}
        .btn-ghost-h:hover{border-color:#2563EB!important;color:#2563EB!important;}
        .skel{background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:skel 1.4s ease infinite;border-radius:16px;}
      `}</style>

      <Header />

      {/* ── BANNER ── */}
      {banner && (
        <div style={{ background: banner.bg, borderBottom: `1px solid ${banner.border}`, padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: banner.color }}>
          <span>{banner.icon}</span>
          <span>{banner.text}</span>
          {banner.link && <a href={banner.link} style={{ color: banner.color, fontWeight: 800, marginLeft: 8 }}>{banner.linkText || 'Ver mais →'}</a>}
        </div>
      )}

      {/* ── HERO ── */}
      <section style={{ minHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '7rem 2rem 4rem', position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse 80% 50% at 50% -10%,rgba(37,99,235,.07),transparent 70%),#fff' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(37,99,235,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(37,99,235,.04) 1px,transparent 1px)', backgroundSize: '50px 50px', maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%,black,transparent 70%)', pointerEvents: 'none' }} />

        <div className="fade1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#EFF6FF', border: '1px solid rgba(37,99,235,.2)', borderRadius: 999, padding: '6px 16px', fontSize: 12, color: '#2563EB', fontWeight: 700, marginBottom: '2rem' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }} />
          Marketplace #1 de itens digitais do Brasil
        </div>

        <h1 className="fade2" style={{ fontSize: 'clamp(2.6rem,6vw,5.5rem)', fontWeight: 900, letterSpacing: '-.03em', lineHeight: 1.06, marginBottom: '1.25rem', color: '#0F172A' }}>
          O marketplace de itens<br /><em style={{ fontStyle: 'italic', color: '#2563EB' }}>digitais mais completo</em>
        </h1>

        <p className="fade3" style={{ fontSize: 'clamp(.95rem,1.8vw,1.15rem)', color: '#64748B', maxWidth: 520, lineHeight: 1.7, marginBottom: '2.5rem' }}>
          Contas, skins, funis, e-books, scripts e muito mais. Compre com segurança, venda com facilidade.
        </p>

        <div className="fade3" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '3.5rem' }}>
          <button className="btn-primary" onClick={() => router.push('/vitrine')}
            style={{ padding: '.9rem 2.2rem', border: 'none', borderRadius: 12, cursor: 'pointer', background: '#2563EB', color: '#fff', fontSize: 15, fontWeight: 700, boxShadow: '0 8px 24px rgba(37,99,235,.3)', transition: 'all .2s' }}>
            🛒 Explorar vitrine
          </button>
          <button className="btn-ghost-h" onClick={() => router.push('/auth?tab=register')}
            style={{ padding: '.9rem 2.2rem', borderRadius: 12, background: 'transparent', border: '1.5px solid #E2E8F0', color: '#64748B', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all .2s' }}>
            Quero vender →
          </button>
        </div>

        <div className="fade4" style={{ display: 'flex', alignItems: 'center', gap: '2.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { val: stats.produtos,   lbl: 'Produtos'   },
            { val: stats.vendedores, lbl: 'Vendedores'  },
            { val: '4.9★',           lbl: 'Avaliação'   },
            { val: '100%',           lbl: 'Seguro'      },
          ].map((s, i) => (
            <>
              {i > 0 && <div key={'d'+i} style={{ width: 1, height: 40, background: '#E2E8F0' }} />}
              <div key={s.lbl} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#2563EB', letterSpacing: '-.03em' }}>{s.val}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>{s.lbl}</div>
              </div>
            </>
          ))}
        </div>
      </section>

      {/* ── CATEGORIAS ── */}
      <section style={{ padding: '5rem 2rem', background: '#F8FAFC' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.75rem' }}>📦 Categorias</div>
          <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', fontWeight: 900, letterSpacing: '-.03em', marginBottom: '.75rem' }}>Encontre o que precisa</h2>
          <p style={{ fontSize: '1rem', color: '#64748B', marginBottom: '2rem' }}>Navegue por categorias e descubra produtos incríveis.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12 }}>
            {CATS.map(c => (
              <div key={c.id} className="cat-card" onClick={() => router.push(`/vitrine?cat=${c.id}`)}
                style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: '1.25rem', textAlign: 'center', cursor: 'pointer', transition: 'all .2s' }}>
                <div style={{ fontSize: 32, marginBottom: '.5rem' }}>{c.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUTOS DESTAQUE ── */}
      <section style={{ padding: '5rem 2rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.75rem' }}>⭐ Destaque</div>
          <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', fontWeight: 900, letterSpacing: '-.03em', marginBottom: '.75rem' }}>Produtos em destaque</h2>
          <p style={{ fontSize: '1rem', color: '#64748B', marginBottom: '2rem' }}>Os mais vendidos da semana.</p>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
              {[1,2,3,4,5].map(i => <div key={i} className="skel" style={{ height: 220 }} />)}
            </div>
          ) : produtos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>Nenhum produto ainda.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
              {produtos.map(p => (
                <div key={p.id} className="prod-card" onClick={() => router.push(`/anuncio/${p.id}`)}
                  style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'all .2s' }}>
                  <div style={{ aspectRatio: '16/9', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, position: 'relative', overflow: 'hidden' }}>
                    {p.thumbnail_url
                      ? <img src={p.thumbnail_url} alt={p.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      : p.emoji}
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{p.niche}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#2563EB' }}>{fmt(p.price)}</div>
                      <div style={{ background: '#2563EB', color: '#fff', borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 700 }}>
                        {p.price === 0 ? 'Obter' : 'Comprar'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button className="btn-primary" onClick={() => router.push('/vitrine')}
              style={{ padding: '.9rem 2.2rem', border: 'none', borderRadius: 12, cursor: 'pointer', background: '#2563EB', color: '#fff', fontSize: 15, fontWeight: 700, transition: 'all .2s' }}>
              Ver todos os produtos →
            </button>
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section style={{ padding: '5rem 2rem', background: '#2563EB' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.7)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.75rem' }}>✅ Como funciona</div>
          <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', fontWeight: 900, color: '#fff', letterSpacing: '-.03em', marginBottom: '2rem' }}>Simples e seguro</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1.5rem' }}>
            {[
              { n: '1', t: 'Crie sua conta',        d: 'Cadastro rápido em menos de 1 minuto. Sem burocracia.' },
              { n: '2', t: 'Escolha o produto',     d: 'Navegue pela vitrine, filtre por categoria ou pesquise.' },
              { n: '3', t: 'Pague com segurança',   d: 'Pagamento via Stripe. Seus dados sempre protegidos.' },
              { n: '4', t: 'Receba na hora',         d: 'Acesso imediato ao produto após confirmação do pagamento.' },
            ].map(s => (
              <div key={s.n} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 16, padding: '1.5rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: '1rem' }}>{s.n}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: '.5rem' }}>{s.t}</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,.75)', lineHeight: 1.6 }}>{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ── */}
      <section style={{ padding: '5rem 2rem', background: '#F8FAFC' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.75rem' }}>💬 Depoimentos</div>
          <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', fontWeight: 900, letterSpacing: '-.03em', marginBottom: '2rem' }}>O que dizem nossos usuários</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
            {[
              { av: 'MR', name: 'Marcos R.', role: 'Comprador verificado', text: '"Comprei uma conta Free Fire e recebi na hora. Processo super simples e seguro!"' },
              { av: 'JS', name: 'Julia S.',  role: 'Vendedora verificada', text: '"Vendo meus funis aqui há 3 meses. Plataforma incrível, pagamentos pontuais."' },
              { av: 'PL', name: 'Pedro L.',  role: 'Comprador verificado', text: '"Melhor marketplace de digitais do Brasil. Interface limpa e entrega automática."' },
            ].map(t => (
              <div key={t.name} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: '1.5rem' }}>
                <div style={{ fontSize: 14, color: '#F59E0B', marginBottom: '.75rem' }}>★★★★★</div>
                <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.7, marginBottom: '1rem' }}>{t.text}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{t.av}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '5rem 2rem', textAlign: 'center', background: 'linear-gradient(135deg,#1e40af,#2563EB)' }}>
        <h2 style={{ fontSize: 'clamp(2rem,4vw,3rem)', fontWeight: 900, color: '#fff', letterSpacing: '-.03em', marginBottom: '.75rem' }}>Pronto para começar?</h2>
        <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,.8)', marginBottom: '2rem' }}>Crie sua conta grátis. Sem cartão de crédito.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/auth?tab=register')}
            style={{ padding: '.9rem 2.2rem', border: 'none', borderRadius: 12, cursor: 'pointer', background: '#fff', color: '#2563EB', fontSize: 15, fontWeight: 700, transition: 'all .2s' }}>
            🚀 Criar conta grátis
          </button>
          <button onClick={() => router.push('/vitrine')}
            style={{ padding: '.9rem 2.2rem', borderRadius: 12, background: 'transparent', border: '1.5px solid rgba(255,255,255,.3)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all .2s' }}>
            Ver produtos
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#0F172A', color: '#94A3B8', padding: '2rem 2rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', fontSize: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', fontStyle: 'italic' }}>G</div>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontStyle: 'italic', letterSpacing: '-.03em' }}>GGMAX</span>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {['Privacidade','Termos','Suporte'].map(l => (
            <a key={l} href="#" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: 13 }}>{l}</a>
          ))}
        </div>
        <span>© 2025 GGMAX · Todos os direitos reservados</span>
      </footer>
    </>
  )
}