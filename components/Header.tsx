'use client'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useRef } from 'react'
import type { Profile } from '@/lib/types'

export default function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [user, setUser] = useState<Profile | null>(null)
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) return
      const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single()
      if (data) setUser(data)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        if (data) setUser(data)
      } else { setUser(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) router.push(`/vitrine?q=${encodeURIComponent(search.trim())}`)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/auth')
  }

  const initials = user?.nome ? user.nome.slice(0, 2).toUpperCase() : '??'

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 500, background: '#fff', borderBottom: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', height: 64, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 20 }}>
      {/* Logo */}
      <span onClick={() => router.push('/vitrine')} style={{ fontSize: 22, fontWeight: 900, color: 'var(--blue)', letterSpacing: '-.04em', cursor: 'pointer', fontStyle: 'italic', flexShrink: 0, userSelect: 'none' }}>Framework</span>

      {/* Search */}
      <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: 480, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-full)', padding: '0 16px', height: 40, transition: 'border-color .15s' }}
        onFocus={e => e.currentTarget.style.borderColor = 'var(--blue)'}
        onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <svg width="15" height="15" fill="none" stroke="var(--text-3)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Anuncio, usuario ou categoria"
          style={{ background: 'none', border: 'none', outline: 'none', fontSize: 14, fontFamily: 'Inter,sans-serif', color: 'var(--text)', width: '100%' }} />
      </form>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
        <button onClick={() => router.push('/vitrine')}
          style={{ fontSize: 14, fontWeight: 500, color: pathname === '/vitrine' ? 'var(--blue)' : 'var(--text-2)', padding: '8px 12px', borderRadius: 'var(--r)', background: 'none', border: 'none', cursor: 'pointer', display: 'none' }}
          className="desktop-only">
          Categorias
        </button>

        {user?.role === 'vendedor' ? (
          <button onClick={() => router.push('/upload')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--blue)', color: '#fff', fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 'var(--r-full)', border: 'none', cursor: 'pointer', letterSpacing: '.01em' }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>
            Criar Anuncio
          </button>
        ) : !user ? (
          <button onClick={() => router.push('/auth')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--blue)', color: '#fff', fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 'var(--r-full)', border: 'none', cursor: 'pointer' }}>
            Entrar
          </button>
        ) : null}

        {user && (
          <>
            {/* Cart icon */}
            <button onClick={() => router.push('/dashboard')}
              style={{ width: 38, height: 38, borderRadius: 'var(--r-full)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', transition: 'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-3)' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </button>

            {/* Avatar menu */}
            <div ref={menuRef} style={{ position: 'relative' }}>
              <div onClick={() => setMenuOpen(m => !m)}
                style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--blue)', border: '2px solid var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', cursor: 'pointer', userSelect: 'none', transition: 'border-color .15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--blue-dark)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--blue-light)')}>
                {initials}
              </div>

              {menuOpen && (
                <div style={{ position: 'absolute', right: 0, top: 44, background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', boxShadow: 'var(--shadow-lg)', minWidth: 180, zIndex: 999, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{user.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'capitalize' }}>{user.role}</div>
                  </div>
                  {[
                    { label: 'Minha conta', path: '/dashboard' },
                    ...(user.role === 'vendedor' ? [{ label: 'Criar anuncio', path: '/upload' }] : []),
                  ].map(item => (
                    <button key={item.path} onClick={() => { router.push(item.path); setMenuOpen(false) }}
                      style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-2)', fontWeight: 500, transition: 'background .1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      {item.label}
                    </button>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    <button onClick={handleLogout}
                      style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--red)', fontWeight: 600, transition: 'background .1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      Sair da conta
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </nav>
    </header>
  )
}
