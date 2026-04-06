'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── E-mails com acesso admin ──
const ADMIN_EMAILS = ['narroads001@gmail.com', 'narroads001@gmail.com']

interface Profile {
  id: string; nome: string; email: string; role: string
  status: string; seller_status: string; balance_available: number
  created_at: string; ban_reason?: string
}
interface Listing {
  id: string; title: string; price: number; status: string
  sales_count: number; created_at: string; seller_id: string
  profiles?: { nome: string }
}
interface Withdrawal {
  id: string; amount: number; status: string; created_at: string
  requested_at: string; seller_id: string; profiles?: { nome: string; email: string }
}
interface Banner {
  active: boolean; text: string; icon: string; color: string
  bg: string; border: string; link: string; linkText: string
}

type Panel = 'overview' | 'users' | 'sellers' | 'listings' | 'withdrawals' | 'banner'

const PANEL_TITLES: Record<Panel, string> = {
  overview: 'Dashboard', users: 'Usuários', sellers: 'Vendedores',
  listings: 'Anúncios', withdrawals: 'Saques', banner: 'Banner do Site',
}

export default function AdminPage() {
  const router  = useRouter()
  const supabase = createClient()

  const [authed, setAuthed]     = useState(false)
  const [loading, setLoading]   = useState(true)
  const [panel, setPanel]       = useState<Panel>('overview')
  const [toast, setToast]       = useState<{msg:string;type:'ok'|'err'|'warn'}|null>(null)

  // Data
  const [metrics, setMetrics]         = useState({ users:0, sellers:0, listings:0, pendingW:0 })
  const [users, setUsers]             = useState<Profile[]>([])
  const [sellers, setSellers]         = useState<Profile[]>([])
  const [listings, setListings]       = useState<Listing[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [pendingSellers, setPendingSellers] = useState<Profile[]>([])
  const [pendingW, setPendingW]       = useState<Withdrawal[]>([])
  const [sellerFilter, setSellerFilter] = useState<'all'|'pending'|'approved'|'suspended'>('all')
  const [userSearch, setUserSearch]   = useState('')
  const [sellerSearch, setSellerSearch] = useState('')
  const [listingSearch, setListingSearch] = useState('')
  const [banner, setBanner]           = useState<Banner>({ active:false, text:'', icon:'📢', color:'#1e40af', bg:'#EFF6FF', border:'#BFDBFE', link:'', linkText:'Ver mais' })
  const [suspendModal, setSuspendModal] = useState<{uid:string;nome:string}|null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [suspendAction, setSuspendAction] = useState('suspended')

  // ── TOAST ──
  const showToast = (msg: string, type: 'ok'|'err'|'warn' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── AUTH CHECK ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !ADMIN_EMAILS.includes(user.email || 'temoteocanal@gmail.com')) {
        router.push('/auth'); return
      }
      setAuthed(true); setLoading(false)
      loadOverview()
    })
  }, [])

  // ── OVERVIEW ──
  const loadOverview = useCallback(async () => {
    const [u, s, l, w, ps, pw] = await Promise.all([
      supabase.from('profiles').select('id',{count:'exact',head:true}),
      supabase.from('profiles').select('id',{count:'exact',head:true}).eq('role','vendedor'),
      supabase.from('listings').select('id',{count:'exact',head:true}).eq('status','live'),
      supabase.from('withdrawals').select('id',{count:'exact',head:true}).eq('status','pending'),
      supabase.from('profiles').select('*').eq('role','vendedor').or('seller_status.eq.pending,seller_status.is.null').order('created_at',{ascending:false}).limit(5),
      supabase.from('withdrawals').select('*,profiles(nome,email)').eq('status','pending').order('created_at',{ascending:false}).limit(5),
    ])
    setMetrics({ users: u.count||0, sellers: s.count||0, listings: l.count||0, pendingW: w.count||0 })
    setPendingSellers(ps.data||[])
    setPendingW(pw.data as Withdrawal[]||[])
  }, [])

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at',{ascending:false})
    setUsers(data||[])
  }
  const loadSellers = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role','vendedor').order('created_at',{ascending:false})
    setSellers(data||[])
  }
  const loadListings = async () => {
    const { data } = await supabase.from('listings').select('*,profiles(nome)').order('created_at',{ascending:false})
    setListings(data as Listing[]||[])
  }
  const loadWithdrawals = async () => {
    const { data } = await supabase.from('withdrawals').select('*,profiles(nome,email)').order('created_at',{ascending:false}).limit(50)
    setWithdrawals(data as Withdrawal[]||[])
  }
  const loadBanner = async () => {
    const { data } = await supabase.from('site_config').select('value').eq('key','banner').single()
    if (data?.value) setBanner(JSON.parse(data.value))
  }

  const goPanel = (p: Panel) => {
    setPanel(p)
    if (p==='users' && !users.length) loadUsers()
    if (p==='sellers') loadSellers()
    if (p==='listings' && !listings.length) loadListings()
    if (p==='withdrawals') loadWithdrawals()
    if (p==='banner') loadBanner()
  }

  // ── ACTIONS ──
  const approveSeller = async (id: string) => {
    await supabase.from('profiles').update({ seller_status:'approved' }).eq('id',id)
    showToast('✅ Vendedor aprovado!')
    loadSellers(); loadOverview()
  }
  const rejectSeller = async (id: string) => {
    if (!confirm('Rejeitar este vendedor?')) return
    await supabase.from('profiles').update({ seller_status:'rejected', role:'comprador' }).eq('id',id)
    showToast('❌ Vendedor rejeitado','warn')
    loadSellers(); loadOverview()
  }
  const restoreUser = async (id: string) => {
    await supabase.from('profiles').update({ status:'active', seller_status:'approved' }).eq('id',id)
    showToast('🔓 Usuário restaurado')
    loadSellers(); loadUsers()
  }
  const doSuspend = async () => {
    if (!suspendModal) return
    await supabase.from('profiles').update({ status: suspendAction, seller_status: suspendAction, ban_reason: suspendReason }).eq('id', suspendModal.uid)
    setSuspendModal(null)
    showToast('⚠️ Usuário punido','warn')
    loadSellers(); loadUsers()
  }
  const promoteUser = async (id: string, role: string) => {
    const newRole = role === 'vendedor' ? 'comprador' : 'vendedor'
    const upd: any = { role: newRole }
    if (newRole === 'vendedor') upd.seller_status = 'approved'
    await supabase.from('profiles').update(upd).eq('id',id)
    showToast('🔄 Papel alterado para ' + newRole)
    loadUsers()
  }
  const deleteUser = async (id: string, nome: string) => {
    if (!confirm(`Remover permanentemente "${nome}"? Esta ação não pode ser desfeita.`)) return
    await supabase.from('profiles').delete().eq('id',id)
    showToast('🗑️ Usuário removido','err')
    loadUsers(); loadSellers()
  }
  const toggleListing = async (id: string, status: string) => {
    const ns = status === 'live' ? 'paused' : 'live'
    await supabase.from('listings').update({ status: ns }).eq('id',id)
    showToast(ns === 'live' ? '▶ Anúncio ativado' : '⏸ Anúncio pausado')
    loadListings()
  }
  const deleteListing = async (id: string) => {
    if (!confirm('Remover este anúncio?')) return
    await supabase.from('listings').delete().eq('id',id)
    showToast('🗑️ Anúncio removido','err')
    loadListings()
  }
  const markWithdrawal = async (id: string, status: string) => {
    const upd: any = { status }
    if (status === 'paid') upd.paid_at = new Date().toISOString()
    await supabase.from('withdrawals').update(upd).eq('id',id)
    showToast(status === 'paid' ? '✅ Saque pago' : '❌ Saque falhou', status === 'paid' ? 'ok' : 'err')
    loadWithdrawals(); loadOverview()
  }
  const saveBanner = async () => {
    const { error } = await supabase.from('site_config').upsert({ key:'banner', value: JSON.stringify(banner) }, { onConflict:'key' })
    if (error) { showToast('Erro: '+error.message,'err'); return }
    showToast('✅ Banner salvo!')
  }
  const doLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  // ── FILTERED LISTS ──
  const filteredUsers = users.filter(u =>
    (u.nome||'').toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email||'').toLowerCase().includes(userSearch.toLowerCase())
  )
  const filteredSellers = sellers
    .filter(s => sellerFilter === 'all' ? true :
      sellerFilter === 'pending'   ? (!s.seller_status || s.seller_status === 'pending') :
      sellerFilter === 'approved'  ? s.seller_status === 'approved' :
      s.seller_status === 'suspended' || s.status === 'suspended'
    )
    .filter(s =>
      (s.nome||'').toLowerCase().includes(sellerSearch.toLowerCase()) ||
      (s.email||'').toLowerCase().includes(sellerSearch.toLowerCase())
    )
  const filteredListings = listings.filter(l =>
    l.title.toLowerCase().includes(listingSearch.toLowerCase())
  )

  // ── HELPERS ──
  const fmt = (v: number) => `R$ ${Number(v).toFixed(2).replace('.',',')}`
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

  const Badge = ({ label, color, bg }: { label:string; color:string; bg:string }) => (
    <span style={{ display:'inline-flex', alignItems:'center', fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:999, background:bg, color }}>{label}</span>
  )
  const sellerBadge = (s: Profile) => {
    const st = s.seller_status
    if (!st || st === 'pending')  return <Badge label="⏳ Pendente"  color="#D97706" bg="#FFFBEB" />
    if (st === 'approved')        return <Badge label="✅ Aprovado"  color="#059669" bg="#ECFDF5" />
    if (st === 'suspended')       return <Badge label="🚫 Suspenso"  color="#DC2626" bg="#FEF2F2" />
    if (st === 'rejected')        return <Badge label="❌ Rejeitado" color="#DC2626" bg="#FEF2F2" />
    return <Badge label={st} color="#64748B" bg="#F1F5F9" />
  }

  const W_STATUS: Record<string, {label:string;color:string;bg:string}> = {
    pending:    { label:'⏳ Pendente',    color:'#D97706', bg:'#FFFBEB' },
    processing: { label:'🔄 Processando', color:'#2563EB', bg:'#EFF6FF' },
    paid:       { label:'✅ Pago',        color:'#059669', bg:'#ECFDF5' },
    failed:     { label:'❌ Falhou',      color:'#DC2626', bg:'#FEF2F2' },
    cancelled:  { label:'🚫 Cancelado',   color:'#64748B', bg:'#F1F5F9' },
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,sans-serif', fontSize:14, color:'#64748B' }}>
      Verificando acesso...
    </div>
  )
  if (!authed) return null

  // ── STYLES ──
  const S = {
    sidebar: { width:240, minHeight:'100vh', flexShrink:0, background:'#fff', borderRight:'1px solid #E2E8F0', display:'flex', flexDirection:'column' as const, padding:'1.25rem .75rem', position:'sticky' as const, top:0, height:'100vh', overflowY:'auto' as const },
    navItem: (active: boolean): React.CSSProperties => ({ display:'flex', alignItems:'center', gap:9, padding:'.55rem .75rem', borderRadius:9, cursor:'pointer', fontSize:13, color: active ? '#2563EB' : '#64748B', fontWeight: active ? 700 : 500, background: active ? '#EFF6FF' : 'transparent', marginBottom:2, transition:'all .15s', userSelect:'none' }),
    card: { background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:'1rem 1.25rem', boxShadow:'0 1px 3px rgba(0,0,0,.04)' },
    th: { padding:'.6rem 1rem', fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase' as const, letterSpacing:'.06em', textAlign:'left' as const, borderBottom:'1px solid #E2E8F0', background:'#F8FAFC' },
    td: { padding:'.75rem 1rem', fontSize:13, borderBottom:'1px solid #E2E8F0' },
    btn: (bg: string, color: string, border?: string): React.CSSProperties => ({ padding:'.4rem .9rem', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', border: border||'none', background:bg, color, fontFamily:'Inter,sans-serif', transition:'all .15s', display:'inline-flex', alignItems:'center', gap:4 }),
    input: { padding:'.6rem .9rem', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:13, fontFamily:'Inter,sans-serif', color:'#0F172A', outline:'none', background:'#fff', width:'100%' },
  }

  return (
    <div style={{ fontFamily:'Inter,sans-serif', display:'flex', minHeight:'100vh', background:'#F8FAFC', color:'#0F172A' }}>

      {/* ── SIDEBAR ── */}
      <div style={S.sidebar}>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'.4rem .5rem', marginBottom:'.25rem' }}>
          <div style={{ width:34, height:34, borderRadius:9, background:'#2563EB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:900, color:'#fff', fontStyle:'italic', flexShrink:0 }}>G</div>
          <span style={{ fontSize:16, fontWeight:900, color:'#2563EB', fontStyle:'italic', letterSpacing:'-.03em' }}>Framework</span>
        </div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:6, padding:'3px 8px', fontSize:10, color:'#EF4444', fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', margin:'0 .5rem 1.25rem' }}>
          🔒 Admin Panel
        </div>

        {([
          { id:'overview',    label:'Dashboard',    icon:'⊞' },
          { id:'users',       label:'Usuários',     icon:'👥' },
          { id:'sellers',     label:'Vendedores',   icon:'🏪' },
          { id:'listings',    label:'Anúncios',     icon:'📦' },
          { id:'withdrawals', label:'Saques',       icon:'💸' },
          { id:'banner',      label:'Banner',       icon:'📢' },
        ] as {id:Panel;label:string;icon:string}[]).map(item => (
          <div key={item.id} style={S.navItem(panel===item.id)} onClick={() => goPanel(item.id)}>
            <span style={{ fontSize:14 }}>{item.icon}</span>
            {item.label}
            {item.id==='sellers' && pendingSellers.length > 0 && (
              <span style={{ marginLeft:'auto', fontSize:10, fontWeight:800, background:'#EF4444', color:'#fff', borderRadius:999, padding:'1px 6px' }}>{pendingSellers.length}</span>
            )}
          </div>
        ))}

        <div style={{ marginTop:'auto', borderTop:'1px solid #E2E8F0', paddingTop:'1rem' }}>
          <button onClick={doLogout} style={S.btn('#FEF2F2','#EF4444','1px solid #FECACA') as React.CSSProperties}>
            ↩ Sair do admin
          </button>
          <button onClick={() => router.push('/')} style={{ ...S.btn('transparent','#64748B','1px solid #E2E8F0'), marginTop:6 } as React.CSSProperties}>
            ↗ Ver site
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column' }}>
        {/* Topbar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.5rem', borderBottom:'1px solid #E2E8F0', background:'#fff', position:'sticky', top:0, zIndex:10 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, letterSpacing:'-.02em' }}>{PANEL_TITLES[panel]}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, fontWeight:600, color:'#059669', background:'#ECFDF5', border:'1px solid #A7F3D0', borderRadius:999, padding:'5px 12px' }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#10B981', display:'inline-block' }} />
            Online
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, padding:'1.5rem', overflowY:'auto' }}>

          {/* ── OVERVIEW ── */}
          {panel === 'overview' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:14, marginBottom:'1.5rem' }}>
                {[
                  { label:'Usuários',    val:metrics.users,    color:'#2563EB' },
                  { label:'Vendedores',  val:metrics.sellers,  color:'#7C3AED' },
                  { label:'Anúncios',    val:metrics.listings, color:'#10B981' },
                  { label:'Saques pend.',val:metrics.pendingW, color:'#F59E0B' },
                ].map(m => (
                  <div key={m.label} style={S.card}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>{m.label}</div>
                    <div style={{ fontSize:'2rem', fontWeight:900, letterSpacing:'-.03em', color:m.color }}>{m.val}</div>
                  </div>
                ))}
              </div>

              {/* Pending sellers */}
              <div style={{ ...S.card, marginBottom:'1.5rem', padding:0, overflow:'hidden' }}>
                <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #E2E8F0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ fontSize:14, fontWeight:800 }}>⏳ Vendedores aguardando aprovação</div>
                  <button onClick={() => goPanel('sellers')} style={S.btn('#2563EB','#fff')}>Ver todos</button>
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr><th style={S.th}>Nome</th><th style={S.th}>E-mail</th><th style={S.th}>Cadastro</th><th style={S.th}>Ações</th></tr></thead>
                  <tbody>
                    {pendingSellers.length === 0
                      ? <tr><td colSpan={4} style={{ ...S.td, textAlign:'center', color:'#64748B', padding:'2rem' }}>Nenhum vendedor pendente ✅</td></tr>
                      : pendingSellers.map(s => (
                        <tr key={s.id}>
                          <td style={S.td}><b>{s.nome||'—'}</b></td>
                          <td style={{ ...S.td, color:'#64748B' }}>{s.email}</td>
                          <td style={{ ...S.td, fontSize:12, color:'#94A3B8' }}>{fmtDate(s.created_at)}</td>
                          <td style={S.td}>
                            <button style={{ ...S.btn('#ECFDF5','#059669','1px solid #A7F3D0'), marginRight:6 }} onClick={() => approveSeller(s.id)}>✅ Aprovar</button>
                            <button style={S.btn('#FEF2F2','#EF4444','1px solid #FECACA')} onClick={() => rejectSeller(s.id)}>❌ Rejeitar</button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Pending withdrawals */}
              <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
                <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #E2E8F0' }}>
                  <div style={{ fontSize:14, fontWeight:800 }}>💸 Saques pendentes</div>
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr><th style={S.th}>Vendedor</th><th style={S.th}>Valor</th><th style={S.th}>Solicitado</th><th style={S.th}>Status</th></tr></thead>
                  <tbody>
                    {pendingW.length === 0
                      ? <tr><td colSpan={4} style={{ ...S.td, textAlign:'center', color:'#64748B', padding:'2rem' }}>Nenhum saque pendente ✅</td></tr>
                      : pendingW.map(w => (
                        <tr key={w.id}>
                          <td style={S.td}><b>{w.profiles?.nome||'—'}</b></td>
                          <td style={{ ...S.td, color:'#2563EB', fontWeight:700 }}>{fmt(w.amount)}</td>
                          <td style={{ ...S.td, fontSize:12, color:'#94A3B8' }}>{fmtDate(w.created_at)}</td>
                          <td style={S.td}><Badge label="⏳ Pendente" color="#D97706" bg="#FFFBEB" /></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {panel === 'users' && (
            <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
              <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #E2E8F0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:14, fontWeight:800 }}>👥 Todos os usuários</div>
                <input style={{ ...S.input, width:240 }} placeholder="Buscar por nome ou e-mail..." value={userSearch} onChange={e => setUserSearch(e.target.value)} />
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr><th style={S.th}>Nome</th><th style={S.th}>E-mail</th><th style={S.th}>Papel</th><th style={S.th}>Cadastro</th><th style={S.th}>Status</th><th style={S.th}>Ações</th></tr></thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td style={S.td}><b>{u.nome||'—'}</b></td>
                      <td style={{ ...S.td, color:'#64748B', fontSize:12 }}>{u.email}</td>
                      <td style={S.td}><Badge label={u.role||'comprador'} color={u.role==='vendedor'?'#7C3AED':'#2563EB'} bg={u.role==='vendedor'?'#F5F3FF':'#EFF6FF'} /></td>
                      <td style={{ ...S.td, fontSize:12, color:'#94A3B8' }}>{fmtDate(u.created_at)}</td>
                      <td style={S.td}><Badge label={u.status||'ativo'} color={!u.status||u.status==='active'?'#059669':'#EF4444'} bg={!u.status||u.status==='active'?'#ECFDF5':'#FEF2F2'} /></td>
                      <td style={{ ...S.td, display:'flex', gap:4, flexWrap:'wrap' }}>
                        <button style={S.btn('transparent','#64748B','1px solid #E2E8F0')} onClick={() => promoteUser(u.id,u.role)}>🔄</button>
                        <button style={S.btn('#FFFBEB','#D97706','1px solid #FDE68A')} onClick={() => setSuspendModal({uid:u.id,nome:u.nome})}>⚠️</button>
                        <button style={S.btn('#FEF2F2','#EF4444','1px solid #FECACA')} onClick={() => deleteUser(u.id,u.nome)}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── SELLERS ── */}
          {panel === 'sellers' && (
            <div>
              <div style={{ display:'flex', gap:8, marginBottom:'1rem' }}>
                {(['all','pending','approved','suspended'] as const).map(f => (
                  <button key={f} style={S.btn(sellerFilter===f?'#2563EB':'transparent', sellerFilter===f?'#fff':'#64748B', sellerFilter===f?'none':'1px solid #E2E8F0')} onClick={() => setSellerFilter(f)}>
                    {f==='all'?'Todos':f==='pending'?'⏳ Pendentes':f==='approved'?'✅ Aprovados':'🚫 Suspensos'}
                  </button>
                ))}
              </div>
              <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
                <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #E2E8F0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ fontSize:14, fontWeight:800 }}>🏪 Vendedores</div>
                  <input style={{ ...S.input, width:240 }} placeholder="Buscar vendedor..." value={sellerSearch} onChange={e => setSellerSearch(e.target.value)} />
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr><th style={S.th}>Nome</th><th style={S.th}>E-mail</th><th style={S.th}>Status</th><th style={S.th}>Saldo</th><th style={S.th}>Ações</th></tr></thead>
                  <tbody>
                    {filteredSellers.map(s => (
                      <tr key={s.id}>
                        <td style={S.td}><b>{s.nome||'—'}</b></td>
                        <td style={{ ...S.td, fontSize:12, color:'#64748B' }}>{s.email}</td>
                        <td style={S.td}>{sellerBadge(s)}</td>
                        <td style={{ ...S.td, color:'#2563EB', fontWeight:700 }}>{fmt(s.balance_available||0)}</td>
                        <td style={{ ...S.td, display:'flex', gap:4, flexWrap:'wrap' }}>
                          {(!s.seller_status||s.seller_status==='pending') && <>
                            <button style={S.btn('#ECFDF5','#059669','1px solid #A7F3D0')} onClick={() => approveSeller(s.id)}>✅ Aprovar</button>
                            <button style={S.btn('#FEF2F2','#EF4444','1px solid #FECACA')} onClick={() => rejectSeller(s.id)}>❌ Rejeitar</button>
                          </>}
                          {s.seller_status==='approved' && <button style={S.btn('#FFFBEB','#D97706','1px solid #FDE68A')} onClick={() => setSuspendModal({uid:s.id,nome:s.nome})}>⚠️ Punir</button>}
                          {(s.seller_status==='suspended'||s.status==='suspended') && <button style={S.btn('#ECFDF5','#059669','1px solid #A7F3D0')} onClick={() => restoreUser(s.id)}>🔓 Restaurar</button>}
                          <button style={S.btn('#FEF2F2','#EF4444','1px solid #FECACA')} onClick={() => deleteUser(s.id,s.nome)}>🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── LISTINGS ── */}
          {panel === 'listings' && (
            <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
              <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #E2E8F0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:14, fontWeight:800 }}>📦 Anúncios</div>
                <input style={{ ...S.input, width:240 }} placeholder="Buscar anúncio..." value={listingSearch} onChange={e => setListingSearch(e.target.value)} />
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr><th style={S.th}>Título</th><th style={S.th}>Vendedor</th><th style={S.th}>Preço</th><th style={S.th}>Vendas</th><th style={S.th}>Status</th><th style={S.th}>Ações</th></tr></thead>
                <tbody>
                  {filteredListings.map(l => (
                    <tr key={l.id}>
                      <td style={S.td}><b>{l.title}</b></td>
                      <td style={{ ...S.td, fontSize:12, color:'#64748B' }}>{l.profiles?.nome||'—'}</td>
                      <td style={{ ...S.td, color:'#2563EB', fontWeight:700 }}>{l.price===0?'Grátis':fmt(l.price)}</td>
                      <td style={{ ...S.td, textAlign:'center' }}>{l.sales_count||0}</td>
                      <td style={S.td}><Badge label={l.status==='live'?'● Publicado':'⏸ Pausado'} color={l.status==='live'?'#059669':'#D97706'} bg={l.status==='live'?'#ECFDF5':'#FFFBEB'} /></td>
                      <td style={{ ...S.td, display:'flex', gap:4 }}>
                        <button style={S.btn('transparent','#64748B','1px solid #E2E8F0')} onClick={() => toggleListing(l.id,l.status)}>{l.status==='live'?'⏸':'▶'}</button>
                        <button style={S.btn('#FEF2F2','#EF4444','1px solid #FECACA')} onClick={() => deleteListing(l.id)}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── WITHDRAWALS ── */}
          {panel === 'withdrawals' && (
            <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
              <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #E2E8F0' }}>
                <div style={{ fontSize:14, fontWeight:800 }}>💸 Saques</div>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr><th style={S.th}>Vendedor</th><th style={S.th}>Valor</th><th style={S.th}>Status</th><th style={S.th}>Solicitado</th><th style={S.th}>Ações</th></tr></thead>
                <tbody>
                  {withdrawals.map(w => {
                    const st = W_STATUS[w.status]||W_STATUS.pending
                    return (
                      <tr key={w.id}>
                        <td style={S.td}><b>{w.profiles?.nome||'—'}</b><br /><span style={{ fontSize:11, color:'#94A3B8' }}>{w.profiles?.email}</span></td>
                        <td style={{ ...S.td, color:'#2563EB', fontWeight:700 }}>{fmt(w.amount)}</td>
                        <td style={S.td}><Badge label={st.label} color={st.color} bg={st.bg} /></td>
                        <td style={{ ...S.td, fontSize:12, color:'#94A3B8' }}>{fmtDate(w.created_at)}</td>
                        <td style={{ ...S.td, display:'flex', gap:4 }}>
                          {w.status==='pending' && <>
                            <button style={S.btn('#ECFDF5','#059669','1px solid #A7F3D0')} onClick={() => markWithdrawal(w.id,'paid')}>✅ Pago</button>
                            <button style={S.btn('#FEF2F2','#EF4444','1px solid #FECACA')} onClick={() => markWithdrawal(w.id,'failed')}>❌ Falhou</button>
                          </>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── BANNER ── */}
          {panel === 'banner' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem', alignItems:'start' }}>
              <div style={S.card}>
                <div style={{ fontSize:14, fontWeight:800, marginBottom:'1rem' }}>📢 Configurar Banner</div>
                {[
                  { label:'Texto do banner', id:'text', placeholder:'Ex: 🎉 Promoção especial! 50% off hoje' },
                  { label:'Ícone', id:'icon', placeholder:'📢' },
                  { label:'Link (opcional)', id:'link', placeholder:'https://...' },
                  { label:'Texto do link', id:'linkText', placeholder:'Ver mais' },
                ].map(f => (
                  <div key={f.id} style={{ marginBottom:'1rem' }}>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748B', marginBottom:'.4rem', textTransform:'uppercase', letterSpacing:'.06em' }}>{f.label}</label>
                    <input style={S.input} placeholder={f.placeholder} value={(banner as any)[f.id]||''} onChange={e => setBanner(b => ({...b,[f.id]:e.target.value}))} />
                  </div>
                ))}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:'1rem' }}>
                  {[{label:'Cor texto',id:'color'},{label:'Cor fundo',id:'bg'},{label:'Cor borda',id:'border'}].map(f => (
                    <div key={f.id}>
                      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748B', marginBottom:'.4rem', textTransform:'uppercase', letterSpacing:'.06em' }}>{f.label}</label>
                      <input type="color" style={{ ...S.input, height:40, padding:4, cursor:'pointer' }} value={(banner as any)[f.id]||'#000'} onChange={e => setBanner(b => ({...b,[f.id]:e.target.value}))} />
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom:'1rem' }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748B', marginBottom:'.4rem', textTransform:'uppercase', letterSpacing:'.06em' }}>Status</label>
                  <select style={{ ...S.input, cursor:'pointer' }} value={banner.active?'true':'false'} onChange={e => setBanner(b => ({...b,active:e.target.value==='true'}))}>
                    <option value="true">✅ Ativo — exibindo no site</option>
                    <option value="false">⛔ Inativo — oculto</option>
                  </select>
                </div>
                <button style={{ ...S.btn('#2563EB','#fff'), width:'100%', justifyContent:'center', padding:'.75rem' }} onClick={saveBanner}>
                  💾 Salvar banner
                </button>
              </div>
              <div style={S.card}>
                <div style={{ fontSize:14, fontWeight:800, marginBottom:'.75rem' }}>👁️ Pré-visualização</div>
                <p style={{ fontSize:13, color:'#64748B', marginBottom:'1rem' }}>Como aparece no topo do site:</p>
                <div style={{ background:banner.bg, border:`1px solid ${banner.border}`, borderRadius:10, padding:'.75rem 1rem', fontSize:13, fontWeight:600, color:banner.color, display:'flex', alignItems:'center', gap:10, justifyContent:'center' }}>
                  <span>{banner.icon||'📢'}</span>
                  <span>{banner.text||'Seu texto aparecerá aqui'}</span>
                  {banner.link && <span style={{ fontWeight:800, textDecoration:'underline' }}>{banner.linkText||'Ver mais'}</span>}
                </div>
                {!banner.active && <p style={{ fontSize:12, color:'#94A3B8', marginTop:'.75rem', textAlign:'center' }}>⛔ Banner inativo — não aparece no site</p>}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── MODAL SUSPENSÃO ── */}
      {suspendModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div style={{ background:'#fff', borderRadius:16, padding:'1.5rem', width:'100%', maxWidth:440, boxShadow:'0 24px 64px rgba(0,0,0,.15)' }}>
            <div style={{ fontSize:16, fontWeight:800, marginBottom:'1rem' }}>⚠️ Punir: {suspendModal.nome}</div>
            <div style={{ marginBottom:'1rem' }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748B', marginBottom:'.4rem', textTransform:'uppercase', letterSpacing:'.06em' }}>Motivo</label>
              <textarea style={{ ...S.input, minHeight:80, resize:'vertical' } as React.CSSProperties} placeholder="Descreva o motivo..." value={suspendReason} onChange={e => setSuspendReason(e.target.value)} />
            </div>
            <div style={{ marginBottom:'1.25rem' }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748B', marginBottom:'.4rem', textTransform:'uppercase', letterSpacing:'.06em' }}>Ação</label>
              <select style={{ ...S.input, cursor:'pointer' }} value={suspendAction} onChange={e => setSuspendAction(e.target.value)}>
                <option value="suspended">🚫 Suspender conta</option>
                <option value="banned">❌ Banir permanentemente</option>
                <option value="warning">⚠️ Apenas aviso</option>
              </select>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', borderTop:'1px solid #E2E8F0', paddingTop:'1rem' }}>
              <button style={S.btn('transparent','#64748B','1px solid #E2E8F0')} onClick={() => setSuspendModal(null)}>Cancelar</button>
              <button style={S.btn('#FEF2F2','#EF4444','1px solid #FECACA')} onClick={doSuspend}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, background: toast.type==='err'?'#EF4444':toast.type==='warn'?'#F59E0B':'#0F172A', color:'#fff', borderRadius:12, padding:'14px 20px', fontSize:14, fontWeight:600, boxShadow:'0 8px 32px rgba(0,0,0,.2)', maxWidth:340, animation:'fadeUp .3s ease' }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}