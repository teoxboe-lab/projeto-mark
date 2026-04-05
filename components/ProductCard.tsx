'use client'
import { useRouter } from 'next/navigation'
import type { Listing } from '@/lib/types'

type Props = { listing: Listing; onBuy?: (listing: Listing) => void }

export default function ProductCard({ listing, onBuy }: Props) {
  const router = useRouter()
  const isFree = Number(listing.price) === 0
  const price = Number(listing.price)
  const priceOld = listing.price_old ? Number(listing.price_old) : null
  const discount = priceOld && priceOld > price ? Math.round((1 - price / priceOld) * 100) : null

  const goToDetail = () => router.push(`/anuncio/${listing.id}`)

  return (
    <div
      className="prod-card"
      style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
      onClick={goToDetail}
    >
      <div style={{ aspectRatio: '4/3', background: '#EBF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
        {listing.thumbnail_url
          ? <img src={listing.thumbnail_url} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
          : listing.media_url && !listing.media_url.match(/\.(mp4|mov|webm)$/i)
            ? <img src={listing.media_url} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
            : <div style={{ fontSize: 48, opacity: .6 }}>{listing.emoji || '📦'}</div>
        }
        {isFree && <span style={{ position: 'absolute', top: 8, left: 8, background: 'var(--green)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--r-full)' }}>GRATIS</span>}
        {discount && !isFree && <span style={{ position: 'absolute', top: 8, left: 8, background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--r-full)' }}>-{discount}%</span>}
        {(listing.sales_count || 0) > 0 && <span style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-full)' }}>{listing.sales_count} vendas</span>}
      </div>

      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>{listing.niche}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.02em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>{listing.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{listing.profiles?.nome?.slice(0, 2).toUpperCase() || 'VD'}</div>
          <span style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.profiles?.nome || 'Vendedor'}</span>
        </div>
        {(listing.reviews_count || 0) > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {[1,2,3,4,5].map(s => <svg key={s} width="11" height="11" viewBox="0 0 24 24" fill={s <= Math.round(Number(listing.rating)) ? '#F59E0B' : '#E5E7EB'}><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" /></svg>)}
            <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 2 }}>({listing.reviews_count})</span>
          </div>
        )}
      </div>

      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }} onClick={e => e.stopPropagation()}>
        <div>
          {priceOld && priceOld > price && <div style={{ fontSize: 10, color: 'var(--text-3)', textDecoration: 'line-through' }}>R$ {priceOld.toFixed(2).replace('.', ',')}</div>}
          <div style={{ fontSize: 17, fontWeight: 900, color: isFree ? 'var(--green)' : 'var(--blue)', letterSpacing: '-.02em' }}>{isFree ? 'Gratis' : `R$ ${price.toFixed(2).replace('.', ',')}`}</div>
        </div>
        <button onClick={e => { e.stopPropagation(); router.push(`/anuncio/${listing.id}`) }}
          style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 'var(--r-full)', padding: '7px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {isFree ? 'Obter' : 'Comprar'}
        </button>
      </div>
    </div>
  )
}
