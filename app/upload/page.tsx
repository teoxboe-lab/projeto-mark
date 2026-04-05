'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import ToastRoot, { showToast } from '@/components/ToastRoot'
import type { Listing, Profile } from '@/lib/types'

const CATS = [
  { id: 'free-fire',  label: 'Free Fire',   emoji: '🔥', niche: 'free-fire'  },
  { id: 'valorant',   label: 'Valorant',    emoji: '🎯', niche: 'valorant'   },
  { id: 'roblox',     label: 'Roblox',      emoji: '🧱', niche: 'roblox'     },
  { id: 'fortnite',   label: 'Fortnite',    emoji: '🏗️', niche: 'fortnite'   },
  { id: 'anime',      label: 'Anime',       emoji: '⛩️', niche: 'anime'      },
  { id: 'vsl',        label: 'Funis/VSL',   emoji: '📈', niche: 'vsl'        },
  { id: 'ebook',      label: 'E-book',      emoji: '📚', niche: 'ebook'      },
  { id: 'social',     label: 'Redes Soc.',  emoji: '📱', niche: 'social'     },
  { id: 'outros',     label: 'Outros',      emoji: '📦', niche: 'outros'     },
]

export default function UploadPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const thumbRef = useRef<HTMLInputElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)

  const [user, setUser] = useState<Profile | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [selCats, setSelCats] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [thumbFile, setThumbFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState('')
  const [thumbPreview, setThumbPreview] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [form, setForm] = useState({ title: '', desc: '', price: '', priceOld: '', url: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Auth guard
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) { router.push('/auth'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single()
      if (!data || data.role !== 'vendedor') { router.push('/vitrine'); return }
      setUser(data)
    })
  }, [])

  useEffect(() => { if (user) loadMyListings() }, [user])

  const loadMyListings = async () => {
    if (!user) return
    const { data } = await supabase.from('listings').select('*').eq('seller_id', user.id).order('created_at', { ascending: false })
    setListings(data || [])
  }

  // Checklist completeness
  const done = [!!mediaFile, !!form.title.trim(), !!form.desc.trim(), selCats.length > 0, form.price !== ''].filter(Boolean).length

  const handleFile = (file: File) => {
    setMediaFile(file)
    setMediaPreview(URL.createObjectURL(file))
  }
  const handleThumb = (file: File) => {
    setThumbFile(file)
    setThumbPreview(URL.createObjectURL(file))
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t) && tags.length < 8) {
      setTags(prev => [...prev, t])
      setTagInput('')
    }
  }
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!mediaFile) e.media = 'Selecione uma mídia ou imagem'
    if (!form.title.trim()) e.title = 'Título obrigatório'
    if (!form.desc.trim()) e.desc = 'Descrição obrigatória'
    if (!selCats.length) e.cats = 'Selecione ao menos uma categoria'
    if (form.price === '') e.price = 'Defina um preço (0 para grátis)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) { showToast('Preencha todos os campos obrigatórios!', 'err'); return }
    if (!user) return
    setUploading(true); setProgress(0)

    try {
      let media_url: string | null = null
      let thumbnail_url: string | null = null

      // Simula progresso enquanto faz upload
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 15, 85))
      }, 200)

      // Upload da mídia principal
      if (mediaFile) {
        const ext = mediaFile.name.split('.').pop()
        const path = `${user.id}/${Date.now()}-media.${ext}`
        const { data, error } = await supabase.storage.from('listings-media').upload(path, mediaFile, { upsert: true })
        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage.from('listings-media').getPublicUrl(path)
          media_url = publicUrl
        }
      }

      // Upload da thumbnail
      if (thumbFile) {
        const ext = thumbFile.name.split('.').pop()
        const path = `${user.id}/${Date.now()}-thumb.${ext}`
        const { data, error } = await supabase.storage.from('listings-media').upload(path, thumbFile, { upsert: true })
        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage.from('listings-media').getPublicUrl(path)
          thumbnail_url = publicUrl
        }
      }

      clearInterval(progressInterval)
      setProgress(95)

      const cat = CATS.find(c => selCats.includes(c.id))
      const { error } = await supabase.from('listings').insert({
        seller_id: user.id,
        title: form.title.trim().toUpperCase(),
        description: form.desc.trim(),
        price: parseFloat(form.price) || 0,
        price_old: form.priceOld ? parseFloat(form.priceOld) : null,
        category: selCats[0] || 'outros',
        niche: cat?.niche || 'outros',
        emoji: cat?.emoji || '📦',
        tags,
        media_url,
        thumbnail_url,
        html_url: form.url || null,
        status: 'live',
        rating: 5.0,
        reviews_count: 0,
        sales_count: 0,
      })

      setProgress(100)

      if (error) throw error

      showToast('🎉 Anúncio publicado! Já aparece na vitrine.', 'ok')

      // Reset form
      setForm({ title: '', desc: '', price: '', priceOld: '', url: '' })
      setSelCats([]); setTags([]); setMediaFile(null); setThumbFile(null)
      setMediaPreview(''); setThumbPreview(''); setErrors({})
      loadMyListings()
    } catch (e: any) {
      showToast('Erro ao publicar: ' + (e.message || 'Tente novamente'), 'err')
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 1500)
    }
  }

  const toggleStatus = async (listing: Listing) => {
    const newStatus = listing.status === 'live' ? 'paused' : 'live'
    await supabase.from('listings').update({ status: newStatus }).eq('id', listing.id)
    showToast(newStatus === 'live' ? '✅ Anúncio reativado' : '⏸️ Anúncio pausado', 'info')
    loadMyListings()
  }

  const deleteListing = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este anúncio?')) return
    await supabase.from('listings').delete().eq('id', id)
    showToast('🗑️ Anúncio excluído', 'warn')
    loadMyListings()
  }

  if (!user) return (
    <><Header /><div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 14 }}>Verificando acesso...</div></>
  )

  return (
    <>
      <Header />
      <ToastRoot />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 64px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em' }}>Criar Anúncio</h1>
          <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 4 }}>Preencha os campos e publique na vitrine instantaneamente.</p>
        </div>

        {/* Info bar */}
        <div style={{ background: 'var(--blue-light)', border: '1px solid var(--blue)', borderRadius: 'var(--r)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--blue)', marginBottom: 24 }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Campos com <span style={{ color: 'var(--red)', margin: '0 3px' }}>*</span> são obrigatórios para publicar
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
          {/* LEFT — Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── MÍDIA ── */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-3)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                Mídia principal <span style={{ color: 'var(--red)' }}>*</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => !mediaFile && fileRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? 'var(--blue)' : errors.media ? 'var(--red)' : 'var(--border-2)'}`,
                  borderRadius: 'var(--r)', background: isDragging ? 'var(--blue-light)' : mediaPreview ? '#000' : 'var(--surface)',
                  minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: mediaFile ? 'default' : 'pointer', position: 'relative', overflow: 'hidden', transition: 'all .15s'
                }}
              >
                {mediaPreview ? (
                  <>
                    {mediaFile?.type.startsWith('video') ? (
                      <video src={mediaPreview} controls style={{ maxWidth: '100%', maxHeight: 280, display: 'block' }} />
                    ) : (
                      <img src={mediaPreview} alt="preview" style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain' }} />
                    )}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent,rgba(0,0,0,.85))', padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mediaFile?.name}</span>
                      <button onClick={e => { e.stopPropagation(); setMediaFile(null); setMediaPreview('') }}
                        style={{ background: 'rgba(239,68,68,.85)', color: '#fff', border: 'none', borderRadius: 'var(--r-full)', padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Remover
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 28, textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, background: 'var(--blue-light)', borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="24" height="24" fill="none" stroke="var(--blue)" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Arraste ou clique para fazer upload</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Vídeo demonstrativo ou imagem do produto</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {['MP4', 'MOV', 'JPG', 'PNG', 'GIF'].map(t => (
                        <span key={t} style={{ border: '1px solid var(--border-2)', background: '#fff', padding: '2px 9px', borderRadius: 'var(--r-full)', fontSize: 10, fontWeight: 700, color: 'var(--text-3)' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="video/*,image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {errors.media && <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, marginTop: 4 }}>{errors.media}</div>}

              {/* Thumbnail */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Thumbnail do card (opcional)</div>
                <div onClick={() => thumbRef.current?.click()}
                  style={{ border: `2px dashed ${thumbPreview ? 'var(--border)' : 'var(--border-2)'}`, borderRadius: 'var(--r)', background: 'var(--surface)', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'all .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--blue)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = thumbPreview ? 'var(--border)' : 'var(--border-2)')}>
                  {thumbPreview ? (
                    <img src={thumbPreview} alt="thumb" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <svg width="20" height="20" fill="none" stroke="var(--text-3)" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>Adicionar thumbnail</span>
                    </div>
                  )}
                </div>
                <input ref={thumbRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleThumb(e.target.files[0])} />
              </div>
            </div>

            {/* ── INFORMAÇÕES ── */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-3)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                Informações do anúncio
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>Título <span style={{ color: 'var(--red)' }}>*</span></label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: CONTA FREE FIRE PASSE DE ELITE DIAMANTE" maxLength={80}
                    style={{ width: '100%', border: `1px solid ${errors.title ? 'var(--red)' : 'var(--border-2)'}`, borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 14, fontFamily: 'Inter,sans-serif', outline: 'none', color: 'var(--text)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                    {errors.title && <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>{errors.title}</span>}
                    <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>{form.title.length}/80</span>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>Descrição completa <span style={{ color: 'var(--red)' }}>*</span></label>
                  <textarea value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="Descreva em detalhes o que o comprador vai receber..." rows={5} maxLength={2000}
                    style={{ width: '100%', border: `1px solid ${errors.desc ? 'var(--red)' : 'var(--border-2)'}`, borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 14, fontFamily: 'Inter,sans-serif', outline: 'none', color: 'var(--text)', resize: 'vertical' }} />
                  {errors.desc && <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>{errors.desc}</span>}
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>Link de entrega (opcional)</label>
                  <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://drive.google.com/... ou link de acesso"
                    style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 14, fontFamily: 'Inter,sans-serif', outline: 'none', color: 'var(--text)' }} />
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>Link privado compartilhado somente após confirmação do pagamento</div>
                </div>
              </div>
            </div>

            {/* ── CATEGORIAS ── */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-3)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                Categoria <span style={{ color: 'var(--red)' }}>*</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {CATS.map(c => (
                  <button key={c.id}
                    onClick={() => setSelCats(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                    style={{ border: `1px solid ${selCats.includes(c.id) ? 'var(--blue)' : 'var(--border)'}`, background: selCats.includes(c.id) ? 'var(--blue-light)' : 'var(--surface)', borderRadius: 'var(--r)', padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .12s' }}>
                    <span style={{ fontSize: 14 }}>{c.emoji}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                  </button>
                ))}
              </div>
              {errors.cats && <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, marginTop: 6 }}>{errors.cats}</div>}
            </div>

            {/* ── PREÇO ── */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-3)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                Precificação <span style={{ color: 'var(--red)' }}>*</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>Preço (R$) <span style={{ color: 'var(--red)' }}>*</span></label>
                  <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} min="0" step="0.01" placeholder="0.00 = Grátis"
                    style={{ width: '100%', border: `1px solid ${errors.price ? 'var(--red)' : 'var(--border-2)'}`, borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 14, fontFamily: 'Inter,sans-serif', outline: 'none', color: 'var(--text)' }} />
                  {errors.price && <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, marginTop: 3 }}>{errors.price}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>Digite 0 para disponibilizar gratuitamente</div>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>Preço anterior (opcional)</label>
                  <input type="number" value={form.priceOld} onChange={e => setForm(f => ({ ...f, priceOld: e.target.value }))} min="0" step="0.01" placeholder="Ex: 297.00"
                    style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 14, fontFamily: 'Inter,sans-serif', outline: 'none', color: 'var(--text)' }} />
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>Mostra como "De R$X por R$Y"</div>
                </div>
              </div>
            </div>

            {/* ── TAGS ── */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-3)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                Tags / Features
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <div onClick={() => tagInputRef.current?.focus()}
                style={{ border: '1px solid var(--border-2)', background: '#fff', borderRadius: 'var(--r)', padding: 7, minHeight: 44, display: 'flex', flexWrap: 'wrap', gap: 5, cursor: 'text' }}>
                {tags.map(t => (
                  <span key={t} style={{ background: 'var(--blue-light)', border: '1px solid var(--blue)', borderRadius: 'var(--r-full)', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--blue)' }}>
                    {t}
                    <button onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--blue)', padding: 0, fontWeight: 700, lineHeight: 1 }}>×</button>
                  </span>
                ))}
                <input ref={tagInputRef} value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), addTag())}
                  placeholder={tags.length === 0 ? 'Digite e pressione Enter para adicionar...' : ''}
                  style={{ border: 'none', outline: 'none', fontSize: 13, fontFamily: 'Inter,sans-serif', background: 'transparent', minWidth: 120, flex: 1, color: 'var(--text)' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Máximo 8 tags · Aparecem como features no card do produto</div>
            </div>

            {/* Progress bar */}
            {uploading && (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                  <span>{progress < 100 ? 'Publicando anúncio...' : '✅ Publicado!'}</span>
                  <span>{progress}%</span>
                </div>
                <div style={{ background: 'var(--border)', borderRadius: 'var(--r-full)', height: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: progress === 100 ? 'var(--green)' : 'var(--blue)', width: `${progress}%`, transition: 'width .3s', borderRadius: 'var(--r-full)' }} />
                </div>
              </div>
            )}

            {/* Submit */}
            <button onClick={handleSubmit} disabled={uploading}
              style={{ width: '100%', padding: 16, background: uploading ? 'var(--border-2)' : 'var(--blue)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 16, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer', transition: 'background .15s' }}>
              {uploading ? '⏳ Publicando...' : '🚀 Publicar na Vitrine'}
            </button>
          </div>

          {/* RIGHT — Sidebar */}
          <div style={{ position: 'sticky', top: 80 }}>
            {/* Checklist */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 16, marginBottom: 14, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Checklist
                <span style={{ fontSize: 12, fontWeight: 800, color: done === 5 ? 'var(--green)' : done >= 3 ? 'var(--yellow)' : 'var(--red)' }}>{done}/5</span>
              </div>
              <div style={{ background: 'var(--border)', borderRadius: 'var(--r-full)', height: 6, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ height: '100%', background: done === 5 ? 'var(--green)' : done >= 3 ? 'var(--yellow)' : 'var(--red)', width: `${done / 5 * 100}%`, transition: 'width .4s, background .3s', borderRadius: 'var(--r-full)' }} />
              </div>
              {[
                { key: 'media',  label: 'Mídia',      done: !!mediaFile },
                { key: 'title',  label: 'Título',     done: !!form.title.trim() },
                { key: 'desc',   label: 'Descrição',  done: !!form.desc.trim() },
                { key: 'cats',   label: 'Categoria',  done: selCats.length > 0 },
                { key: 'price',  label: 'Preço',      done: form.price !== '' },
              ].map((item, i) => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 'var(--r)', border: `1.5px solid ${item.done ? 'var(--green)' : 'var(--border-2)'}`, background: item.done ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: item.done ? '#fff' : 'var(--text-3)', flexShrink: 0, transition: 'all .2s' }}>
                    {item.done ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Preview card */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 16, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>Prévia do card</div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                <div style={{ aspectRatio: '16/9', background: thumbPreview ? undefined : '#EBF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, position: 'relative', overflow: 'hidden' }}>
                  {thumbPreview ? <img src={thumbPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : CATS.find(c => selCats.includes(c.id))?.emoji || '📦'}
                </div>
                <div style={{ padding: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>
                    {CATS.find(c => selCats.includes(c.id))?.label || 'Categoria'}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', marginBottom: 6, minHeight: 18 }}>
                    {form.title || 'Título do anúncio'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: form.price === '0' || form.price === '' ? 'var(--text-3)' : 'var(--blue)' }}>
                      {form.price === '' ? 'R$ —' : form.price === '0' ? 'Grátis' : `R$ ${Number(form.price).toFixed(2).replace('.', ',')}`}
                    </div>
                    <div style={{ background: 'var(--blue)', color: '#fff', borderRadius: 'var(--r-full)', padding: '5px 12px', fontSize: 11, fontWeight: 700 }}>
                      {!form.price || form.price === '0' ? 'Obter' : 'Comprar'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── MEUS ANÚNCIOS ── */}
        <div style={{ marginTop: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.03em' }}>Meus Anúncios</h2>
            <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>{listings.length} publicados</span>
          </div>

          {listings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Nenhum anúncio ainda</div>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Publique seu primeiro anúncio acima e ele aparecerá aqui.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {listings.map(l => (
                <div key={l.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ width: 44, height: 44, background: 'var(--blue-light)', borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {l.thumbnail_url ? <img src={l.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--r)' }} /> : l.emoji}
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
                    <div style={{ fontSize: 15, fontWeight: 800, color: l.price === 0 ? 'var(--green)' : 'var(--text)', letterSpacing: '-.02em', lineHeight: 1 }}>
                      {l.price === 0 ? 'Grátis' : `R$ ${Number(l.price).toFixed(0)}`}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Preço</div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--r-full)', background: l.status === 'live' ? '#ECFDF5' : '#FFFBEB', color: l.status === 'live' ? 'var(--green)' : 'var(--yellow)' }}>
                    {l.status === 'live' ? '● Publicado' : '⏸ Pausado'}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => toggleStatus(l)}
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--text-2)' }}>
                      {l.status === 'live' ? '⏸ Pausar' : '▶ Ativar'}
                    </button>
                    <button onClick={() => deleteListing(l.id)}
                      style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--r)', padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--red)' }}>
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
